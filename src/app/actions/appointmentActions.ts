'use server';

import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin';
import { createSystemNotification } from './notificationActions';
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

export async function createAppointmentWithSlotCheck(appointmentData: any, auth?: AuthContext) {
    const { date, time, serviceId, technicianId } = appointmentData;
    if (!date || !time) return { success: false, error: 'กรุณาระบุวันและเวลา' };
    try {
        const supabase = getSupabaseAdmin();
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

        const { data: settingsRow } = await supabase
            .from('settings')
            .select('data')
            .eq('id', 'booking')
            .maybeSingle();

        let maxSlot = 1;
        let useTechnician = false;

        if (settingsRow?.data) {
            const data = settingsRow.data;
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

        let slotQuery = supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('date', date)
            .eq('time', time)
            .in('status', ['pending', 'confirmed', 'awaiting_confirmation', 'blocked']);

        if (useTechnician && technicianId && technicianId !== 'auto-assign') {
            slotQuery = slotQuery.eq('technicianId', technicianId);
            maxSlot = 1;
        }

        const { count: slotCount } = await slotQuery;
        if ((slotCount || 0) >= maxSlot) {
            const errorMsg = useTechnician && technicianId !== 'auto-assign'
                ? 'ช่างท่านนี้ไม่ว่างในช่วงเวลาดังกล่าว'
                : 'ช่วงเวลานี้ถูกจองเต็มแล้ว';
            return { success: false, error: errorMsg };
        }

        const { data: authoritativeServiceData } = await supabase
            .from('services')
            .select('*')
            .eq('id', serviceId)
            .maybeSingle();

        if (!authoritativeServiceData) {
            return { success: false, error: 'ไม่พบบริการที่เลือก' };
        }

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
                    const areaGroup = authoritativeServiceData.areaOptions?.find((g: any) => g.areaName === selected.areaName);
                    if (areaGroup) {
                        const option = areaGroup.options.find((o: any) => o.name === selected.optionName);
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
            const { data: couponData } = await supabase
                .from('coupons')
                .select('*')
                .eq('id', couponId)
                .eq('customerId', resolvedUserId)
                .maybeSingle();

            if (!couponData) {
                return { success: false, error: 'Invalid coupon.' };
            }
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

        const newAppointmentId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `app_${Date.now()}`;
        const finalAppointmentData: any = {
            ...appointmentData,
            id: newAppointmentId,
            userId: resolvedUserId,
            serviceInfo: {
                id: serviceId,
                name: authoritativeServiceData.serviceName || authoritativeServiceData.name,
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if ('needsCustomerNotification' in finalAppointmentData) {
            delete finalAppointmentData.needsCustomerNotification;
        }
        if (finalAppointmentData.createdBy && typeof finalAppointmentData.createdBy === 'object') {
            finalAppointmentData.createdBy = finalAppointmentData.createdBy.adminName || finalAppointmentData.createdBy.adminId || 'admin';
        }

        const { error: insertErr } = await supabase
            .from('appointments')
            .insert(finalAppointmentData);

        if (insertErr) throw new Error(insertErr.message);

        await createOrUpdateCalendarEvent(newAppointmentId, finalAppointmentData);

        if (appointmentData.customerInfo && (resolvedUserId || appointmentData.customerInfo.phone)) {
            try {
                await findOrCreateCustomer(appointmentData.customerInfo, resolvedUserId);
            } catch (customerError) {
                console.error(`Error creating customer for appointment ${newAppointmentId}:`, customerError);
            }
        }

        if (appliedCoupon && resolvedUserId) {
            await supabase
                .from('coupons')
                .update({
                    used: true,
                    usedAt: new Date().toISOString(),
                    appointmentId: newAppointmentId
                })
                .eq('id', appliedCoupon.id);
        }

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

        return { success: true, id: newAppointmentId };
    } catch (error: any) {
        console.error('Error creating appointment:', error);
        return { success: false, error: error.message };
    }
}

// Admin: Update Status (Direct Supabase Native)
export async function updateAppointmentStatusByAdmin(appointmentId: string, newStatus: string, note?: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const supabase = getSupabaseAdmin();
        const updateData: any = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
        };
        if (note) updateData.completionNote = note;

        // Atomic update and fetch in ONE single SQL query via Supabase!
        const { data: appointment, error: updateError } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', appointmentId)
            .select('*')
            .maybeSingle();

        if (updateError) throw new Error(updateError.message);
        if (!appointment) return { success: false, error: 'ไม่พบข้อมูลการจอง' };

        const customerName = appointment?.customerInfo?.fullName || appointment?.customerInfo?.name || 'ลูกค้า';
        const STATUS_MAP: Record<string, string> = {
            awaiting_confirmation: 'รอยืนยัน',
            confirmed: 'ยืนยันคิวแล้ว',
            in_progress: 'กำลังให้บริการ',
            completed: 'บริการเสร็จสิ้น',
            cancelled: 'ยกเลิกคิว',
        };
        const statusLabel = STATUS_MAP[newStatus] || newStatus;

        // Write in-app notification for Admin Bell using native Supabase
        const notifPromise = createSystemNotification({
            title: `อัปเดตสถานะคิว #${appointmentId.slice(0, 6).toUpperCase()}`,
            message: `สถานะเปลี่ยนเป็น "${statusLabel}" (ลูกค้า: ${customerName})`,
            type: newStatus === 'cancelled' ? 'warning' : newStatus === 'completed' ? 'success' : 'info',
            link: `/appointments/${appointmentId}`,
            appointmentId,
        });

        // Background tasks (Points awarding, LINE push Flex messages, Calendar sync)
        (async () => {
            try {
                const recipientUserId = appointment?.userId || appointment?.customerInfo?.lineUserId;
                const settingsResult = await settingsActions.getNotificationSettings();

                if (appointment && recipientUserId) {
                    const settingsData = settingsResult?.settings || {};
                    const notificationsEnabled = settingsData.allNotifications?.enabled;
                    const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

                    let totalPointsAwarded = 0;
                    if (newStatus === 'completed') {
                        try {
                            const price = appointment.paymentInfo?.totalPrice || 0;
                            if (price > 0) {
                                const purchaseRes = await awardPointsForPurchase(recipientUserId, price);
                                if (purchaseRes.success && purchaseRes.pointsAwarded) totalPointsAwarded += purchaseRes.pointsAwarded;
                            }
                            const visitRes = await awardPointsForVisit(recipientUserId);
                            if (visitRes.success && visitRes.pointsAwarded) totalPointsAwarded += visitRes.pointsAwarded;
                        } catch (e) {
                            console.error("Error awarding points in background:", e);
                        }
                    }

                    if (customerNotificationsEnabled) {
                        const payload = {
                            ...appointment,
                            id: appointmentId,
                            appointmentId,
                            note: note || appointment.completionNote,
                            completionNote: note || appointment.completionNote,
                            totalPointsAwarded
                        };

                        if (newStatus === 'confirmed' && settingsData.customerNotifications?.appointmentConfirmed) {
                            await sendAppointmentConfirmedFlexMessage(recipientUserId, payload);
                        } else if (newStatus === 'completed') {
                            const hasServiceCompleted = !!settingsData.customerNotifications?.serviceCompleted;
                            const hasReviewRequest = !!settingsData.customerNotifications?.reviewRequest;

                            if (hasServiceCompleted && hasReviewRequest) {
                                await sendServiceCompletedFlexMessage(recipientUserId, payload, { includeReviewButton: true });
                            } else if (hasServiceCompleted) {
                                await sendServiceCompletedFlexMessage(recipientUserId, payload, { includeReviewButton: false });
                            } else if (hasReviewRequest) {
                                await sendReviewFlexMessage(recipientUserId, payload);
                            }
                        }
                    }
                }
                await createOrUpdateCalendarEvent(appointmentId, { ...appointment, status: newStatus } as any);
            } catch (bgErr) {
                console.error("Error in background post-update tasks:", bgErr);
            }
        })();

        await notifPromise;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Admin: Confirm Appointment & Payment (Direct Supabase Native)
export async function confirmAppointmentAndPaymentByAdmin(appointmentId: string, adminId: string, data: { amount: number, method: string }, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const supabase = getSupabaseAdmin();
        const { data: currentApp, error: fetchErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (fetchErr || !currentApp) {
            return { success: false, error: 'ไม่พบข้อมูลการจอง' };
        }
        const currentPayment = currentApp.paymentInfo || {};

        const updateData = {
            status: 'confirmed',
            paymentInfo: {
                ...currentPayment,
                paymentStatus: 'paid',
                paymentMethod: data.method,
                amountPaid: data.amount,
                paidAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
        };

        // Primary update directly on Supabase!
        const { error: updateErr } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', appointmentId);

        if (updateErr) throw new Error(updateErr.message);

        const customerName = currentApp?.customerInfo?.fullName || currentApp?.customerInfo?.name || 'ลูกค้า';

        // Log in-app notification for Admin Bell using native Supabase
        const notifPromise = createSystemNotification({
            title: `ยืนยันคิวและชำระเงิน #${appointmentId.slice(0, 6).toUpperCase()}`,
            message: `ยืนยันคิวและบันทึกการชำระเงินเรียบร้อยแล้ว (ลูกค้า: ${customerName})`,
            type: 'success',
            link: `/appointments/${appointmentId}`,
            appointmentId,
        });

        // Background tasks (LINE push Flex message, calendar sync)
        (async () => {
            try {
                const settingsResult = await settingsActions.getNotificationSettings();
                await createOrUpdateCalendarEvent(appointmentId, { ...currentApp, status: 'confirmed', paymentInfo: { ...currentPayment, paymentStatus: 'paid' } } as any);

                if (currentApp && currentApp.userId) {
                    const settingsData = settingsResult?.settings || {};
                    const notificationsEnabled = settingsData.allNotifications?.enabled;
                    const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

                    if (customerNotificationsEnabled) {
                        if (settingsData.customerNotifications?.paymentInvoice) {
                            await sendPaymentConfirmationFlexMessage(currentApp.userId, { ...currentApp, id: appointmentId });
                        } else if (settingsData.customerNotifications?.appointmentConfirmed) {
                            await sendAppointmentConfirmedFlexMessage(currentApp.userId, { ...currentApp, id: appointmentId });
                        }
                    }
                }
            } catch (bgErr) {
                console.error("Error in background payment confirmation tasks:", bgErr);
            }
        })();

        await notifPromise;
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

        const supabase = getSupabaseAdmin();
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (fetchErr || !appointment) throw new Error("Appointment not found");
        if (!appointment.userId) throw new Error("This appointment is not linked to a LINE user.");

        const currentPayment = appointment.paymentInfo || {};
        const { error: updateErr } = await supabase
            .from('appointments')
            .update({
                paymentInfo: {
                    ...currentPayment,
                    paymentStatus: 'invoiced',
                },
                updatedAt: new Date().toISOString(),
            })
            .eq('id', appointmentId);

        if (updateErr) throw new Error(updateErr.message);

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

        const supabase = getSupabaseAdmin();
        const nowIso = new Date().toISOString();

        const { data: appData, error: updateErr } = await supabase
            .from('appointments')
            .update({
                status: 'cancelled',
                cancelReason: reason,
                updatedAt: nowIso,
                cancelledAt: nowIso,
                cancelledBy: 'admin'
            })
            .eq('id', appointmentId)
            .select('*')
            .maybeSingle();

        if (updateErr) throw new Error(updateErr.message);

        await deleteCalendarEvent(appointmentId);

        if (appData?.userId) {
            const settingsResult = await settingsActions.getNotificationSettings();
            const settingsData = settingsResult?.settings || {};
            const notificationsEnabled = settingsData.allNotifications?.enabled;
            const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

            if (customerNotificationsEnabled && settingsData.customerNotifications?.appointmentCancelled) {
                await sendAppointmentCancelledFlexMessage(appData.userId, { id: appointmentId, ...appData }, reason);
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

        const supabase = getSupabaseAdmin();
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (fetchErr || !appointment) return { success: false, error: 'Appointment not found.' };
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        const { error: updateErr } = await supabase
            .from('appointments')
            .update({
                status: 'confirmed',
                updatedAt: new Date().toISOString(),
            })
            .eq('id', appointmentId);

        if (updateErr) throw new Error(updateErr.message);

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

        const supabase = getSupabaseAdmin();
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (fetchErr || !appointment) return { success: false, error: 'Appointment not found.' };
        if (appointment?.userId !== lineUserId) {
            return { success: false, error: 'Unauthorized.' };
        }

        const nowIso = new Date().toISOString();
        const { error: updateErr } = await supabase
            .from('appointments')
            .update({
                status: 'cancelled',
                cancelReason: 'User cancelled',
                updatedAt: nowIso,
                cancelledAt: nowIso,
                cancelledBy: 'user'
            })
            .eq('id', appointmentId);

        if (updateErr) throw new Error(updateErr.message);

        await deleteCalendarEvent(appointmentId);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function findAppointmentsByPhone(phoneNumber: string) {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('customerInfo->>phone', phoneNumber)
            .order('createdAt', { ascending: false });

        if (error) throw new Error(error.message);
        return { success: true, appointments: data || [] };
    } catch (e: any) { return { success: false, error: e.message, appointments: [] }; }
}
