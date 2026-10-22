"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import {
    sendBookingNotification
} from './lineActions';
import {
    sendServiceCompletedFlexMessage,
    sendReviewFlexMessage,
    sendPaymentConfirmationFlexMessage
} from './lineFlexActions';
import { awardPointsForPurchase, awardPointsForVisit } from './pointActions';
import { findOrCreateCustomer } from './customerActions';
import { createSystemNotification } from './notificationActions';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// --- Helper to get notification settings ---
const getNotificationSettings = async () => {
    try {
        const { data } = await supabaseAdmin.from('settings').select('data').eq('id', 'notifications').maybeSingle();
        return data?.data || {};
    } catch {
        return {};
    }
};

const requireEmployeeAuth = async (auth?: AuthContext) => {
    // 1. อนุญาตให้ bypass อัตโนมัติหากอยู่ในโหมด Development
    if (process.env.NODE_ENV !== 'production') {
        return { ok: true, employeeId: 'dev-employee', lineUserId: 'dev-user', isDevFallback: true };
    }

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) {
        return { ok: false, error: lineAuth.error };
    }
    const lineUserId = lineAuth.value.userId;
    if (!lineUserId) {
        return { ok: false, error: 'ไม่พบข้อมูลบัญชีผู้ใช้ LINE' };
    }

    // 2. ตรวจสอบในตารางพนักงาน (employees)
    const { data: emp } = await supabaseAdmin.from('employees').select('id').eq('lineUserId', lineUserId).limit(1).maybeSingle();
    if (emp) {
        return { ok: true, employeeId: emp.id, lineUserId };
    }

    // 3. ตรวจสอบในตารางผู้ดูแลระบบ (admins) เผื่อแอดมินเป็นผู้ดำเนินการเช็คอินเอง
    const { data: adm } = await supabaseAdmin.from('admins').select('id').eq('lineUserId', lineUserId).limit(1).maybeSingle();
    if (adm) {
        return { ok: true, employeeId: adm.id, lineUserId, isAdmin: true };
    }

    return { ok: false, error: 'บัญชี LINE นี้ยังไม่ได้ลงทะเบียนเป็นพนักงานหรือผู้ดูแลระบบ' };
};

// --- Registration and Status Updates ---

export async function checkEmployeeStatusByLineId(lineUserId?: string) {
    if (!lineUserId) {
        return { isLinked: false, error: 'ไม่พบ LINE User ID' };
    }

    try {
        // Query both employees and admins in parallel for instant response
        const [{ data: empData }, { data: admData }] = await Promise.all([
            supabaseAdmin.from('employees').select('id, firstName, lastName, phoneNumber, photoURL').eq('lineUserId', lineUserId).limit(1).maybeSingle(),
            supabaseAdmin.from('admins').select('id, firstName, lastName, phoneNumber, photoURL').eq('lineUserId', lineUserId).limit(1).maybeSingle()
        ]);

        if (empData) {
            return {
                isLinked: true,
                employee: {
                    id: empData.id,
                    firstName: empData.firstName || '',
                    lastName: empData.lastName || '',
                    role: 'employee',
                    phoneNumber: empData.phoneNumber || '',
                    photoURL: empData.photoURL || null
                }
            };
        }

        if (admData) {
            return {
                isLinked: true,
                employee: {
                    id: admData.id,
                    firstName: admData.firstName || '',
                    lastName: admData.lastName || '',
                    role: 'admin',
                    phoneNumber: admData.phoneNumber || '',
                    photoURL: admData.photoURL || null
                }
            };
        }

        return { isLinked: false };
    } catch (error: any) {
        console.error("Error checking employee LINE status:", error);
        return { isLinked: false, error: error.message };
    }
}

