'use server';

import { getShopProfile, getNotificationSettings } from './settingsActions';

/**
 * Generates a Flex Message JSON payload for a new booking confirmation.
 * This is called from the client so liff.sendMessages() can send it as the user.
 */
export async function getNewBookingFlexJson(bookingData: {
    appointmentId: string;
    serviceName: string;
    date: string;
    time: string;
    customerName: string;
    totalPrice: number;
    addOns?: { name: string; price: number }[];
    couponName?: string | null;
    discount?: number;
}) {
    const { appointmentId, serviceName, date, time, customerName, totalPrice, addOns, couponName, discount } = bookingData;
    const shortId = appointmentId.substring(0, 8).toUpperCase();

    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';
    const shopName = profile?.shopName || 'ร้านของเรา';

    let liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';
    if (!liffId) {
        try {
            const { settings } = await getNotificationSettings();
            liffId = settings?.lineNotifications?.liffId?.trim() || '';
        } catch {}
    }
    const myAppointmentsUri = liffId ? `https://liff.line.me/${liffId}/my-appointments` : 'https://spa-sb.vercel.app/my-appointments';

    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalPrice);

    let appointmentDate = date;
    try {
        appointmentDate = new Date(date).toLocaleDateString('th-TH', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (_) {}

    const summaryRows: any[] = [
        {
            type: 'box', layout: 'horizontal',
            contents: [
                { type: 'text', text: 'บริการ', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: serviceName, size: 'xs', color: '#222222', flex: 3, wrap: true, align: 'end', weight: 'bold' }
            ]
        },
        {
            type: 'box', layout: 'horizontal',
            contents: [
                { type: 'text', text: 'วันที่', size: 'xs', color: '#777777', flex: 2 },
                { type: 'text', text: `${appointmentDate}`, size: 'xs', color: '#222222', flex: 2, align: 'end' },
                { type: 'text', text: time || '', size: 'xs', color: '#553734', flex: 1, align: 'end', weight: 'bold' }
            ]
        },
    ];

    if (addOns && addOns.length > 0) {
        addOns.forEach(a => {
            summaryRows.push({
                type: 'box', layout: 'horizontal',
                contents: [
                    { type: 'text', text: `+ ${a.name}`, size: 'xs', color: '#888888', flex: 2 },
                    { type: 'text', text: `${new Intl.NumberFormat('th-TH').format(a.price)} ${currencySymbol}`, size: 'xs', color: '#888888', flex: 3, align: 'end' }
                ]
            });
        });
    }

    if (discount && discount > 0) {
        summaryRows.push({
            type: 'box', layout: 'horizontal',
            contents: [
                { type: 'text', text: couponName ? `ส่วนลด (${couponName})` : 'ส่วนลด', size: 'xs', color: '#2E7D32', flex: 2 },
                { type: 'text', text: `-${new Intl.NumberFormat('th-TH').format(discount)} ${currencySymbol}`, size: 'xs', color: '#2E7D32', flex: 3, align: 'end' }
            ]
        });
    }

    summaryRows.push({
        type: 'box', layout: 'horizontal',
        contents: [
            { type: 'text', text: 'รหัสการจอง', size: 'xs', color: '#777777', flex: 2 },
            { type: 'text', text: shortId, size: 'xs', color: '#222222', flex: 3, align: 'end', weight: 'bold' }
        ]
    });

    const flexMessage = {
        type: 'flex',
        altText: `ส่งคำขอจองบริการ "${serviceName}" สำเร็จ`,
        contents: {
            type: 'bubble',
            size: 'mega',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'ส่งคำขอจองบริการสำเร็จ',
                        weight: 'bold',
                        size: 'lg',
                        color: '#3E2723'
                    },
                    {
                        type: 'text',
                        text: shopName,
                        size: 'xs',
                        color: '#8D6E63',
                        margin: 'xs'
                    },
                    {
                        type: 'separator',
                        color: '#EFEBE9',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: `เรียน ${customerName}`,
                        weight: 'bold',
                        size: 'sm',
                        color: '#333333',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: 'ระบบได้รับการจองของคุณเรียบร้อยแล้ว กรุณารอการตรวจสอบและยืนยันจากทางร้าน',
                        size: 'xs',
                        color: '#666666',
                        wrap: true,
                        margin: 'xs'
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: summaryRows,
                        spacing: 'sm',
                        margin: 'md',
                        paddingAll: '12px',
                        backgroundColor: '#F9F7F5',
                        cornerRadius: '8px'
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'ยอดรวม', weight: 'bold', size: 'sm', color: '#333333', flex: 2 },
                            { type: 'text', text: `${formattedAmount} ${currencySymbol}`, weight: 'bold', size: 'md', color: '#553734', align: 'end', flex: 3 }
                        ],
                        margin: 'md',
                        paddingAll: '12px',
                        backgroundColor: '#F5F0EB',
                        cornerRadius: '8px'
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: 'ขอบคุณที่เลือกใช้บริการของเรา กรุณามาตรงเวลานะคะ',
                                size: 'xs',
                                color: '#553734',
                                wrap: true,
                                align: 'center'
                            }
                        ],
                        margin: 'md',
                        paddingAll: '10px',
                        backgroundColor: '#F9F7F5',
                        cornerRadius: '8px'
                    }
                ],
                spacing: 'sm',
                paddingAll: '18px'
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        height: 'sm',
                        action: {
                            type: 'uri',
                            label: 'ดูรายการจองของฉัน',
                            uri: myAppointmentsUri
                        },
                        color: '#553734'
                    }
                ],
                spacing: 'sm',
                paddingAll: '14px'
            }
        }
    };

    return { success: true, flexMessage };
}
