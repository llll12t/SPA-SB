"use server";

/**
 * Type definition for appointment data
 */
interface AppointmentData {
    appointmentInfo?: {
        dateTime?: string | Date;
        duration?: number | string;
    };
    serviceInfo?: {
        name?: string;
    };
    customerInfo?: {
        fullName?: string;
        phone?: string;
    };
    paymentInfo?: {
        totalPrice?: number;
    };
    status?: string;
    googleCalendarEventId?: string;
    [key: string]: any;
}

/**
 * การซิงค์ปฏิทินตอนนี้ทำงานผ่านระบบ iCalendar Feed (/api/calendar/feed.ics) อัตโนมัติ 100%
 * ไม่จำเป็นต้องใช้ Google Cloud Service Account หรือ Private Key อีกต่อไป
 * ฟังก์ชันเหล่านี้ยังคงอยู่เพื่อความเข้ากันได้ของระบบ โดยทำงานได้อย่างรวดเร็วและไม่เกิด Error
 */
export async function createOrUpdateCalendarEvent(appointmentId: string, appointmentData?: AppointmentData) {
    return { success: true, message: "Calendar sync handled dynamically via iCalendar feed." };
}

export async function deleteCalendarEvent(eventId?: string) {
    return { success: true, message: "Calendar deletion handled dynamically via iCalendar feed." };
}
