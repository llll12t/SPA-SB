'use server';

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { sendReviewThankYouFlexMessage } from './lineFlexActions';
import { AuthContext, requireLineAuth } from '@/app/lib/authUtils';

/**
 * Submits a review for a completed appointment.
 * @param {object} reviewData - The review data from the form.
 * @param {string} reviewData.appointmentId - The ID of the appointment being reviewed.
 * @param {string} reviewData.userId - The LINE User ID of the customer.
 * @param {string} reviewData.technicianId - The ID of the technician.
 * @param {number} reviewData.rating - The star rating (1-5).
 * @param {string} reviewData.comment - The customer's comment.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitReview(reviewData: any, auth?: AuthContext) {
    const { appointmentId, userId, technicianId, rating, comment } = reviewData;

    if (!appointmentId || !userId || !rating) {
        return { success: false, error: 'ข้อมูลที่จำเป็นไม่ครบถ้วน' };
    }

    const lineAuth = await requireLineAuth(auth);
    if (!lineAuth.ok) return { success: false, error: lineAuth.error };
    const lineUserId = lineAuth.value.userId || userId;
    if (!lineUserId) return { success: false, error: 'Missing LINE user.' };
    if (lineUserId !== userId) {
        return { success: false, error: 'Unauthorized.' };
    }

    try {
        // 1. Get point settings
        const { data: pointSettingsDoc } = await supabaseAdmin
            .from('settings')
            .select('data')
            .eq('id', 'points')
            .maybeSingle();

        let pointsToAward = 0;
        const pointSettings = pointSettingsDoc?.data;
        if (pointSettings?.enableReviewPoints) {
            pointsToAward = Number(pointSettings.reviewPoints) || 5;
        } else if (!pointSettings) {
            pointsToAward = 5;
        }

        // 2. Fetch appointment
        const { data: appointmentData, error: appErr } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .maybeSingle();

        if (appErr || !appointmentData) {
            throw new Error('ไม่พบข้อมูลการนัดหมายนี้');
        }
        if (!appointmentData.userId) {
            throw new Error('ข้อมูลการนัดหมายนี้ไม่มี LINE User ID กรุณาติดต่อแอดมิน');
        }
        if (appointmentData.userId !== userId) {
            throw new Error('คุณไม่มีสิทธิ์รีวิวการนัดหมายนี้ กรุณา login ด้วย LINE ที่ใช้จอง');
        }
        if (appointmentData.reviewInfo?.submitted) {
            throw new Error('คุณได้รีวิวการนัดหมายนี้ไปแล้ว');
        }
        if (!appointmentData.customerInfo) {
            throw new Error('ข้อมูลลูกค้าในนัดหมายไม่สมบูรณ์ กรุณาติดต่อแอดมิน');
        }

        const customerName = appointmentData.customerInfo.fullName || appointmentData.customerInfo.name || 'ลูกค้า';
        const nowIso = new Date().toISOString();

        // 3. Upsert review
        const { error: reviewErr } = await supabaseAdmin
            .from('reviews')
            .upsert({
                id: appointmentId,
                appointmentId,
                userId,
                technicianId: technicianId || null,
                customerName,
                rating: Number(rating),
                comment: comment || '',
                pointsAwarded: pointsToAward,
                createdAt: nowIso,
            });

        if (reviewErr) throw new Error(reviewErr.message);

        // 4. Update appointment with review info
        const updatedReviewInfo = {
            ...(appointmentData.reviewInfo || {}),
            submitted: true,
            rating: Number(rating),
            comment: comment || '',
            pointsAwarded: pointsToAward,
            reviewedAt: nowIso,
        };

        const { error: appUpdateErr } = await supabaseAdmin
            .from('appointments')
            .update({
                reviewInfo: updatedReviewInfo,
                updatedAt: nowIso,
            })
            .eq('id', appointmentId);

        if (appUpdateErr) throw new Error(appUpdateErr.message);

        // 5. Award points to customer if configured
        if (pointsToAward > 0) {
            const { data: customerDoc } = await supabaseAdmin
                .from('customers')
                .select('points')
                .eq('id', userId)
                .maybeSingle();

            const currentPoints = Number(customerDoc?.points) || 0;
            await supabaseAdmin
                .from('customers')
                .update({
                    points: currentPoints + pointsToAward,
                    updatedAt: nowIso,
                })
                .eq('id', userId);
        }

        // 6. Send LINE Thank You Flex Message in background
        (async () => {
            try {
                const messageData = {
                    ...appointmentData,
                    id: appointmentId,
                    rating: Number(rating),
                    comment: comment || '',
                    pointsAwarded: pointsToAward,
                    customerName,
                };
                await sendReviewThankYouFlexMessage(userId, messageData);
            } catch (flexError) {
                console.error("Error sending review thank you Flex Message:", flexError);
            }
        })();

        return {
            success: true,
            pointsAwarded: pointsToAward,
            message: pointsToAward > 0
                ? `ขอบคุณสำหรับรีวิว! คุณได้รับคะแนนสะสม ${pointsToAward} คะแนน`
                : 'ขอบคุณสำหรับรีวิว!'
        };

    } catch (error: any) {
        console.error("Error submitting review:", error);
        return { success: false, error: error.message };
    }
}
