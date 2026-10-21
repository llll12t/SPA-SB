"use server";

import { db, FieldValue } from '@/app/lib/supabaseDb';
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
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// --- Helper to get notification settings ---
const getNotificationSettings = async () => {
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    return settingsDoc.exists ? settingsDoc.data() : {};
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
    const snapshot = await db.collection('employees').where('lineUserId', '==', lineUserId).limit(1).get();
    if (!snapshot.empty) {
        return { ok: true, employeeId: snapshot.docs[0].id, lineUserId };
    }

    // 3. ตรวจสอบในตารางผู้ดูแลระบบ (admins) เผื่อแอดมินเป็นผู้ดำเนินการเช็คอินเอง
    const adminSnap = await db.collection('admins').where('lineUserId', '==', lineUserId).limit(1).get();
    if (!adminSnap.empty) {
        return { ok: true, employeeId: adminSnap.docs[0].id, lineUserId, isAdmin: true };
    }

    return { ok: false, error: 'บัญชี LINE นี้ยังไม่ได้ลงทะเบียนเป็นพนักงานหรือผู้ดูแลระบบ' };
};

// --- Registration and Status Updates ---

export async function checkEmployeeStatusByLineId(lineUserId?: string) {
    if (!lineUserId) {
        return { isLinked: false, error: 'ไม่พบ LINE User ID' };
    }

    try {
        // 1. ตรวจสอบในตาราง employees
        const empSnap = await db.collection('employees').where('lineUserId', '==', lineUserId).limit(1).get();
        if (!empSnap.empty) {
            const empData = empSnap.docs[0].data();
            return {
                isLinked: true,
                employee: {
                    id: empSnap.docs[0].id,
                    firstName: empData.firstName || '',
                    lastName: empData.lastName || '',
                    role: 'employee',
                    phoneNumber: empData.phoneNumber || '',
                    photoURL: empData.photoURL || null
                }
            };
        }

        // 2. ตรวจสอบในตาราง admins เผื่อแอดมินเป็นผู้ใช้งาน
        const admSnap = await db.collection('admins').where('lineUserId', '==', lineUserId).limit(1).get();
        if (!admSnap.empty) {
            const admData = admSnap.docs[0].data();
            return {
                isLinked: true,
                employee: {
                    id: admSnap.docs[0].id,
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
        // ค้นหาในพนักงาน (employees)
        const employeesSnap = await db.collection('employees').get();
        const matchedEmpDoc = employeesSnap.docs.find((doc: any) => {
            const data = doc.data();
            const storedPhone = (data.phoneNumber || data.phone || '').replace(/[\s-()]/g, '');
            return storedPhone === cleanInputPhone;
        });

        if (matchedEmpDoc) {
            const empData = matchedEmpDoc.data();
            if (empData.lineUserId === lineUserId) {
                return {
                    success: true,
                    message: 'บัญชี LINE นี้เชื่อมต่อกับพนักงานท่านนี้เรียบร้อยแล้ว',
                    employee: { id: matchedEmpDoc.id, firstName: empData.firstName, lastName: empData.lastName }
                };
            }
            if (empData.lineUserId) {
                return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว (กรุณาแจ้งแอดมินเพื่อรีเซ็ต)' };
            }

            await matchedEmpDoc.ref.update({
                lineUserId: lineUserId,
                updatedAt: new Date().toISOString()
            });

            return {
                success: true,
                message: `เชื่อมต่อสำเร็จ! ยินดีต้อนรับคุณ ${empData.firstName}`,
                employee: { id: matchedEmpDoc.id, firstName: empData.firstName, lastName: empData.lastName }
            };
        }

        // ค้นหาในแอดมิน (admins) เผื่อแอดมินใช้เบอร์ตนเองผูก
        const adminsSnap = await db.collection('admins').get();
        const matchedAdmDoc = adminsSnap.docs.find((doc: any) => {
            const data = doc.data();
            const storedPhone = (data.phoneNumber || data.phone || '').replace(/[\s-()]/g, '');
            return storedPhone === cleanInputPhone;
        });

        if (matchedAdmDoc) {
            const admData = matchedAdmDoc.data();
            if (admData.lineUserId === lineUserId) {
                return {
                    success: true,
                    message: 'บัญชี LINE นี้เชื่อมต่อกับบัญชีผู้ดูแลระบบเรียบร้อยแล้ว',
                    employee: { id: matchedAdmDoc.id, firstName: admData.firstName, lastName: admData.lastName, role: 'admin' }
                };
            }
            if (admData.lineUserId) {
                return { success: false, error: 'เบอร์นี้ถูกผูกกับบัญชี LINE อื่นแล้ว' };
            }

            await matchedAdmDoc.ref.update({
                lineUserId: lineUserId,
                updatedAt: new Date().toISOString()
            });

            return {
                success: true,
                message: `เชื่อมต่อสำเร็จ! ยินดีต้อนรับผู้ดูแลระบบ ${admData.firstName}`,
                employee: { id: matchedAdmDoc.id, firstName: admData.firstName, lastName: admData.lastName, role: 'admin' }
            };
        }

        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบพนักงาน กรุณาตรวจสอบเบอร์ที่ลงทะเบียนไว้' };
    } catch (error: any) {
        console.error("Error registering line ID to employee:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}

export async function updateAppointmentStatus(appointmentId: string, newStatus: string, employeeId: string, auth?: AuthContext) {
    if (!appointmentId || !newStatus || !employeeId) {
        return { success: false, error: 'ข้อมูลไม่ครบถ้วน' };
    }

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };
        const effectiveEmployeeId = employeeAuth.employeeId;

        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) throw new Error("ไม่พบข้อมูลนัดหมาย");

        const appointmentData: any = appointmentDoc.data();
        const settingsData: any = settings || {};
        const notificationsEnabled = settingsData.allNotifications?.enabled;
        const customerNotificationsEnabled = notificationsEnabled && settingsData.customerNotifications?.enabled;

        const updateData: any = {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (newStatus === 'in_progress') {
            updateData['timeline.startedAt'] = FieldValue.serverTimestamp();
            updateData['timeline.checkedInBy'] = effectiveEmployeeId;
        } else if (newStatus === 'completed') {
            updateData['timeline.completedAt'] = FieldValue.serverTimestamp();
        } else if (newStatus === 'cancelled') {
            updateData['timeline.cancelledAt'] = FieldValue.serverTimestamp();
            updateData['timeline.cancelledBy'] = `employee:${effectiveEmployeeId}`;
            updateData['timeline.cancellationReason'] = 'Cancelled by employee';
        }

        await appointmentRef.update(updateData);

        // --- Conditional Notifications ---
        const recipientUserId = appointmentData.userId || appointmentData.customerInfo?.lineUserId;
        if (recipientUserId) {
            const notificationPayload: any = {
                ...appointmentData,
                id: appointmentId,
                appointmentId: appointmentId,
                note: appointmentData.completionNote || appointmentData.note || '',
                completionNote: appointmentData.completionNote || appointmentData.note || '',
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

    const appointmentRef = db.collection('appointments').doc(appointmentId);

    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };
        const effectiveEmployeeId = employeeAuth.employeeId;

        const [appointmentDoc, settings] = await Promise.all([
            appointmentRef.get(),
            getNotificationSettings()
        ]);

        if (!appointmentDoc.exists) {
            throw new Error("ไม่พบข้อมูลนัดหมาย!");
        }
        const appointmentData: any = appointmentDoc.data();
        const settingsData: any = settings || {};

        const currentPayment = appointmentData.paymentInfo || {};
        await appointmentRef.update({
            paymentInfo: {
                ...currentPayment,
                paymentStatus: 'paid',
                paidAt: FieldValue.serverTimestamp(),
                paymentReceivedBy: effectiveEmployeeId,
            },
            updatedAt: FieldValue.serverTimestamp()
        });

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

        const todayStr = new Date().toISOString().split('T')[0];

        const q = db.collection('appointments')
            .where('customerInfo.phone', '==', phoneNumber)
            // [UPDATED] เพิ่มสถานะ 'in_progress' เข้าไปในการค้นหา
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'pending', 'in_progress'])
            .orderBy('date', 'asc')
            .orderBy('time', 'asc');

        const snapshot = await q.get();
        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { success: true, appointments: JSON.parse(JSON.stringify(appointments)) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function findAppointmentById(appointmentId: string, auth?: AuthContext) {
    if (!appointmentId) return { success: false, error: "Appointment ID is required." };
    try {
        const employeeAuth = await requireEmployeeAuth(auth);
        if (!employeeAuth.ok) return { success: false, error: employeeAuth.error };

        const docRef = db.collection('appointments').doc(appointmentId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const appointment = { id: docSnap.id, ...docSnap.data() };
            return { success: true, appointment: JSON.parse(JSON.stringify(appointment)) };
        } else {
            return { success: false, error: "Appointment not found." };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- Admin-related actions ---
export async function promoteEmployeeToAdmin(employeeId: string, auth?: AuthContext) {
    if (!employeeId) {
        return { success: false, error: 'Employee ID is required.' };
    }

    const employeeRef = db.collection('employees').doc(employeeId);
    const adminRef = db.collection('admins').doc(employeeId);

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await db.runTransaction(async (transaction: any) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists) {
                throw new Error("ไม่พบข้อมูลพนักงานคนดังกล่าว");
            }
            const employeeData = employeeDoc.data();
            const adminData = {
                ...employeeData,
                role: 'admin',
                promotedAt: FieldValue.serverTimestamp(),
            };
            transaction.set(adminRef, adminData);
            transaction.delete(employeeRef);
        });

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
                // Check if user already exists in auth but not in employees table (recovering from previous failed attempts)
                const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
                const existingAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === data.email.toLowerCase());

                if (existingAuthUser) {
                    const empDoc = await db.collection('employees').doc(existingAuthUser.id).get();
                    const admDoc = await db.collection('admins').doc(existingAuthUser.id).get();

                    if (!empDoc.exists && !admDoc.exists) {
                        // Orphaned auth user - update password and user_metadata
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

        const docRef = db.collection('employees').doc(userId);
        await docRef.set(employeeData);

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

        const docRef = db.collection('employees').doc(employeeId);
        const cleanData: any = {
            ...updateData,
            phoneNumber: updateData.phoneNumber || updateData.phone,
            updatedAt: new Date().toISOString()
        };
        delete cleanData.phone;

        await docRef.update(cleanData);

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

        const employeesRef = db.collection('employees');
        const employeeSnapshot = await employeesRef.get();

        const employees = employeeSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'employee',
        }));

        const sortedEmployees = employees.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return dateB - dateA;
        });

        return { success: true, employees: JSON.parse(JSON.stringify(sortedEmployees)) };
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

        const docRef = db.collection('employees').doc(employeeId);
        await docRef.delete();
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

        const docRef = db.collection('employees').doc(employeeId);
        await docRef.update({
            status: status,
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating employee ${employeeId} status:`, error);
        return { success: false, error: error.message };
    }
}
