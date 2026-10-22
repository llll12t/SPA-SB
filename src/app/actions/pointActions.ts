"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export interface PointSettings {
    enablePurchasePoints: boolean;
    pointsPerCurrency: number;
    enableVisitPoints: boolean;
    pointsPerVisit: number;
    enableReviewPoints: boolean;
    reviewPoints: number;
}

/**
 * Award points to customer based on purchase amount
 */
export async function awardPointsForPurchase(userId: string, purchaseAmount: number) {
    if (!userId) {
        return { success: false, error: 'No userId provided - customer may not have LINE ID' };
    }

    if (!purchaseAmount || purchaseAmount <= 0) {
        return { success: false, error: 'Invalid purchase amount' };
    }

    try {
        const { data: pointSettingsDoc } = await supabaseAdmin
            .from('settings')
            .select('data')
            .eq('id', 'points')
            .maybeSingle();

        let pointsToAward = 0;
        if (pointSettingsDoc?.data) {
            const pointSettings = pointSettingsDoc.data as PointSettings;
            if (pointSettings.enablePurchasePoints) {
                const pointsPerCurrency = Number(pointSettings.pointsPerCurrency) || 100;
                pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const { data: customerDoc } = await supabaseAdmin
            .from('customers')
            .select('points')
            .eq('id', userId)
            .maybeSingle();

        const nowIso = new Date().toISOString();
        if (customerDoc) {
            const currentPoints = Number(customerDoc.points) || 0;
            await supabaseAdmin
                .from('customers')
                .update({
                    points: currentPoints + pointsToAward,
                    updatedAt: nowIso,
                })
                .eq('id', userId);
        } else {
            await supabaseAdmin
                .from('customers')
                .insert({
                    id: userId,
                    points: pointsToAward,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                });
        }

        return { success: true, pointsAwarded: pointsToAward };
    } catch (error: any) {
        console.error("Error awarding points for purchase:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Award points to customer for visit
 */
export async function awardPointsForVisit(userId: string) {
    if (!userId) {
        return { success: false, error: 'No userId provided - customer may not have LINE ID' };
    }

    try {
        const { data: pointSettingsDoc } = await supabaseAdmin
            .from('settings')
            .select('data')
            .eq('id', 'points')
            .maybeSingle();

        let pointsToAward = 0;
        if (pointSettingsDoc?.data) {
            const pointSettings = pointSettingsDoc.data as PointSettings;
            if (pointSettings.enableVisitPoints) {
                pointsToAward = Number(pointSettings.pointsPerVisit) || 1;
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const { data: customerDoc } = await supabaseAdmin
            .from('customers')
            .select('points')
            .eq('id', userId)
            .maybeSingle();

        const nowIso = new Date().toISOString();
        if (customerDoc) {
            const currentPoints = Number(customerDoc.points) || 0;
            await supabaseAdmin
                .from('customers')
                .update({
                    points: currentPoints + pointsToAward,
                    updatedAt: nowIso,
                })
                .eq('id', userId);
        } else {
            await supabaseAdmin
                .from('customers')
                .insert({
                    id: userId,
                    points: pointsToAward,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                });
        }

        return { success: true, pointsAwarded: pointsToAward };
    } catch (error: any) {
        console.error("Error awarding points for visit:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current point settings
 */
export async function getPointSettings() {
    try {
        const { data: pointSettingsDoc } = await supabaseAdmin
            .from('settings')
            .select('data')
            .eq('id', 'points')
            .maybeSingle();

        if (pointSettingsDoc?.data) {
            return { success: true, settings: pointSettingsDoc.data };
        }

        return {
            success: true,
            settings: {
                reviewPoints: 5,
                pointsPerCurrency: 100,
                pointsPerVisit: 1,
                enableReviewPoints: true,
                enablePurchasePoints: false,
                enableVisitPoints: false
            } as PointSettings
        };
    } catch (error: any) {
        console.error("Error getting point settings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Award points to customer by phone number (for customers without LINE ID)
 */
export async function awardPointsByPhone(phoneNumber: string, purchaseAmount: number, appointmentId: string) {
    if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
    }

    if (!purchaseAmount || purchaseAmount <= 0) {
        return { success: false, error: 'Invalid purchase amount' };
    }

    const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');

    try {
        const { data: pointSettingsDoc } = await supabaseAdmin
            .from('settings')
            .select('data')
            .eq('id', 'points')
            .maybeSingle();

        let pointsToAward = 0;
        if (pointSettingsDoc?.data) {
            const pointSettings = pointSettingsDoc.data as PointSettings;
            if (pointSettings.enablePurchasePoints) {
                const pointsPerCurrency = Number(pointSettings.pointsPerCurrency) || 100;
                pointsToAward = Math.floor(purchaseAmount / pointsPerCurrency);
            }
            if (pointSettings.enableVisitPoints) {
                const visitPoints = Number(pointSettings.pointsPerVisit) || 1;
                pointsToAward += visitPoints;
            }
        }

        if (pointsToAward <= 0) {
            return { success: true, pointsAwarded: 0 };
        }

        const { data: customerDoc } = await supabaseAdmin
            .from('customers_by_phone')
            .select('*')
            .eq('id', cleanPhone)
            .maybeSingle();

        const nowIso = new Date().toISOString();

        if (customerDoc) {
            const currentPoints = Number(customerDoc.points) || 0;
            await supabaseAdmin
                .from('customers_by_phone')
                .update({
                    points: currentPoints + pointsToAward,
                    lastAppointmentId: appointmentId,
                    lastPointsAwarded: pointsToAward,
                    lastPointsDate: nowIso,
                    updatedAt: nowIso,
                })
                .eq('id', cleanPhone);
        } else {
            await supabaseAdmin
                .from('customers_by_phone')
                .insert({
                    id: cleanPhone,
                    phoneNumber: cleanPhone,
                    points: pointsToAward,
                    lastAppointmentId: appointmentId,
                    lastPointsAwarded: pointsToAward,
                    lastPointsDate: nowIso,
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    hasLineId: false,
                    notificationNote: 'Customer without LINE ID - consider manual contact for point notifications'
                });
        }

        return {
            success: true,
            pointsAwarded: pointsToAward,
            message: 'Points awarded to phone-based customer record'
        };
    } catch (error: any) {
        console.error("Error awarding points by phone:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get points for customer by phone number (for customers without LINE ID)
 */
export async function getPointsByPhone(phoneNumber: string, auth?: AuthContext) {
    if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
    }

    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const cleanPhone = phoneNumber.replace(/[\s-()]/g, '');
        const { data: customerData } = await supabaseAdmin
            .from('customers_by_phone')
            .select('*')
            .eq('id', cleanPhone)
            .maybeSingle();

        if (customerData) {
            return {
                success: true,
                points: Number(customerData.points) || 0,
                customerInfo: {
                    phoneNumber: customerData.phoneNumber,
                    lastAppointmentId: customerData.lastAppointmentId,
                    lastPointsAwarded: customerData.lastPointsAwarded,
                    lastPointsDate: customerData.lastPointsDate,
                    hasLineId: false,
                    createdAt: customerData.createdAt,
                    updatedAt: customerData.updatedAt
                }
            };
        }

        return {
            success: true,
            points: 0,
            customerInfo: null,
            message: 'No points record found for this phone number'
        };
    } catch (error: any) {
        console.error("Error getting points by phone:", error);
        return { success: false, error: error.message };
    }
}
