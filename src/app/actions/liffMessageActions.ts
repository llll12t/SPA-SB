'use server';

import { getShopProfile } from './settingsActions';

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
                { type: 'text', text: 'บริการ', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: serviceName, size: 'sm', color: '#333333', flex: 3, wrap: true, align: 'end', weight: 'bold' }
            ]
        },
        {
            type: 'box', layout: 'horizontal',
            contents: [
                { type: 'text', text: 'วันที่', size: 'sm', color: '#666666', flex: 2 },
                { type: 'text', text: `${appointmentDate}`, size: 'sm', color: '#333333', flex: 2, align: 'end' },
                { type: 'text', text: time || '', size: 'sm', color: '#553734', flex: 1, align: 'end', weight: 'bold' }
            ]
        },
    ];

    if (addOns && addOns.length > 0) {
        addOns.forEach(a => {
            summaryRows.push({
                type: 'box', layout: 'horizontal',
                contents: [
                    { type: 'text', text: `+ ${a.name}`, size: 'sm', color: '#888888', flex: 2 },
                    { type: 'text', text: `${new Intl.NumberFormat('th-TH').format(a.price)} ${currencySymbol}`, size: 'sm', color: '#888888', flex: 3, align: 'end' }
                ]
            });
        });
    }

    if (discount && discount > 0) {
        summaryRows.push({
            type: 'box', layout: 'horizontal',
            contents: [
                { type: 'text', text: couponName ? `ส่วนลด (${couponName})` : 'ส่วนลด', size: 'sm', color: '#4CAF50', flex: 2 },
                { type: 'text', text: `-${new Intl.NumberFormat('th-TH').format(discount)} ${currencySymbol}`, size: 'sm', color: '#4CAF50', flex: 3, align: 'end' }
            ]
        });
    }

    summaryRows.push({
        type: 'box', layout: 'horizontal',
        contents: [
            { type: 'text', text: 'รหัสการจอง', size: 'sm', color: '#666666', flex: 2 },
            { type: 'text', text: shortId, size: 'sm', color: '#333333', flex: 3, align: 'end' }
        ]
    });

    const flexMessage = {
        type: 'flex',
        altText: `✅ จองบริการ "${serviceName}" สำเร็จ`,
        contents: {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    { type: 'text', text: '✅ จองบริการสำเร็จ', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                    { type: 'text', text: shopName, size: 'sm', color: '#f5e6e6', align: 'center', margin: 'xs' }
                ],
                backgroundColor: '#553734',
                paddingAll: '18px'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `เรียน ${customerName}`,
                        weight: 'bold',
                        size: 'md',
                        color: '#333333'
                    },
                    {
                        type: 'text',
                        text: 'ระบบได้รับการจองของคุณเรียบร้อยแล้ว กรุณารอการยืนยันจากทีมงาน',
                        size: 'sm',
                        color: '#666666',
                        wrap: true,
                        margin: 'sm'
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: summaryRows,
                        spacing: 'sm',
                        margin: 'md',
                        paddingAll: '12px',
                        backgroundColor: '#F8F8F8',
                        cornerRadius: '8px'
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'ยอดรวม', weight: 'bold', size: 'md', color: '#333333', flex: 0 },
                            { type: 'text', text: `${formattedAmount} ${currencySymbol}`, weight: 'bold', size: 'md', color: '#553734', align: 'end' }
                        ],
                        margin: 'md',
                        paddingAll: '14px',
                        backgroundColor: '#F5F2ED',
                        cornerRadius: '8px'
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🙏 ขอบคุณที่ไว้วางใจเรา กรุณามาตรงเวลานะคะ',
                                size: 'xs',
                                color: '#553734',
                                wrap: true,
                                align: 'center'
                            }
                        ],
                        margin: 'md',
                        paddingAll: '10px',
                        backgroundColor: '#FDF5F4',
                        cornerRadius: '8px'
                    }
                ],
                spacing: 'md',
                paddingAll: '20px'
            }
        }
    };

    return { success: true, flexMessage };
}
