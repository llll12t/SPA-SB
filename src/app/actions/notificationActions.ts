"use server";

import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export async function createSystemNotification(data: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    link?: string;
    appointmentId?: string;
}) {
    try {
        const supabase = getSupabaseAdmin();
        const { data: inserted, error } = await supabase
            .from('notifications')
            .insert({
                title: data.title,
                message: data.message,
                type: data.type || 'info',
                link: data.link || '',
                appointmentId: data.appointmentId || '',
                isRead: false,
                createdAt: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (error) throw new Error(error.message);
        return { success: true, id: inserted?.id };
    } catch (error: any) {
        console.error("Error creating system notification:", error);
        return { success: false, error: error.message };
    }
}

export async function markNotificationAsRead(notificationId: string, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        if (!notificationId) return { success: false, error: 'Notification ID required' };
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
            .from('notifications')
            .update({
                isRead: true,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', notificationId);

        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error: any) {
        console.error("Error marking notification as read:", error);
        return { success: false, error: error.message };
    }
}

export async function markAllNotificationsAsRead(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const supabase = getSupabaseAdmin();
        // Single atomic SQL update directly on Supabase!
        const { error } = await supabase
            .from('notifications')
            .update({ isRead: true })
            .eq('isRead', false);

        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error: any) {
        console.error("Error marking notifications as read:", error);
        return { success: false, error: error.message };
    }
}

export async function clearAllNotifications(auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const supabase = getSupabaseAdmin();
        // Single atomic SQL delete directly on Supabase!
        const { error } = await supabase
            .from('notifications')
            .delete()
            .neq('id', '');

        if (error) throw new Error(error.message);
        return { success: true };
    } catch (error: any) {
        console.error("Error clearing notifications:", error);
        return { success: false, error: error.message };
    }
}
