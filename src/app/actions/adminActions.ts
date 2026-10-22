"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';
import { revalidatePath } from 'next/cache';

/**
 * Fetches all admin users from the 'admins' table.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAllAdmins(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { data: admins, error } = await supabaseAdmin
            .from('admins')
            .select('id, firstName, lastName')
            .order('firstName');

        if (error) throw new Error(error.message);

        return { success: true, admins: admins || [] };
    } catch (error: any) {
        console.error("Error fetching all admins:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches admins with full details from Supabase.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAdmins(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { data: admins, error } = await supabaseAdmin
            .from('admins')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw new Error(error.message);

        const list = (admins || []).map((admin: any) => ({
            id: admin.id,
            ...admin,
            type: 'admin',
        }));

        return { success: true, admins: list };
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
                    const { data: empRecord } = await supabaseAdmin.from('employees').select('id').eq('id', existingAuthUser.id).maybeSingle();
                    const { data: admRecord } = await supabaseAdmin.from('admins').select('id').eq('id', existingAuthUser.id).maybeSingle();

                    if (!empRecord && !admRecord) {
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

        // 2. Insert into admins table
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

        const { error: insertErr } = await supabaseAdmin.from('admins').upsert(adminData);
        if (insertErr) throw new Error(insertErr.message);

        revalidatePath('/employees');
        return { success: true, admin: adminData };
    } catch (error: any) {
        console.error("Error in createAdmin:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes an admin from the 'admins' table.
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

        const { error: delErr } = await supabaseAdmin.from('admins').delete().eq('id', adminId);
        if (delErr) throw new Error(delErr.message);

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

        const cleanData: any = {
            ...updateData,
            phoneNumber: updateData.phoneNumber || updateData.phone,
            updatedAt: new Date().toISOString()
        };
        delete cleanData.phone;

        const { error: updateErr } = await supabaseAdmin.from('admins').update(cleanData).eq('id', adminId);
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