export async function registerLineIdToEmployee(phoneNumber: string, lineUserId: string) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'กรุณากรอกเบอร์โทรศัพท์และระบุ LINE User ID' };
    }

    const cleanInputPhone = phoneNumber.replace(/[\s-()]/g, '');

    try {
        // 1. ค้นหาในพนักงาน (employees) แบบ Targeted Query
        const { data: matchedEmp } = await supabaseAdmin
            .from('employees')
            .select('*')
            .or(`phoneNumber.eq.${cleanInputPhone},phoneNumber.eq.${phoneNumber}`)
            .limit(1)
            .maybeSingle();

        if (matchedEmp) {
            if (matchedEmp.lineUserId === lineUserId) {
                return {
                    success: true,
                    message: 'บัญชี LINE นี้เชื่อมต่อกับพนักงานท่านนี้เรียบร้อยแล้ว',
                    employee: { id: matchedEmp.id, firstName: matchedEmp.firstName, lastName: matchedEmp.lastName }
                };
            }
            if (matchedEmp.lineUserId) {
                return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว (กรุณาแจ้งแอดมินเพื่อรีเซ็ต)' };
            }

            await supabaseAdmin.from('employees').update({
                lineUserId: lineUserId,
                updatedAt: new Date().toISOString()
            }).eq('id', matchedEmp.id);

            return {
                success: true,
                message: `เชื่อมต่อสำเร็จ! ยินดีต้อนรับคุณ ${matchedEmp.firstName}`,
                employee: { id: matchedEmp.id, firstName: matchedEmp.firstName, lastName: matchedEmp.lastName }
            };
        }

        // 2. ค้นหาในแอดมิน (admins) แบบ Targeted Query
        const { data: matchedAdm } = await supabaseAdmin
            .from('admins')
            .select('*')
            .or(`phoneNumber.eq.${cleanInputPhone},phoneNumber.eq.${phoneNumber}`)
            .limit(1)
            .maybeSingle();

        if (matchedAdm) {
            if (matchedAdm.lineUserId === lineUserId) {
                return {
                    success: true,
                    message: 'บัญชี LINE นี้เชื่อมต่อกับบัญชีผู้ดูแลระบบเรียบร้อยแล้ว',
                    employee: { id: matchedAdm.id, firstName: matchedAdm.firstName, lastName: matchedAdm.lastName, role: 'admin' }
                };
            }
            if (matchedAdm.lineUserId) {
                return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว' };
            }

            await supabaseAdmin.from('admins').update({
                lineUserId: lineUserId,
                updatedAt: new Date().toISOString()
            }).eq('id', matchedAdm.id);

            return {
                success: true,
                message: `เชื่อมต่อสำเร็จ! ยินดีต้อนรับผู้ดูแลระบบ ${matchedAdm.firstName}`,
                employee: { id: matchedAdm.id, firstName: matchedAdm.firstName, lastName: matchedAdm.lastName, role: 'admin' }
            };
        }

        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบพนักงาน กรุณาตรวจสอบเบอร์ที่ลงทะเบียนไว้' };

    } catch (error: any) {
        console.error("Error registering line ID to employee:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}

export async function updateAppointmentStatus(
    appointmentId: string, 
    newStatus: string, 
    employeeId: string, 
    noteOrAuth?: string | AuthContext, 
    maybeAuth?: AuthContext
) {
    if (!appointmentId || !newStatus || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    let note: string | undefined;
    let auth: AuthContext | undefined;
    if (typeof noteOrAuth === 'string') {
        note = noteOrAuth;
        auth = maybeAuth;
    } else if (noteOrAuth && typeof noteOrAuth === 'object') {
        auth = noteOrAuth;
    }

    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };
        const effectiveEmployeeId = employeeAuth.employeeId;

        const [appRes, settings] = await Promise.all([
            supabaseAdmin.from('appointments').select('*').eq('id', appointmentId).maybeSingle(),
            getNotificationSettings()
        ]);

        if (!appRes.data) throw new Error("ไม่พบข้อมูลนัดหมาย");

        const appointmentData: any = appRes.data;
        const settingsData: any = settings || {};
        const notificationsEnabled = settingsData.allNotifications?.enabled;
        const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

        const nowIso = new Date().toISOString();
        const timeline: any = { ...(appointmentData.timeline || {}) };
        const updateData: any = {
            status: newStatus,
            updatedAt: nowIso,
        };

        if (newStatus === 'in_progress') {
            timeline.startedAt = nowIso;
            timeline.checkedInBy = effectiveEmployeeId;
        } else if (newStatus === 'completed') {
            timeline.completedAt = nowIso;
            if (note !== undefined) {
                updateData.completionNote = note;
            }
        } else if (newStatus === 'cancelled') {
            timeline.cancelledAt = nowIso;
            timeline.cancelledBy = `employee:${effectiveEmployeeId}`;
            timeline.cancellationReason = 'Cancelled by employee';
        }
        updateData.timeline = timeline;

        const { error: updateErr } = await supabaseAdmin.from('appointments').update(updateData).eq('id', appointmentId);
        if (updateErr) throw new Error(updateErr.message);

        // Fast in-app notification write via native Supabase
        const notifPromise = (async () => {
            try {
                const STATUS_MAP: Record<string, string> = {
                    in_progress: 'เริ่มให้บริการ (เช็คอิน)',
                    completed: 'บริการเสร็จสิ้น',
                    cancelled: 'ยกเลิกคิว',
                };
                const statusLabel = STATUS_MAP[newStatus] || newStatus;
                const customerName = appointmentData.customerInfo?.fullName || appointmentData.customerInfo?.name || 'ลูกค้า';
                await createSystemNotification({
                    title: `พนักงานอัปเดตคิว #${appointmentId.slice(0, 6).toUpperCase()}`,
                    message: `สถานะเป็น "${statusLabel}" (ลูกค้า: ${customerName})`,
                    type: newStatus === 'cancelled' ? 'warning' : 'success',
                    link: `/appointments/${appointmentId}`,
                    appointmentId,
                });
            } catch (notifErr) {
                console.error("Error logging in-app notification:", notifErr);
            }
        })();

        // Background asynchronous execution for points and LINE Flex push
        (async () => {
            try {
                const recipientUserId = appointmentData.userId || appointmentData.customerInfo?.lineUserId;
                if (recipientUserId) {
                    const effectiveNote = note !== undefined ? note : (appointmentData.completionNote || appointmentData.note || '');
                    const notificationPayload: any = {
                        ...appointmentData,
                        id: appointmentId,
                        appointmentId: appointmentId,
                        note: effectiveNote,
                        completionNote: effectiveNote,
                    };

                    if (newStatus === 'completed') {
                        const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
                        let totalPointsAwarded = 0;
                        if (totalPrice > 0) {
                            const purchasePointsResult = await awardPointsForPurchase(recipientUserId, totalPrice);
                            if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
                        }
                        const visitPointsResult = await awardPointsForVisit(recipientUserId);
                        if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;

                        notificationPayload.totalPointsAwarded = totalPointsAwarded;

                        if (customerNotificationsEnabled) {
                            const hasServiceCompleted = !!settingsData.customerNotifications?.serviceCompleted;
                            const hasReviewRequest = !!settingsData.customerNotifications?.reviewRequest;

                            if (hasServiceCompleted && hasReviewRequest) {
                                await sendServiceCompletedFlexMessage(recipientUserId, notificationPayload, { includeReviewButton: true });
                            } else if (hasServiceCompleted) {
                                await sendServiceCompletedFlexMessage(recipientUserId, notificationPayload, { includeReviewButton: false });
                            } else if (hasReviewRequest) {
                                await sendReviewFlexMessage(recipientUserId, notificationPayload);
                            }
                        }
                    }
                }

                if (appointmentData.customerInfo && (appointmentData.userId || appointmentData.customerInfo.phone)) {
                    await findOrCreateCustomer(appointmentData.customerInfo, appointmentData.userId);
                }
            } catch (bgErr) {
                console.error("Error in background post-employee status update:", bgErr);
            }
        })();

        await notifPromise;
        return { success: true };
    } catch (error: any) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: error.message };
    }
}

