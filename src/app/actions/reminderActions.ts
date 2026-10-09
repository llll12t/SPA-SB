"use server";

import { db } from '@/app/lib/supabaseDb';
import { sendReminderNotification } from '@/app/actions/lineActions';
import { getNotificationSettings } from '@/app/actions/settingsActions';

/**
 * Send reminder notifications to customers 1 hour before their appointment
 * This function should be called by a cron job or scheduled task
 */
export async function sendAppointmentReminders() {
    try {
        // 1. Check settings first
        const { success, settings } = await getNotificationSettings();
        const allEnabled = settings?.allNotifications?.enabled !== false;
        const customerEnabled = allEnabled && (settings?.customerNotifications?.enabled !== false);
        const reminderEnabled = customerEnabled && (settings?.customerNotifications?.appointmentReminder !== false);

        if (!reminderEnabled) {
            return { success: true, message: 'Appointment reminder notification is disabled in settings.' };
        }

        // 2. Calculate Thailand Time 1 hour from now
        const now = Date.now();
        const oneHourLater = new Date(now + 60 * 60 * 1000);

        const targetDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(oneHourLater);

        const targetHour = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            hour12: false
        }).format(oneHourLater);

        const targetTimePrefix = `${targetHour}:`; // Matches HH:00, HH:15, HH:30, etc.

        // Query appointments that are confirmed for target date
        const appointmentsQuery = db.collection('appointments')
            .where('status', '==', 'confirmed')
            .where('date', '==', targetDate);

        const snapshot = await appointmentsQuery.get();

        if (snapshot.empty) {
            return { success: true, message: 'No appointments found for date ' + targetDate };
        }

        const reminderPromises: Promise<any>[] = [];

        snapshot.forEach(doc => {
            const appointmentData = doc.data();

            // Check if appointment is within this hour and not yet reminded
            const appTime = appointmentData.time || '';
            const isTargetHour = appTime.startsWith(targetTimePrefix);
            const alreadyReminded = !!appointmentData.reminderSent;

            if (isTargetHour && !alreadyReminded && appointmentData.userId) {
                const reminderData = {
                    id: doc.id,
                    appointmentId: doc.id,
                    serviceInfo: appointmentData.serviceInfo,
                    customerInfo: appointmentData.customerInfo,
                    date: appointmentData.date,
                    time: appointmentData.time,
                    appointmentInfo: appointmentData.appointmentInfo
                };

                reminderPromises.push(
                    sendReminderNotification(appointmentData.userId, reminderData)
                        .then(async (result: any) => {
                            if (result.success) {
                                try {
                                    await db.collection('appointments').doc(doc.id).update({
                                        reminderSent: true,
                                        reminderSentAt: new Date().toISOString()
                                    });
                                } catch (updateErr) {
                                    console.error('Error updating reminderSent flag:', updateErr);
                                }
                                return { appointmentId: doc.id, success: true };
                            } else {
                                console.error(`Failed to send reminder to ${appointmentData.userId}:`, result.error);
                                return { appointmentId: doc.id, success: false, error: result.error };
                            }
                        })
                        .catch((error: any) => {
                            console.error(`Error sending reminder for appointment ${doc.id}:`, error);
                            return { appointmentId: doc.id, success: false, error: error.message };
                        })
                );
            }
        });

        // Wait for all reminders to be sent
        const results = await Promise.all(reminderPromises);

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return {
            success: true,
            totalChecked: snapshot.size,
            targetHour: targetTimePrefix,
            sentCount: successCount,
            failureCount,
            results
        };

    } catch (error: any) {
        console.error('Error in sendAppointmentReminders:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
