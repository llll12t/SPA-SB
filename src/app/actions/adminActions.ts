"use server";

import { db } from '@/app/lib/supabaseDb';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';
import { revalidatePath } from 'next/cache';

/**
 * Fetches all admin users from the 'admins' collection.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAllAdmins(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const adminsRef = db.collection('admins');
        const snapshot = await adminsRef.orderBy('firstName').get();

        if (snapshot.empty) {
            return { success: true, admins: [] };
        }

        const admins = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id, // ใช้ uid ที่เป็น document id
                firstName: data.firstName,
                lastName: data.lastName
            };
        });

        return { success: true, admins: JSON.parse(JSON.stringify(admins)) };
    } catch (error: any) {
        console.error("Error fetching all admins:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches admins with full details from Firestore.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAdmins(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const adminsRef = db.collection('admins');
        const adminSnapshot = await adminsRef.get();

        const admins = adminSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'admin', // เพิ่ม property 'type' เพื่อระบุประเภท
        }));

        // เรียงลำดับตามวันที่สร้างล่าสุด
        const sortedAdmins = admins.sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return dateB - dateA;
        });

        return { success: true, admins: JSON.parse(JSON.stringify(sortedAdmins)) };
    } catch (error: any) {
        console.error("Error fetching admins:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Creates a new admin user in Supabase Auth and admins table
 */
export async function createAdmin(data: {
    firstName: string;
    lastName?: string;
    phone: string;
    email: string;
    password: string;
    lineUserId?: string;
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
                role: 'admin',
            }
        });

        if (authError) {
            console.error("Error creating auth user for admin:", authError);
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
                const existingAuthUser = usersData?.users?.find(u => u.email?.toLowerCase() === data.email.toLowerCase());

                if (existingAuthUser) {
                    const empDoc = await db.collection('employees').doc(existingAuthUser.id).get();
                    const admDoc = await db.collection('admins').doc(existingAuthUser.id).get();

                    if (!empDoc.exists && !admDoc.exists) {
                        await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
                            password: data.password,
                            email_confirm: true,
                            user_metadata: {
                                displayName: `${data.firstName} ${data.lastName || ''}`.trim(),
                                photoURL: data.photoURL || null,
                                role: 'admin'
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

        // 2. Insert into admins collection
        const adminData = {
            id: userId,
            uid: userId,
            firstName: data.firstName,
            lastName: data.lastName || '',
            phoneNumber: data.phone,
            email: data.email,
            lineUserId: data.lineUserId || null,
            photoURL: data.photoURL || null,
            role: 'admin',
            status: 'available',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = db.collection('admins').doc(userId);
        await docRef.set(adminData);

        revalidatePath('/employees');
        return { success: true, admin: adminData };
    } catch (error: any) {
        console.error("Error in createAdmin:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes an admin from the 'admins' collection.
 * @param {string} adminId - The UID of the admin to delete.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteAdmin(adminId: string, auth?: AuthContext) {
    if (!adminId) {
        return { success: false, error: 'Admin ID is required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const docRef = db.collection('admins').doc(adminId);
        await docRef.delete();
        try {
            await supabaseAdmin.auth.admin.deleteUser(adminId);
        } catch (e) {
            console.warn(`Could not delete auth user ${adminId}:`, e);
        }
        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting admin ${adminId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates admin information
 * @param {string} adminId - The UID of the admin to update.
 * @param {object} updateData - Data to update.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAdmin(adminId: string, updateData: any, auth?: AuthContext) {
    if (!adminId || !updateData) {
        return { success: false, error: 'Admin ID and update data are required.' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const docRef = db.collection('admins').doc(adminId);
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
                await supabaseAdmin.auth.admin.updateUserById(adminId, {
                    user_metadata: metadata
                });
            }
        } catch (e) {
            console.warn('Could not update auth user metadata:', e);
        }

        revalidatePath('/employees');
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating admin ${adminId}:`, error);
        return { success: false, error: error.message };
    }
}