export async function updatePaymentStatusByEmployee(appointmentId: string, employeeId: string, auth?: AuthContext) {
    if (!appointmentId || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };
        const effectiveEmployeeId = employeeAuth.employeeId;

        const [appRes, settings] = await Promise.all([
            supabaseAdmin.from('appointments').select('*').eq('id', appointmentId).maybeSingle(),
            getNotificationSettings()
        ]);

        if (!appRes.data) {
            throw new Error("ไม่พบข้อมูลนัดหมาย!");
        }
        const appointmentData: any = appRes.data;
        const settingsData: any = settings || {};

        const currentPayment = appointmentData.paymentInfo || {};
        const { error: updateErr } = await supabaseAdmin.from('appointments').update({
            paymentInfo: {
                ...currentPayment,
                paymentStatus: 'paid',
                paidAt: new Date().toISOString(),
                paymentReceivedBy: effectiveEmployeeId,
            },
            updatedAt: new Date().toISOString()
        }).eq('id', appointmentId);

        if (updateErr) throw new Error(updateErr.message);

        const userId = appointmentData.userId;
        const totalPrice = appointmentData.paymentInfo?.totalPrice || 0;
        let totalPointsAwarded = 0;

        if (userId) {
            if (totalPrice > 0) {
                const purchasePointsResult = await awardPointsForPurchase(userId, totalPrice);
                if (purchasePointsResult.success) totalPointsAwarded += purchasePointsResult.pointsAwarded || 0;
            }
            const visitPointsResult = await awardPointsForVisit(userId);
            if (visitPointsResult.success) totalPointsAwarded += visitPointsResult.pointsAwarded || 0;
        }

        // --- Conditional Admin Notification ---
        const adminNotificationsEnabled = settingsData.allNotifications?.enabled && settingsData.adminNotifications?.enabled;
        if (adminNotificationsEnabled && settingsData.adminNotifications?.paymentReceived) {
            try {
                const notificationData = {
                    customerName: appointmentData.customerInfo?.fullName || 'ลูกค้า',
                    serviceName: appointmentData.serviceInfo?.name || 'บริการ',
                    appointmentDate: appointmentData.date,
                    appointmentTime: appointmentData.time,
                    totalPrice: appointmentData.paymentInfo.totalPrice
                };
                await sendBookingNotification(notificationData, 'paymentReceived');
            } catch (notificationError) {
                console.error('Error sending payment notification to admin:', notificationError);
            }
        }

        // --- Conditional Customer Notification for Payment ---
        const customerNotificationsEnabled = settingsData.allNotifications?.enabled && settingsData.customerNotifications?.enabled;
        if (customerNotificationsEnabled && settingsData.customerNotifications?.paymentInvoice && userId) {
            try {
                const payload = { ...appointmentData, id: appointmentId, appointmentId: appointmentId };
                await sendPaymentConfirmationFlexMessage(userId, payload);
            } catch (notificationError) {
                console.error('Error sending payment invoice to customer:', notificationError);
            }
        }

        return {
            success: true,
            pointsAwarded: totalPointsAwarded
        };

    } catch (error: any) {
        console.error("Error updating payment status by employee:", error);
        return { success: false, error: error.message };
    }
}

