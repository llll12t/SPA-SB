"use server";

import { getNotificationSettings } from './settingsActions';

export async function sendTelegramMessageToAdmin(
    messageText: string,
    config?: { botToken?: string; chatId?: string }
): Promise<{ success: boolean; error?: string }> {
    let botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    let chatId = config?.chatId || process.env.TELEGRAM_ADMIN_CHAT_ID;

    // Check DB settings if env is missing
    if (!botToken || !chatId) {
        try {
            const { settings } = await getNotificationSettings();
            const tele = settings?.adminNotifications?.telegram;
            if (tele?.botToken && tele?.chatId) {
                botToken = tele.botToken;
                chatId = tele.chatId;
            }
        } catch (e) {
            console.error("Error loading Telegram settings:", e);
        }
    }

    if (!botToken || !chatId) {
        console.error("Telegram Bot Token or Chat ID is not configured");
        return { success: false, error: "ไม่ได้ระบุ Telegram Bot Token หรือ Chat ID" };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: messageText,
                parse_mode: 'Markdown',
            }),
        });

        const result = await response.json();

        if (!result.ok) {
            throw new Error(result.description || "Telegram API error");
        }

        return { success: true };

    } catch (error: any) {
        console.error("Error sending Telegram message:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ทดสอบส่งข้อความแจ้งเตือนเข้า Telegram Bot
 */
export async function testTelegramMessage(customToken?: string, customChatId?: string) {
    const nowTime = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date());

    const text = `🔔 *ทดสอบการเชื่อมต่อ Telegram*\nระบบสปาเชื่อมต่อกับ Telegram Bot เรียบร้อยแล้วค่ะ ✅\nเวลาทดสอบ: ${nowTime} น.`;
    return sendTelegramMessageToAdmin(text, { botToken: customToken, chatId: customChatId });
}
