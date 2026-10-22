"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { sendDailyAppointmentNotificationFlexMessage } from '@/app/actions/lineFlexActions';
import { getNotificationSettings } from '@/app/actions/settingsActions';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

/**
 * Sends daily appointment notifications to customers immediately (manual trigger)
 * @param {boolean} mockMode - If true, simulates sending without calling LINE API
 */
export async function sendDailyNotificationsNow(mockMode = false, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        // Check notification settings
        const settingsResult = await getNotificationSettings();
        const settingsData = settingsResult?.settings || {};
        const allNotificationsEnabled = settingsData.allNotifications?.enabled !== false;
        const customerNotificationsEnabled = allNotificationsEnabled && (settingsData.customerNotifications?.enabled !== false);
        const dailyNotificationEnabled = customerNotificationsEnabled && (settingsData.customerNotifications?.dailyAppointmentNotification !== false);

        // Get today's date in Thailand timezone (YYYY-MM-DD)
        const todayString = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());

        if (!mockMode && !dailyNotificationEnabled) {
            return {
                success: true,
                message: "การแจ้งเตือนสรุปคิวประจำวันถูกปิดใช้งานอยู่ในการตั้งค่า LINE Notification",
                data: {
                    totalAppointments: 0,
                    validStatusAppointments: 0,
                    sentCount: 0,
                    failureCount: 0,
                    skipCount: 0,
                    date: todayString
                }
            };
        }

        // Query appointments for today
        const { data: appointments, error } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('date', todayString);

        if (error) throw new Error(error.message);

        const allTodayAppointments = appointments || [];
        if (allTodayAppointments.length === 0) {
            return {
                success: true,
                message: "ไม่มีนัดหมายสำหรับวันนี้",
                data: {
                    totalAppointments: 0,
                    validStatusAppointments: 0,
                    sentCount: 0,
                    failureCount: 0,
                    skipCount: 0,
                    date: todayString
                }
            };
        }

        // Filter appointments by status: only "awaiting_confirmation" and "confirmed"
        const validStatuses = ['awaiting_confirmation', 'confirmed'];
        const filteredAppointments = allTodayAppointments.filter((item: any) => validStatuses.includes(item.status));

        if (filteredAppointments.length === 0) {
            return {
                success: true,
                message: "ไม่มีนัดหมายที่มีสถานะรอยืนยันหรือยืนยันแล้วสำหรับวันนี้",
                data: {
                    totalAppointments: allTodayAppointments.length,
                    validStatusAppointments: 0,
                    sentCount: 0,
                    failureCount: 0,
                    skipCount: 0,
                    date: todayString
                }
            };
        }

        const notificationPromises: Promise<any>[] = [];

        filteredAppointments.forEach(appointmentData => {
            const appointmentId = appointmentData.id;

            // Check if customer has LINE ID
            if (!appointmentData.userId) {
                notificationPromises.push(Promise.resolve({ appointmentId, success: false, skipped: true, reason: 'no_line_id' }));
                return;
            }

            // Check if already sent today to prevent duplicate spamming
            if (!mockMode && appointmentData.dailyNotificationSentDate === todayString) {
                notificationPromises.push(Promise.resolve({ appointmentId, success: true, skippedAlreadySent: true }));
                return;
            }

            const notificationData = {
                id: appointmentId,
                ...appointmentData
            };

            if (mockMode) {
                notificationPromises.push(
                    Promise.resolve({
                        appointmentId,
                        success: true,
                        mockMode: true
                    })
                );
            } else {
                notificationPromises.push(
                    sendDailyAppointmentNotificationFlexMessage(appointmentData.userId, notificationData)
                        .then(async (result: any) => {
                            if (result.success) {
                                try {
                                    await supabaseAdmin
                                        .from('appointments')
                                        .update({
                                            dailyNotificationSentDate: todayString,
                                            dailyNotificationSentAt: new Date().toISOString()
                                        })
                                        .eq('id', appointmentId);
                                } catch (e) {
                                    console.error('Error recording dailyNotificationSentDate:', e);
                                }
                                return { appointmentId, success: true };
                            } else {
                                console.error(`Failed to send daily notification to ${appointmentData.userId}:`, result.error);
                                return { appointmentId, success: false, error: result.error };
                            }
                        })
                        .catch((err: any) => {
                            console.error(`Error sending daily notification for appointment ${appointmentId}:`, err);
                            return { appointmentId, success: false, error: err.message };
                        })
                );
            }
        });

        // Wait for all notifications to be sent
        const results = await Promise.all(notificationPromises);

        const successCount = results.filter(r => r.success && !r.skippedAlreadySent).length;
        const alreadySentCount = results.filter(r => r.skippedAlreadySent).length;
        const failureCount = results.filter(r => !r.success && !r.skipped).length;
        const skipCount = results.filter(r => r.skipped).length;

        const statusText = mockMode ? 'ทดสอบส่งแจ้งเตือนจำลอง' : 'ส่งแจ้งเตือน';
        let message = `${statusText}สำเร็จ ${successCount}/${filteredAppointments.length} รายการ`;
        if (alreadySentCount > 0) {
            message += ` (ส่งไปแล้วก่อนหน้า ${alreadySentCount} รายการ - ไม่ส่งซ้ำ)`;
        }

        return {
            success: true,
            message,
            data: {
                totalAppointments: allTodayAppointments.length,
                validStatusAppointments: filteredAppointments.length,
                sentCount: successCount,
                alreadySentCount,
                failureCount,
                skipCount,
                date: todayString
            }
        };

    } catch (error: any) {
        console.error("Daily notification error:", error);
        return {
            success: false,
            error: error.message
        };
    }
}