// --- Appointment Lookups ---

export async function findAppointmentsByPhone(phoneNumber: string, auth?: AuthContext) {
    if (!phoneNumber) return { success: false, error: "Phone number is required." };
    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };

        const { data, error } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('customerInfo->>phone', phoneNumber)
            .in('status', ['confirmed', 'awaiting_confirmation', 'pending', 'in_progress'])
            .order('date', { ascending: true })
            .order('time', { ascending: true });

        if (error) throw new Error(error.message);
        return { success: true, appointments: data || [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function findAppointmentById(appointmentId: string, auth?: AuthContext) {
    if (!appointmentId) return { success: false, error: "Appointment ID is required." };
    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };

        const { data: rawData, error } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (error || !rawData) {
            return { success: false, error: "Appointment not found." };
        }

        const serviceId = rawData?.serviceId || rawData?.serviceInfo?.id;
        let serviceDetails: any = null;
        if (serviceId) {
            try {
                const { data: sData } = await supabaseAdmin
                    .from('services')
                    .select('*')
                    .eq('id', serviceId)
                    .maybeSingle();
                serviceDetails = sData;
            } catch (e) {
                console.error("Error fetching service details:", e);
            }
        }

        const appointmentData: any = {
            ...rawData,
        };

        if (serviceDetails?.completionNote) {
            appointmentData.serviceInfo = {
                ...appointmentData.serviceInfo,
                completionNote: appointmentData.serviceInfo?.completionNote || serviceDetails.completionNote,
            };
        }

        const appointment = {
            id: rawData.id,
            ...appointmentData,
            serviceDetails: serviceDetails || undefined,
        };
        return { success: true, appointment };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Admin-related actions ---
export async function promoteEmployeeToAdmin(employeeId: string, auth?: AuthContext) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { data: employeeData, error: empErr } = await supabaseAdmin
            .from('employees')
            .select('*')
            .eq('id', employeeId)
            .maybeSingle();

        if (empErr || !employeeData) {
            throw new Error("ไม่พบข้อมูลพนักงานคนดังกล่าว");
        }

        const adminData = {
            ...employeeData,
            role: 'admin',
            promotedAt: new Date().toISOString(),
        };

        const { error: insErr } = await supabaseAdmin.from('admins').upsert(adminData);
        if (insErr) throw new Error(insErr.message);

        const { error: delErr } = await supabaseAdmin.from('employees').delete().eq('id', employeeId);
        if (delErr) throw new Error(delErr.message);

        try {
            await supabaseAdmin.auth.admin.updateUserById(employeeId, {
                user_metadata: { role: 'admin' }
            });
        } catch (e) {
            console.warn('Could not update auth role for promoted employee:', e);
        }

        revalidatePath('/employees');
        revalidatePath(`/employees/${employeeId}`);

        return { success: true };
    } catch (error: any) {
        console.error("Error promoting employee:", error);
        return { success: false, error: error.message };
    }
}

