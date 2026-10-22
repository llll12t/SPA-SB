"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

/**
 * Merge points from phone-based record to LINE-based record when customer connects LINE
 */
export async function mergePointsFromPhone(userId: string, phoneNumber: string) {
    if (!userId || !phoneNumber) {
        return { success: false, error: 'LINE User ID และเบอร์โทรศัพท์จำเป็นต้องระบุ' };
    }

    try {
        const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');

        // 1. Fetch points from customers_by_phone
        const { data: phoneCustomer, error: phoneErr } = await supabaseAdmin
            .from('customers_by_phone')
            .select('*')
            .eq('id', cleanPhone)
            .maybeSingle();

        if (phoneErr || !phoneCustomer) {
            return {
                success: true,
                mergedPoints: 0,
                message: 'ไม่พบคะแนนสะสมในระบบเบอร์โทร'
            };
        }

        const pointsToMerge = Number(phoneCustomer.points) || 0;
        if (pointsToMerge === 0 || phoneCustomer.status === 'merged') {
            return {
                success: true,
                mergedPoints: 0,
                message: 'ไม่มีคะแนนในระบบเบอร์โทรที่ต้องรวม'
            };
        }

        // 2. Fetch or update LINE customer
        const { data: lineCustomer } = await supabaseAdmin
            .from('customers')
            .select('points')
            .eq('id', userId)
            .maybeSingle();

        const currentPoints = Number(lineCustomer?.points) || 0;
        const nowIso = new Date().toISOString();

        if (lineCustomer) {
            await supabaseAdmin
                .from('customers')
                .update({
                    points: currentPoints + pointsToMerge,
                    phone: cleanPhone,
                    phoneNumber: cleanPhone,
                    mergedFromPhone: true,
                    mergedPoints: pointsToMerge,
                    mergedAt: nowIso,
                    updatedAt: nowIso,
                })
                .eq('id', userId);
        } else {
            await supabaseAdmin
                .from('customers')
                .insert({
                    id: userId,
                    points: pointsToMerge,
                    phone: cleanPhone,
                    phoneNumber: cleanPhone,
                    mergedFromPhone: true,
                    mergedPoints: pointsToMerge,
                    mergedAt: nowIso,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                });
        }

        // 3. Mark phone record as merged
        await supabaseAdmin
            .from('customers_by_phone')
            .update({
                mergedToLineId: userId,
                mergedAt: nowIso,
                pointsAfterMerge: 0,
                originalPoints: pointsToMerge,
                status: 'merged',
                updatedAt: nowIso,
            })
            .eq('id', cleanPhone);

        // 4. Record merge history
        await supabaseAdmin
            .from('pointMergeHistory')
            .insert({
                userId,
                phone: cleanPhone,
                phoneNumber: cleanPhone,
                mergedPoints: pointsToMerge,
                originalLinePoints: currentPoints,
                newTotalPoints: currentPoints + pointsToMerge,
                mergedAt: nowIso,
                mergeType: 'phone_to_line',
            });

        return {
            success: true,
            mergedPoints: pointsToMerge,
            message: `รวมคะแนน ${pointsToMerge} คะแนนจากระบบเบอร์โทรเรียบร้อยแล้ว`
        };

    } catch (error: any) {
        console.error("Error merging points from phone:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if phone number has points that can be merged
 */
export async function checkPhonePointsForMerge(phoneNumber: string) {
    if (!phoneNumber) {
        return { success: false, error: 'เบอร์โทรศัพท์จำเป็นต้องระบุ' };
    }

    try {
        const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');
        const { data: phoneCustomer, error } = await supabaseAdmin
            .from('customers_by_phone')
            .select('*')
            .eq('id', cleanPhone)
            .maybeSingle();

        if (error || !phoneCustomer) {
            return {
                success: true,
                hasPoints: false,
                points: 0
            };
        }

        if (phoneCustomer.status === 'merged') {
            return {
                success: true,
                hasPoints: false,
                points: 0,
                message: 'คะแนนถูกรวมไปแล้ว'
            };
        }

        const points = Number(phoneCustomer.points) || 0;
        return {
            success: true,
            hasPoints: points > 0,
            points
        };

    } catch (error: any) {
        console.error("Error checking phone points:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get merge history for admin dashboard
 */
export async function getMergeHistory(limit = 50) {
    try {
        const { data: history, error } = await supabaseAdmin
            .from('pointMergeHistory')
            .select('*')
            .order('mergedAt', { ascending: false })
            .limit(limit);

        if (error) throw new Error(error.message);

        return {
            success: true,
            history: history || []
        };

    } catch (error: any) {
        console.error("Error getting merge history:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get merge statistics
 */
export async function getMergeStatistics() {
    try {
        const { data: history, error } = await supabaseAdmin
            .from('pointMergeHistory')
            .select('*');

        if (error) throw new Error(error.message);

        const list = history || [];
        const totalMerges = list.length;
        let totalPointsMerged = 0;
        let thisMonth = 0;
        let thisWeek = 0;

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayOfWeek = now.getDay();
        const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

        list.forEach((data: any) => {
            const mergedPoints = Number(data.mergedPoints) || 0;
            totalPointsMerged += mergedPoints;

            if (data.mergedAt) {
                const mergedDate = new Date(data.mergedAt);
                if (mergedDate >= firstDayOfMonth) {
                    thisMonth++;
                }
                if (mergedDate >= firstDayOfWeek) {
                    thisWeek++;
                }
            }
        });

        return {
            success: true,
            stats: {
                totalMerges,
                totalPointsMerged,
                averagePointsPerMerge: totalMerges > 0 ? Math.round(totalPointsMerged / totalMerges) : 0,
                thisMonth,
                thisWeek
            }
        };

    } catch (error: any) {
        console.error("Error getting merge statistics:", error);
        return { success: false, error: error.message };
    }
}
