"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

export interface RewardData {
    name: string;
    pointsRequired: number;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    value?: number; // legacy support
}

export async function addReward(rewardData: RewardData, auth?: AuthContext) {
    if (!rewardData.name || !rewardData.pointsRequired) {
        return { success: false, error: 'Missing required fields.' };
    }
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { error } = await supabaseAdmin.from('rewards').insert({
            name: rewardData.name,
            pointsRequired: Number(rewardData.pointsRequired) || 0,
            description: rewardData.description || '',
            discountType: rewardData.discountType || 'percentage',
            discountValue: Number(rewardData.discountValue || rewardData.value || 0),
            value: Number(rewardData.value || rewardData.discountValue || 0),
            redeemedCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function redeemReward(userId: string, rewardId: string, auth?: AuthContext) {
    if (!userId || !rewardId) {
        return { success: false, error: "User ID and Reward ID are required." };
    }

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { success: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId || userId;
    if (!lineUserId) return { success: false, error: "Missing LINE user." };
    if (lineUserId !== userId) {
        return { success: false, error: "Unauthorized." };
    }

    try {
        const [custRes, rewRes] = await Promise.all([
            supabaseAdmin.from('customers').select('*').eq('id', userId).maybeSingle(),
            supabaseAdmin.from('rewards').select('*').eq('id', rewardId).maybeSingle()
        ]);

        if (custRes.error || !custRes.data) throw new Error("Customer not found.");
        if (rewRes.error || !rewRes.data) throw new Error("Reward not found.");

        const customer = custRes.data;
        const reward = rewRes.data;
        const currentPoints = Number(customer.points) || 0;
        const pointsRequired = Number(reward.pointsRequired) || 0;

        if (currentPoints < pointsRequired) {
            throw new Error("Not enough points.");
        }

        const newPoints = currentPoints - pointsRequired;

        // 1. Deduct customer points
        const { error: custUpdateErr } = await supabaseAdmin
            .from('customers')
            .update({ points: newPoints, updatedAt: new Date().toISOString() })
            .eq('id', userId);

        if (custUpdateErr) throw new Error(custUpdateErr.message);

        // 2. Insert new coupon into coupons table
        const couponId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cp_${Date.now()}`;
        const { error: couponErr } = await supabaseAdmin
            .from('coupons')
            .insert({
                id: couponId,
                customerId: userId,
                rewardId: rewardId,
                name: reward.name,
                description: reward.description || '',
                discountType: reward.discountType || 'percentage',
                discountValue: Number(reward.discountValue ?? reward.value ?? 0),
                redeemedAt: new Date().toISOString(),
                used: false,
                expiresAt: null
            });

        if (couponErr) throw new Error(couponErr.message);

        // 3. Increment redeemedCount on reward
        await supabaseAdmin
            .from('rewards')
            .update({
                redeemedCount: (Number(reward.redeemedCount) || 0) + 1,
                updatedAt: new Date().toISOString()
            })
            .eq('id', rewardId);

        return { success: true, couponId };
    } catch (error: any) {
        console.error("Redeem reward error:", error);
        return { success: false, error: error.message };
    }
}
