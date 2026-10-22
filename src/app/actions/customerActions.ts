"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { mergePointsFromPhone, checkPhonePointsForMerge } from './pointMergeActions';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export interface CustomerData {
    phone?: string;
    fullName?: string;
    email?: string;
    points?: number;
    userId?: string;
    [key: string]: any;
}

/**
 * Find or create customer with automatic points merging when LINE ID is connected
 */
export async function findOrCreateCustomer(customerData: CustomerData, userId?: string) {
    if (!customerData?.phone && !userId) {
        return {
            success: false,
            error: 'Phone number or User ID is required.'
        };
    }

    try {
        let existingCustomer: any = null;

        // Prioritize finding customer by LINE User ID if available
        if (userId) {
            const { data } = await supabaseAdmin
                .from('customers')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            existingCustomer = data;
        } else if (customerData.phone) {
            const cleanPhone = customerData.phone.replace(/[\s-()]/g, '');
            const { data } = await supabaseAdmin
                .from('customers')
                .select('*')
                .or(`phone.eq.${cleanPhone},phoneNumber.eq.${cleanPhone}`)
                .limit(1)
                .maybeSingle();
            existingCustomer = data;
        }

        let customerId: string;
        let mergedPoints = 0;
        const nowIso = new Date().toISOString();

        if (existingCustomer) {
            // Customer Found
            customerId = existingCustomer.id;
            const updateData: any = {
                updatedAt: nowIso,
            };

            if (customerData.fullName) updateData.fullName = customerData.fullName;
            if (customerData.email) updateData.email = customerData.email;
            if (customerData.phone) {
                const cleanPhone = customerData.phone.replace(/[\s-()]/g, '');
                updateData.phone = cleanPhone;
                updateData.phoneNumber = cleanPhone;
            }

            if (userId && customerData.phone && !existingCustomer.userId) {
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);
                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);
                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints || 0;
                        updateData.mergedFromPhone = true;
                        updateData.mergedPoints = mergedPoints;
                        updateData.mergedAt = nowIso;
                    }
                }
                updateData.userId = userId;
            }

            await supabaseAdmin
                .from('customers')
                .update(updateData)
                .eq('id', customerId);

        } else {
            // Customer Not Found - Create New
            if (userId && customerData.phone) {
                const phonePointsCheck = await checkPhonePointsForMerge(customerData.phone);
                if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
                    const mergeResult = await mergePointsFromPhone(userId, customerData.phone);
                    if (mergeResult.success) {
                        mergedPoints = mergeResult.mergedPoints || 0;
                    }
                }
            }

            const cleanPhone = customerData.phone ? customerData.phone.replace(/[\s-()]/g, '') : null;
            const targetId = userId || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cust_${Date.now()}`);
            const newCustomerData = {
                id: targetId,
                fullName: customerData.fullName || '',
                phone: cleanPhone,
                phoneNumber: cleanPhone,
                email: customerData.email || '',
                userId: userId || null,
                points: mergedPoints,
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? nowIso : null,
                createdAt: nowIso,
                updatedAt: nowIso,
            };

            await supabaseAdmin
                .from('customers')
                .upsert(newCustomerData);

            customerId = targetId;
        }

        return {
            success: true,
            customerId,
            mergedPoints
        };

    } catch (error: any) {
        console.error("Error in findOrCreateCustomer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Connect LINE ID to existing customer by phone number
 */
export async function connectLineToCustomer(phoneNumber: string, userId: string, additionalData: any = {}, auth?: AuthContext) {
    const adminAuth = await requireAdminAuth(auth);
    if (!adminAuth.ok) {
        return { success: false, error: adminAuth.error };
    }
    return connectLineToCustomerInternal(phoneNumber, userId, additionalData);
}

export async function connectLineToCustomerInternal(phoneNumber: string, userId: string, additionalData: any = {}) {
    if (!phoneNumber || !userId) {
        return {
            success: false,
            error: 'เบอร์โทรศัพท์และ LINE User ID จำเป็นต้องระบุ'
        };
    }

    const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');

    try {
        const { data: existingLineCustomer } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (existingLineCustomer) {
            return {
                success: false,
                error: 'LINE ID นี้ถูกใช้งานแล้ว'
            };
        }

        const { data: phoneCustomers } = await supabaseAdmin
            .from('customers')
            .select('*')
            .or(`phone.eq.${cleanPhone},phoneNumber.eq.${cleanPhone}`)
            .limit(1);

        const existingCustomer = phoneCustomers && phoneCustomers.length > 0 ? phoneCustomers[0] : null;
        let mergedPoints = 0;
        const nowIso = new Date().toISOString();

        if (existingCustomer) {
            if (existingCustomer.userId) {
                return {
                    success: false,
                    error: 'ลูกค้ารายนี้มี LINE ID เชื่อมต่ออยู่แล้ว'
                };
            }

            const newCustomerData = {
                ...existingCustomer,
                ...additionalData,
                id: userId,
                userId: userId,
                phone: cleanPhone,
                phoneNumber: cleanPhone,
                connectedLineAt: nowIso,
                updatedAt: nowIso,
            };

            await supabaseAdmin.from('customers').upsert(newCustomerData);
            if (existingCustomer.id !== userId) {
                await supabaseAdmin.from('customers').delete().eq('id', existingCustomer.id);
            }
        }

        const phonePointsCheck = await checkPhonePointsForMerge(cleanPhone);
        if (phonePointsCheck.success && phonePointsCheck.hasPoints) {
            const mergeResult = await mergePointsFromPhone(userId, cleanPhone);
            if (mergeResult.success) {
                mergedPoints = mergeResult.mergedPoints || 0;
                const { data: cur } = await supabaseAdmin.from('customers').select('points').eq('id', userId).maybeSingle();
                const curPts = Number(cur?.points) || 0;
                await supabaseAdmin
                    .from('customers')
                    .update({
                        mergedFromPhone: true,
                        mergedPoints: mergedPoints,
                        mergedAt: nowIso,
                        points: curPts + mergedPoints,
                        updatedAt: nowIso,
                    })
                    .eq('id', userId);
            }
        }

        if (!existingCustomer) {
            const newCustomerData = {
                id: userId,
                fullName: additionalData.fullName || '',
                phone: cleanPhone,
                phoneNumber: cleanPhone,
                email: additionalData.email || '',
                userId: userId,
                points: mergedPoints,
                mergedFromPhone: mergedPoints > 0,
                mergedPoints: mergedPoints > 0 ? mergedPoints : null,
                mergedAt: mergedPoints > 0 ? nowIso : null,
                connectedLineAt: nowIso,
                createdAt: nowIso,
                updatedAt: nowIso,
            };

            await supabaseAdmin.from('customers').upsert(newCustomerData);
        }

        return {
            success: true,
            customerId: userId,
            mergedPoints: mergedPoints,
            message: mergedPoints > 0
                ? `เชื่อมต่อ LINE สำเร็จ และรวมคะแนน ${mergedPoints} คะแนนจากระบบเบอร์โทร`
                : 'เชื่อมต่อ LINE สำเร็จ'
        };

    } catch (error: any) {
        console.error("Error connecting LINE to customer:", error);
        return {
            success: false,
            error: error.message
        };
    }
}

export async function addCustomer(customerData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const targetId = customerData.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cust_${Date.now()}`);
        const cleanPhone = customerData.phone ? customerData.phone.replace(/[\s-()]/g, '') : null;
        const nowIso = new Date().toISOString();

        const { error } = await supabaseAdmin.from('customers').insert({
            ...customerData,
            id: targetId,
            phone: cleanPhone,
            phoneNumber: cleanPhone,
            points: Number(customerData.points) || 0,
            createdAt: nowIso,
            updatedAt: nowIso,
        });

        if (error) throw new Error(error.message);

        revalidatePath('/admin/customers');
        return { success: true, message: 'เพิ่มลูกค้าสำเร็จ!' };
    } catch (error: any) {
        console.error("Error adding customer:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteCustomer(customerId: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { error } = await supabaseAdmin.from('customers').delete().eq('id', customerId);
        if (error) throw new Error(error.message);

        revalidatePath('/admin/customers');
        return { success: true, message: 'ลบลูกค้าสำเร็จ!' };
    } catch (error: any) {
        console.error("Error deleting customer:", error);
        return { success: false, error: error.message };
    }
}
