'use server';

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth, requireLineAuth } from '@/app/lib/authUtils';

// --- Types ---
export interface ShopProfile {
    storeName: string;
    currency: string;
    currencySymbol: string;
    [key: string]: any;
}

export interface NotificationSettings {
    allNotifications?: {
        enabled?: boolean;
    };
    lineNotifications?: {
        enabled?: boolean;
        notifyToken?: string;
        channelAccessToken?: string;
        channelSecret?: string;
        liffId?: string;
        [key: string]: any;
    };
    customerNotifications?: {
        newBooking?: boolean;
        appointmentConfirmed?: boolean;
        serviceCompleted?: boolean;
        reviewRequest?: boolean;
        appointmentCancelled?: boolean;
        paymentInvoice?: boolean;
        appointmentReminder?: boolean;
        dailyAppointmentNotification?: boolean;
        [key: string]: boolean | undefined;
    };
    adminNotifications?: {
        enabled?: boolean;
        newBooking?: boolean;
        paymentReceived?: boolean;
        customerConfirmed?: boolean;
        bookingCancelled?: boolean;
        telegram?: {
            enabled?: boolean;
            botToken?: string;
            chatId?: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

// In-memory caches with 60s TTL
let shopProfileCache: ShopProfile | null = null;
let cacheTimestamp: number | null = null;

let notificationSettingsCache: NotificationSettings | null = null;
let notificationCacheTimestamp: number | null = null;

// Helper to load settings from Supabase table
async function loadSettingRow(id: string): Promise<any> {
    const { data, error } = await supabaseAdmin
        .from('settings')
        .select('data')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        console.error(`Error loading setting '${id}':`, error);
        return null;
    }
    return data?.data || null;
}

// Helper to save settings to Supabase table (merging with existing JSONB)
async function saveSettingRow(id: string, incomingData: any): Promise<void> {
    const { data: existing } = await supabaseAdmin
        .from('settings')
        .select('data')
        .eq('id', id)
        .maybeSingle();

    const merged = { ...(existing?.data || {}), ...incomingData };
    const { error } = await supabaseAdmin
        .from('settings')
        .upsert({
            id,
            data: merged,
            updatedAt: new Date().toISOString()
        });

    if (error) throw new Error(error.message);
}

export async function getShopProfile(): Promise<{ success: boolean; profile?: ShopProfile; error?: string }> {
    const now = Date.now();
    if (shopProfileCache && cacheTimestamp && (now - cacheTimestamp < 60000)) {
        return { success: true, profile: shopProfileCache };
    }

    try {
        const data = await loadSettingRow('profile');
        if (data) {
            shopProfileCache = data as ShopProfile;
            cacheTimestamp = now;
            return { success: true, profile: data as ShopProfile };
        } else {
            const defaultProfile: ShopProfile = {
                storeName: 'ชื่อร้านค้า',
                currency: '฿',
                currencySymbol: 'บาท',
            };
            return { success: true, profile: defaultProfile };
        }
    } catch (error: any) {
        console.error("Error getting shop profile:", error);
        return { success: false, error: error.message };
    }
}

export async function saveProfileSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('profile', settingsData);
        shopProfileCache = null;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveNotificationSettings(settingsData: NotificationSettings, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const updatedSettings = {
            ...settingsData,
            customerNotifications: {
                ...settingsData.customerNotifications,
                newBooking: typeof settingsData?.customerNotifications?.newBooking === 'boolean'
                    ? settingsData.customerNotifications.newBooking
                    : true,
            },
        };

        await saveSettingRow('notifications', updatedSettings);
        notificationSettingsCache = null;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getNotificationSettings(): Promise<{ success: boolean; settings?: NotificationSettings; error?: string }> {
    const now = Date.now();
    if (notificationSettingsCache && notificationCacheTimestamp && (now - notificationCacheTimestamp < 60000)) {
        return { success: true, settings: notificationSettingsCache };
    }

    try {
        const data = await loadSettingRow('notifications');
        const settings = data || {};
        notificationSettingsCache = settings;
        notificationCacheTimestamp = now;
        return { success: true, settings };
    } catch (error: any) {
        console.error("Error getting notification settings:", error);
        return { success: false, error: error.message };
    }
}

export async function saveBookingSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('booking', settingsData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function savePointSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('points', settingsData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function savePaymentSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('payment', settingsData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveCalendarSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('calendar', settingsData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getPaymentSettings(auth?: AuthContext) {
    try {
        const lineAuth = await requireLineAuth(auth);
        if (!lineAuth.ok) return { success: false, error: lineAuth.error };

        const data = await loadSettingRow('payment');
        if (data) {
            return { success: true, settings: data };
        } else {
            return { success: false, error: "ยังไม่ได้ตั้งค่าการชำระเงิน" };
        }
    } catch (error: any) {
        console.error("Error getting payment settings:", error);
        return { success: false, error: error.message };
    }
}

export async function getSystemSettings(): Promise<{ success: boolean; settings?: any; error?: string }> {
    try {
        const data = await loadSettingRow('system');
        return { success: true, settings: data || {} };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function saveSystemSettings(settingsData: any, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        await saveSettingRow('system', settingsData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
