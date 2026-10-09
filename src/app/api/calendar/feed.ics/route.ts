import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/supabaseDb';
import { getShopProfile } from '@/app/actions/settingsActions';

/**
 * Format Date & Time string to iCalendar UTC/Local format: YYYYMMDDTHHMMSS
 */
function formatIcsDateTime(dateStr: string, timeStr: string, durationMinutes = 60) {
    try {
        // Expected dateStr: YYYY-MM-DD, timeStr: HH:mm
        const [year, month, day] = (dateStr || '').split('-').map(Number);
        const [hour, min] = (timeStr || '09:00').split(':').map(Number);

        if (!year || !month || !day) return null;

        const startDate = new Date(year, month - 1, day, hour || 0, min || 0, 0);
        const endDate = new Date(startDate.getTime() + (durationMinutes || 60) * 60000);

        const pad = (n: number) => n.toString().padStart(2, '0');

        const startIcs = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(startDate.getHours())}${pad(startDate.getMinutes())}00`;
        const endIcs = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

        return { startIcs, endIcs };
    } catch {
        return null;
    }
}

/**
 * Escape text for iCalendar syntax
 */
function escapeIcsText(str: string): string {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        // Check Calendar Settings
        const settingsRef = db.collection('settings').doc('calendar');
        const settingsSnap = await settingsRef.get();
        const settings = settingsSnap.exists ? settingsSnap.data() : {};

        // If explicitly disabled
        if (settings?.enabled === false) {
            return new NextResponse('Calendar feed is disabled.', { status: 403 });
        }

        // Token validation if feedToken is configured
        if (settings?.feedToken && token !== settings.feedToken) {
            return new NextResponse('Unauthorized: Invalid calendar feed token.', { status: 401 });
        }

        // Shop Profile for Store Name & Address
        const { profile } = await getShopProfile();
        const storeName = profile?.storeName || 'SPA & Massage';
        const address = profile?.address || '';

        // Query appointments (confirmed, completed, awaiting_confirmation)
        const appointmentsSnapshot = await db.collection('appointments')
            .where('status', 'in', ['confirmed', 'awaiting_confirmation', 'completed'])
            .get();

        const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const eventsIcs: string[] = [];

        appointmentsSnapshot.forEach((doc: any) => {
            const data = doc.data();
            const dateStr = data.date;
            const timeStr = data.time;
            const duration = Number(data.serviceInfo?.duration || data.appointmentInfo?.duration || 60);

            const dt = formatIcsDateTime(dateStr, timeStr, duration);
            if (!dt) return;

            const serviceName = data.serviceInfo?.name || 'บริการสปา';
            const customerName = data.customerInfo?.fullName || data.customerInfo?.firstName || 'ลูกค้า';
            const phone = data.customerInfo?.phone || '';
            const technicianName = data.appointmentInfo?.technicianInfo?.firstName || data.appointmentInfo?.technician || 'ไม่ระบุ';
            const statusThai = data.status === 'confirmed' ? 'ยืนยันแล้ว' : data.status === 'completed' ? 'เสร็จสิ้น' : 'รอยืนยัน';

            const summary = `[${storeName}] ${serviceName} - ${customerName}`;
            const description = `ลูกค้า: ${customerName}\nเบอร์โทร: ${phone}\nบริการ: ${serviceName}\nช่าง: ${technicianName}\nสถานะ: ${statusThai}\nรหัสการจอง: ${doc.id.substring(0, 8).toUpperCase()}`;

            eventsIcs.push([
                'BEGIN:VEVENT',
                `UID:${doc.id}@${request.headers.get('host') || 'spa-system'}`,
                `DTSTAMP:${nowStamp}`,
                `DTSTART;TZID=Asia/Bangkok:${dt.startIcs}`,
                `DTEND;TZID=Asia/Bangkok:${dt.endIcs}`,
                `SUMMARY:${escapeIcsText(summary)}`,
                `DESCRIPTION:${escapeIcsText(description)}`,
                address ? `LOCATION:${escapeIcsText(address)}` : '',
                `STATUS:${data.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
                'END:VEVENT'
            ].filter(Boolean).join('\r\n'));
        });

        // Assemble full VCALENDAR document
        const icsBody = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SPA Management System//TH',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${escapeIcsText(storeName + ' นัดหมาย')}`,
            'X-WR-TIMEZONE:Asia/Bangkok',
            'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
            'X-PUBLISHED-TTL:PT15M',
            ...eventsIcs,
            'END:VCALENDAR'
        ].join('\r\n');

        return new NextResponse(icsBody, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'inline; filename="spa-appointments.ics"',
                'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
            }
        });

    } catch (error: any) {
        console.error('Error generating calendar feed:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