export async function createEmployee(data: {
    firstName: string;
    lastName?: string;
    phone: string;
    email: string;
    password: string;
    lineUserId?: string;
    status?: 'available' | 'on_leave' | 'suspended';
    photoURL?: string | null;
}, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        if (!data.email || !data.password || !data.firstName || !data.phone) {
            return { success: false, error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' };
        }

        let userId: string;

        // 1. Create auth user with supabaseAdmin
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                displayName: `${data.firstName} ${data.lastName || ''}`.trim(),
                photoURL: data.photoURL || null,
                role: 'employee',
            }
        });

        if (authError) {
            console.error("Error creating auth user for employee:", authError);
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
                const existingAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === data.email.toLowerCase());

                if (existingAuthUser) {
                    const { data: empRecord } = await supabaseAdmin.from('employees').select('id').eq('id', existingAuthUser.id).maybeSingle();
                    const { data: admRecord } = await supabaseAdmin.from('admins').select('id').eq('id', existingAuthUser.id).maybeSingle();

                    if (!empRecord && !admRecord) {
                        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
                            password: data.password,
                            email_confirm: true,
                            user_metadata: {
                                displayName: `${data.firstName} ${data.lastName || ''}`.trim(),
                                photoURL: data.photoURL || null,
                                role: 'employee'
                            }
                        });
                        userId = existingAuthUser.id;
                    } else {
                        return { success: false, error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' };
                    }
                } else {
                    return { success: false, error: 'อีเมลนี้ถูกใช้งานในระบบแล้ว' };
                }
            } else {
                return { success: false, error: authError.message };
            }
        } else {
            userId = authData.user.id;
        }

        // 2. Insert into employees collection
        const employeeData = {
            id: userId,
            uid: userId,
            firstName: data.firstName,
            lastName: data.lastName || '',
            phoneNumber: data.phone,
            email: data.email,
            lineUserId: data.lineUserId || null,
            photoURL: data.photoURL || null,
            role: 'employee',
            status: data.status || 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const { error: insertErr } = await supabaseAdmin.from('employees').upsert(employeeData);
        if (insertErr) throw new Error(insertErr.message);

        revalidatePath('/employees');
        return { success: true, employee: employeeData };
    } catch (error: any) {
        console.error("Error in createEmployee:", error);
        return { success: false, error: error.message };
    }
}

export async function updateEmployee(employeeId: string, updateData: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    phone?: string;
    lineUserId?: string;
    status?: 'available' | 'on_leave' | 'suspended';
    photoURL?: string | null;
}, auth?: AuthContext) {
    if (!employeeId || !updateData) {
        return { success: false, error: 'Employee ID and update data are required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const cleanData: any = {
            ...updateData,
            phoneNumber: updateData.phoneNumber || updateData.phone,
            updatedAt: new Date().toISOString()
        };
        delete cleanData.phone;

        const { error: updateErr } = await supabaseAdmin.from('employees').update(cleanData).eq('id', employeeId);
        if (updateErr) throw new Error(updateErr.message);

        // Update auth user metadata if name/photoURL changed
        try {
            const metadata: any = {};
            if (updateData.firstName) {
                metadata.displayName = `${updateData.firstName} ${updateData.lastName || ''}`.trim();
            }
            if (updateData.photoURL !== undefined) {
                metadata.photoURL = updateData.photoURL;
            }
            if (Object.keys(metadata).length > 0) {
                await supabaseAdmin.auth.admin.updateUserById(employeeId, {
                    user_metadata: metadata
                });
            }
        } catch (e) {
            console.warn('Could not update auth user metadata:', e);
        }

        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating employee ${employeeId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function fetchEmployees(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { data: employees, error } = await supabaseAdmin
            .from('employees')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw new Error(error.message);

        const list = (employees || []).map((emp: any) => ({
            id: emp.id,
            ...emp,
            type: 'employee',
        }));

        return { success: true, employees: list };
    } catch (error: any) {
        console.error("Error fetching employees:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteEmployee(employeeId: string, auth?: AuthContext) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { error: delErr } = await supabaseAdmin.from('employees').delete().eq('id', employeeId);
        if (delErr) throw new Error(delErr.message);

        try {
            await supabaseAdmin.auth.admin.deleteUser(employeeId);
        } catch (e) {
            console.warn(`Could not delete auth user ${employeeId}:`, e);
        }
        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting employee ${employeeId}:`, error);
        return { success: false, error: error.message };
    }
}

export async function updateEmployeeStatus(employeeId: string, status: string, auth?: AuthContext) {
    if (!employeeId || !status) {
        return { success: false, error: 'Employee ID and status are required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { error: updateErr } = await supabaseAdmin.from('employees').update({
            status: status,
            updatedAt: new Date().toISOString()
        }).eq('id', employeeId);

        if (updateErr) throw new Error(updateErr.message);

        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating employee ${employeeId} status:`, error);
        return { success: false, error: error.message };
    }
}
