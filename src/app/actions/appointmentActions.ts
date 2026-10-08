'use server';

import { db, FieldValue, Timestamp } from '@/app/lib/supabaseDb';
import { sendBookingNotification } from './lineActions';
import {
    sendPaymentFlexMessage,
    sendReviewFlexMessage,
    sendAppointmentConfirmedFlexMessage,
    sendServiceCompletedFlexMessage,
    sendAppointmentCancelledFlexMessage,
    sendPaymentConfirmationFlexMessage
} from './lineFlexActions';
import { sendTelegramMessageToAdmin } from './telegramActions';
import { awardPointsForPurchase, awardPointsForVisit } from './pointActions';
import { findOrCreateCustomer } from './customerActions';
import { createOrUpdateCalendarEvent, deleteCalendarEvent } from './calendarActions';
import * as settingsActions from './settingsActions';
import { Appointment, Service } from '@/types';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// ... (Existing functions like createAppointmentWithSlotCheck) ...

// Re-exporting createAppointmentWithSlotCheck for brevity (it was correct in previous step)
export async function createAppointmentWithSlotCheck(appointmentData: any, auth?: AuthContext) {
    const { date, time, serviceId, technicianId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    try {
        let resolvedUserId: string | undefined = appointmentData.userId;
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) {
            const lineAuth = await requireLineAuth(auth);
            if (!lineAuth.ok) {
                return { success: false, error: lineAuth.error };
            }
            const lineUserId = lineAuth.value.userId;
            if (lineUserId && resolvedUserId && lineUserId !== resolvedUserId) {
                return { success: false, error: 'LINE user mismatch.' };
            }
            if (!lineUserId && !resolvedUserId && process.env.NODE_ENV === 'production') {
                return { success: false, error: 'Missing LINE user.' };
            }
            resolvedUserId = lineUserId || resolvedUserId;
        }

        const settingsRef = db.collection('settings').doc('booking');
        const settingsSnap = await settingsRef.get();

        let maxSlot = 1;
        let useTechnician = false;

        if (settingsSnap.exists) {
            const data = settingsSnap.data();
            useTechnician = !!(data?.useTechnician ?? data?.useBeautician);
            if (data?.totalTechnicians || data?.totalBeauticians) {
                maxSlot = Number(data?.totalTechnicians ?? data?.totalBeauticians);
            }
            if (Array.isArray(data?.timeQueues) && data.timeQueues.length > 0) {
                const specificQueue = data.timeQueues.find((q: any) => q.time === time);
                if (specificQueue && typeof specificQueue.count === 'number') {
                    maxSlot = specificQueue.count;
                }
            }
        }

        let queryConditions: any[] = [
            ['date', '==', date],
            ['time', '==', time],
            ['status', 'in', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked']]
        ];

        if (useTechnician && technicianId && technicianId !== 'auto-assign') {
            queryConditions.push(['technicianId', '==', technicianId]);
            maxSlot = 1;
        }

        let q: any = db.collection('appointments');
        queryConditions.forEach(condition => {
            q = q.where(...condition);
        });

        const snap = await q.get();
        if (snap.size >= maxSlot) {
            const errorMsg = useTechnician && technicianId !== 'auto-assign'
                ? 'ช่างท่านนี้ไม่ว่างในช่วงเวลาดังกล่าว'
                : 'ช่วงเวลานี้ถูกจองเต็มแล้ว';
            return { success: false, error: errorMsg };
        }

        const serviceRef = db.collection('services').doc(serviceId);
        const serviceSnap = await serviceRef.get();
        if (!serviceSnap.exists) {
            return { success: false, error: 'ไม่พบบริการที่เลือก' };
        }
        const authoritativeServiceData = serviceSnap.data() as Service;

        let finalPrice = authoritativeServiceData.price || 0;
        let finalDuration = authoritativeServiceData.duration || 0;
        let selectedArea = null;
        let selectedPackage = null;

        if (authoritativeServiceData.serviceType === 'multi-area' && authoritativeServiceData.areas && authoritativeServiceData.areas.length > 0) {
            const areaIndex = appointmentData.appointmentInfo?.areaIndex;
            const packageIndex = appointmentData.appointmentInfo?.packageIndex;

            if (areaIndex !== null && areaIndex !== undefined && authoritativeServiceData.areas[areaIndex]) {
                selectedArea = authoritativeServiceData.areas[areaIndex] || null;
                finalPrice = selectedArea.price || 0;
                finalDuration = selectedArea.duration || 0;

                if (packageIndex !== null && packageIndex !== undefined && selectedArea.packages && selectedArea.packages[packageIndex]) {
                    selectedPackage = selectedArea.packages[packageIndex] || null;
                    finalPrice = selectedPackage.price || 0;
                    finalDuration = selectedPackage.duration || 0;
                }
            }
        }

        if (authoritativeServiceData.serviceType === 'area-based-options' && authoritativeServiceData.areaOptions) {
            finalPrice = 0;
            finalDuration = 0;
            const selectedOptions = appointmentData.appointmentInfo?.selectedAreaOptions || [];
            if (Array.isArray(selectedOptions)) {
                selectedOptions.forEach((selected: any) => {
                    const areaGroup = authoritativeServiceData.areaOptions?.find(g => g.areaName === selected.areaName);
                    if (areaGroup) {
                        const option = areaGroup.options.find(o => o.name === selected.optionName);
                        if (option) {
                            finalPrice += Number(option.price) || 0;
                            finalDuration += Number(option.duration) || 0;
                        }
                    }
                });
            }
        }

        const addOns = appointmentData.appointmentInfo?.addOns || [];
        const addOnsTotal = addOns.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
        const addOnsDuration = addOns.reduce((sum: number, a: any) => sum + (a.duration || 0), 0);

        finalPrice += addOnsTotal;
        finalDuration += addOnsDuration;

        const subtotal = finalPrice;
        let discountAmount = 0;
        let appliedCoupon: { id: string; name?: string; discountType?: string; discountValue?: number } | null = null;

        const couponId = appointmentData.paymentInfo?.couponId;
        if (couponId) {
            if (!resolvedUserId) {
                return { success: false, error: 'Coupon requires LINE user.' };
            }
            const couponRef = db.collection('customers').doc(resolvedUserId).collection('coupons').doc(couponId);
            const couponSnap = await couponRef.get();
            if (!couponSnap.exists) {
                return { success: false, error: 'Invalid coupon.' };
            }
            const couponData = couponSnap.data() as any;
            if (couponData?.used) {
                return { success: false, error: 'Coupon already used.' };
            }
            const discountType = couponData?.discountType;
            const discountValue = Number(couponData?.discountValue || 0);
            if (discountType === 'percentage') {
                discountAmount = Math.round(subtotal * (discountValue / 100));
            } else if (discountType === 'fixed') {
                discountAmount = discountValue;
            } else {
                return { success: false, error: 'Invalid coupon type.' };
            }
            discountAmount = Math.min(discountAmount, subtotal);
            appliedCoupon = {
                id: couponId,
                name: couponData?.name,
                discountType,
                discountValue,
            };
        }

        const totalPrice = Math.max(0, subtotal - discountAmount);

        const finalAppointmentData: any = {
            ...appointmentData,
            userId: resolvedUserId,
            serviceInfo: {
                id: serviceId,
                name: authoritativeServiceData.serviceName,
                price: finalPrice,
                duration: finalDuration,
                imageUrl: authoritativeServiceData.imageUrl || '',
                serviceType: typeof authoritativeServiceData.serviceType === 'string' && authoritativeServiceData.serviceType.trim() ? authoritativeServiceData.serviceType : 'single',
                selectedArea: selectedArea ?? null,
                selectedPackage: selectedPackage ?? null,
                areaIndex: appointmentData.appointmentInfo?.areaIndex ?? null,
                packageIndex: appointmentData.appointmentInfo?.packageIndex ?? null,
                selectedAreaOptions: appointmentData.appointmentInfo?.selectedAreaOptions || [],
                addOns: addOns
            },
            appointmentInfo: {
                ...appointmentData.appointmentInfo,
                duration: finalDuration,
                selectedArea: selectedArea ?? null,
                selectedPackage: selectedPackage ?? null,
                areaIndex: appointmentData.appointmentInfo?.areaIndex ?? null,
                packageIndex: appointmentData.appointmentInfo?.packageIndex ?? null,
                addOns: addOns
            },
            paymentInfo: {
                ...appointmentData.paymentInfo,
                basePrice: finalPrice - addOnsTotal,
                addOnsTotal: addOnsTotal,
                originalPrice: subtotal,
                discount: discountAmount,
                couponId: appliedCoupon?.id || null,
                couponName: appliedCoupon?.name || null,
                totalPrice: totalPrice
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if ('needsCustomerNotification' in finalAppointmentData) {
            delete finalAppointmentData.needsCustomerNotification;
        }
        if (finalAppointmentData.createdBy && typeof finalAppointmentData.createdBy === 'object') {
            finalAppointmentData.createdBy = finalAppointmentData.createdBy.adminName || finalAppointmentData.createdBy.adminId || 'admin';
        }

        const newRef = db.collection('appointments').doc();
        await newRef.set(finalAppointmentData);

        await createOrUpdateCalendarEvent(newRef.id, finalAppointmentData);

        if (appointmentData.customerInfo && (resolvedUserId || appointmentData.customerInfo.phone)) {
            try {
                await findOrCreateCustomer(appointmentData.customerInfo, resolvedUserId);
            } catch (customerError) {
                console.error(`Error creating customer for appointment ${newRef.id}:`, customerError);
            }
        }

        if (appliedCoupon && resolvedUserId) {
            await db.collection('customers').doc(resolvedUserId).collection('coupons').doc(appliedCoupon.id).update({
                used: true,
                usedAt: FieldValue.serverTimestamp(),
                appointmentId: newRef.id
            });
        }

        // Note: New booking Flex Message is now sent via liff.sendMessages() on the client side (general-info/page.tsx)
        // Server-side push for newBooking has been replaced by client-side liff.sendMessages.

        try {
            const notificationData = {
                customerName: finalAppointmentData.customerInfo?.fullName || 'ลูกค้า',
                serviceName: finalAppointmentData.serviceInfo?.name || 'บริการ',
                appointmentDate: date,
                appointmentTime: time,
                totalPrice: finalAppointmentData.paymentInfo?.totalPrice ?? 0
            };
            await sendBookingNotification(notificationData, 'newBooking');
        } catch (notificationError) {
            console.error('Error sending admin notification:', notificationError);
        }

        return { success: true, id: newRef.id };
    } catch (error: any) {
        console.error('Error creating appointment:', error);
        return { success: false, error: error.message };
    }
}

// Admin: Update Status
export async function updateAppointmentStatusByAdmin(appointmentId: string, newStatus: string, note?: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const updateData: any = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (note) updateData.completionNote = note;

        await db.collection('appointments').doc(appointmentId).update(updateData);

        // Fetch settings and appointment snapshot
        const [appSnap, settingsResult] = await Promise.all([
            db.collection('appointments').doc(appointmentId).get(),
            settingsActions.getNotificationSettings()
        ]);

        if (appSnap.exists) {
            const appointment = appSnap.data();
            if (appointment && appointment.userId) {
                const settingsData = settingsResult?.settings || {};
                const notificationsEnabled = settingsData.allNotifications?.enabled;
                const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

                if (customerNotificationsEnabled) {
                    if (newStatus === 'confirmed' && settingsData.customerNotifications?.appointmentConfirmed) {
                        await sendAppointmentConfirmedFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                    } else if (newStatus === 'completed') {
                        if (settingsData.customerNotifications?.serviceCompleted) {
                            await sendServiceCompletedFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                        }
                        if (settingsData.customerNotifications?.reviewRequest) {
                            await sendReviewFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                        }
                    }
                }

                // Award points (only on completed)
                if (newStatus === 'completed') {
                    try {
                        const price = appointment.paymentInfo?.totalPrice || 0;
                        await awardPointsForPurchase(appointment.userId, price);
                        await awardPointsForVisit(appointment.userId);
                    } catch (e) {
                        console.error("Error awarding points:", e);
                    }
                }
            }
            await createOrUpdateCalendarEvent(appointmentId, { ...appointment, status: newStatus } as any);
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Confirm Appointment & Payment (Manual)
export async function confirmAppointmentAndPaymentByAdmin(appointmentId: string, adminId: string, data: { amount: number, method: string }, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const updateData = {
            status: 'confirmed',
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paymentMethod': data.method,
            'paymentInfo.amountPaid': data.amount,
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await db.collection('appointments').doc(appointmentId).update(updateData);

        const [appSnap, settingsResult] = await Promise.all([
            db.collection('appointments').doc(appointmentId).get(),
            settingsActions.getNotificationSettings()
        ]);

        if (appSnap.exists) {
            const appointment = appSnap.data();
            await createOrUpdateCalendarEvent(appointmentId, { ...appointment, status: 'confirmed', paymentInfo: { ...appointment?.paymentInfo, paymentStatus: 'paid' } } as any);

            if (appointment && appointment.userId) {
                const settingsData = settingsResult?.settings || {};
                const notificationsEnabled = settingsData.allNotifications?.enabled;
                const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

                if (customerNotificationsEnabled) {
                    if (settingsData.customerNotifications?.paymentInvoice) {
                        await sendPaymentConfirmationFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                    }
                    if (settingsData.customerNotifications?.appointmentConfirmed) {
                        await sendAppointmentConfirmedFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
                    }
                }
            }
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Send Invoice
export async function sendInvoiceToCustomer(appointmentId: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) throw new Error("Appointment not found");

        const appointment = appSnap.data();
        if (!appointment?.userId) throw new Error("This appointment is not linked to a LINE user.");

        await db.collection('appointments').doc(appointmentId).update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp(),
        });

        const settingsResult = await settingsActions.getNotificationSettings();
        const settingsData = settingsResult?.settings || {};
        const notificationsEnabled = settingsData.allNotifications?.enabled;
        const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

        if (customerNotificationsEnabled && settingsData.customerNotifications?.paymentInvoice) {
            await sendPaymentFlexMessage(appointment.userId, { ...appointment, id: appointmentId });
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Cancel
export async function cancelAppointmentByAdmin(appointmentId: string, reason: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelReason: reason,
            updatedAt: FieldValue.serverTimestamp(),
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: 'admin'
        });

        await deleteCalendarEvent(appointmentId);

        const [appSnap, settingsResult] = await Promise.all([
            db.collection('appointments').doc(appointmentId).get(),
            settingsActions.getNotificationSettings()
        ]);

        if (appSnap.exists) {
            const appData = appSnap.data();
            if (appData?.userId) {
                const settingsData = settingsResult?.settings || {};
                const notificationsEnabled = settingsData.allNotifications?.enabled;
                const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

                if (customerNotificationsEnabled && settingsData.customerNotifications?.appointmentCancelled) {
                    await sendAppointmentCancelledFlexMessage(appData.userId, { id: appointmentId, ...appData }, reason);
                }
            }
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Placeholder for user confirm
export async function confirmAppointmentByUser(appointmentId: string, userId: string, auth?: AuthContext) {
    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };
        const lineUserId = lineAuth.value.userId || userId;
        if (!lineUserId) return { success: false, error: 'Missing LINE user.' };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) return { success: false, error: 'Appointment not found.' };
        const appointment = appSnap.data();
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        await db.collection('appointments').doc(appointmentId).update({
            status: 'confirmed',
            updatedAt: FieldValue.serverTimestamp(),
        });
        // Notify admin
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// User Cancel
export async function cancelAppointmentByUser(appointmentId: string, userId: string, auth?: AuthContext) {
    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };
        const lineUserId = lineAuth.value.userId || userId;
        if (!lineUserId) return { success: false, error: 'Missing LINE user.' };

        const appSnap = await db.collection('appointments').doc(appointmentId).get();
        if (!appSnap.exists) return { success: false, error: 'Appointment not found.' };
        const appointment = appSnap.data();
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        await db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled',
            cancelReason: 'User cancelled',
            updatedAt: FieldValue.serverTimestamp(),
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledBy: 'user'
        });
        await deleteCalendarEvent(appointmentId);
        // Notify admin
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function findAppointmentsByPhone(phoneNumber: string) {
    try {
        const snap = await db.collection('appointments').where('customerInfo.phone', '==', phoneNumber).orderBy('createdAt', 'desc').get();
        return { success: true, appointments: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
    } catch (e: any) { return { success: false, error: e.message, appointments: [] }; }
}
