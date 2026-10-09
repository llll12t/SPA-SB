"use server";
import { getShopProfile } from './settingsActions';

/**
 * Helper function to safely format dates avoiding timezone offset bugs (e.g. UTC shifting back a day)
 */
function formatSafeDate(dateInput: any): string {
    if (!dateInput) return '—';
    try {
        if (typeof dateInput === 'object' && dateInput._seconds) {
            return new Date(dateInput._seconds * 1000).toLocaleDateString('th-TH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
            const [y, m, d] = dateInput.trim().split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('th-TH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        return d.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return String(dateInput || '—');
    }
}

/**
 * Helper function to format service name with multi-area / package / options info
 */
function formatServiceName(serviceInfo: any): string {
    let serviceName = serviceInfo?.name || 'บริการของคุณ';

    if (serviceInfo?.selectedArea && serviceInfo?.selectedPackage) {
        serviceName = `${serviceName}\n📍 ${serviceInfo.selectedArea.name || ''}\n📦 ${serviceInfo.selectedPackage.duration || ''} นาที`;
    } else if (serviceInfo?.selectedOptionName) {
        serviceName = `${serviceName} (${serviceInfo.selectedOptionName})`;
    } else if (Array.isArray(serviceInfo?.selectedAreaOptions) && serviceInfo.selectedAreaOptions.length > 0) {
        const optionNames = serviceInfo.selectedAreaOptions.map((o: any) => o.optionName || o.name).filter(Boolean).join(', ');
        if (optionNames) {
            serviceName = `${serviceName} (${optionNames})`;
        }
    }

    return serviceName;
}

/**
 * 1. Payment Flex Template (แจ้งชำระเงิน พร้อมลิงก์ไปหน้าชำระ)
 */
export async function createPaymentFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, paymentInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.totalPrice || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';

    return {
        type: "flex",
        altText: `💳 แจ้งชำระเงิน ${formattedAmount} ${currencySymbol} - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "💳 แจ้งชำระเงิน", weight: "bold", size: "md", color: "#ffffff", align: "center" }
                ],
                backgroundColor: "#553734",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "กรุณาชำระเงินสำหรับการจองบริการของคุณตามรายละเอียดด้านล่าง", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end", weight: "bold" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "ยอดที่ต้องชำระ", weight: "bold", size: "md", color: "#333333", flex: 2 },
                            { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "lg", color: "#553734", align: "end", flex: 3 }
                        ],
                        margin: "md",
                        paddingAll: "14px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ชำระเงินตอนนี้",
                            uri: `https://liff.line.me/${liffId}/payment/${safeId}`
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "16px"
            }
        }
    };
}

/**
 * 2. Review Request Flex Template (ขอรีวิวแยกเฉพาะ)
 */
export async function createReviewFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';

    return {
        type: "flex",
        altText: `⭐ ขอความคิดเห็นและรีวิวบริการ ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "⭐ ช่วยรีวิวบริการของเรา", weight: "bold", size: "md", color: "#ffffff", align: "center" }
                ],
                backgroundColor: "#553734",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ความคิดเห็นของคุณมีคุณค่าอย่างยิ่ง เพื่อให้เราพัฒนาและส่งมอบบริการที่ดียิ่งขึ้น", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่รับบริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "กดปุ่มด้านล่างเพื่อให้คะแนนและรับแต้มสะสมพิเศษ", size: "xs", color: "#553734", wrap: true, align: "center", weight: "bold" }
                        ],
                        margin: "sm",
                        paddingAll: "10px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "20px"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "⭐ ให้คะแนนและรีวิว",
                            uri: `https://liff.line.me/${liffId}/review/${safeId}`
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "16px"
            }
        }
    };
}

/**
 * 3. Review Thank You Flex Template (ขอบคุณหลังส่งรีวิว)
 */
export async function createReviewThankYouFlexTemplate(reviewData: any) {
    const rawRating = Number(reviewData?.rating);
    const rating = isNaN(rawRating) || rawRating < 1 ? 5 : Math.min(5, Math.floor(rawRating));
    const stars = '⭐'.repeat(rating);
    const customerDisplayName = reviewData?.customerName || reviewData?.customerInfo?.fullName || 'คุณลูกค้า';
    const pointsAwarded = Number(reviewData?.pointsAwarded ?? reviewData?.points ?? 0);
    const comment = typeof reviewData?.comment === 'string' ? reviewData.comment.trim() : '';

    return {
        type: "flex",
        altText: `🎉 ขอบคุณสำหรับรีวิว ${rating} ดาว - ${customerDisplayName}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "⭐ ขอบคุณสำหรับรีวิวของคุณ", weight: "bold", size: "md", color: "#ffffff", align: "center" }
                ],
                backgroundColor: "#553734",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: stars, size: "xl", align: "center", margin: "sm" },
                    { type: "text", text: `เรียน ${customerDisplayName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "คะแนนที่คุณมอบให้", size: "sm", color: "#666666", flex: 2 },
                            { type: "text", text: `${rating}/5 ดาว`, weight: "bold", size: "md", color: "#553734", flex: 1, align: "end" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    ...(comment ? [
                        {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                { type: "text", text: "ความคิดเห็นของคุณ:", size: "xs", color: "#888888" },
                                { type: "text", text: `"${comment}"`, size: "sm", color: "#333333", wrap: true, style: "italic", margin: "xs" }
                            ],
                            margin: "sm",
                            paddingAll: "12px",
                            backgroundColor: "#F8F8F8",
                            cornerRadius: "8px"
                        }
                    ] : []),
                    ...(pointsAwarded > 0 ? [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: "🎉 ได้รับแต้มสะสมพิเศษ", size: "sm", color: "#2E7D32", weight: "bold", flex: 2 },
                                { type: "text", text: `+${pointsAwarded} แต้ม`, weight: "bold", size: "md", color: "#2E7D32", flex: 1, align: "end" }
                            ],
                            margin: "sm",
                            paddingAll: "12px",
                            backgroundColor: "#E8F5E9",
                            cornerRadius: "8px"
                        }
                    ] : []),
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "ความคิดเห็นของคุณมีค่ามากสำหรับเรา ทางร้านจะนำไปพัฒนาบริการให้ดียิ่งขึ้นเสมอค่ะ", size: "xs", color: "#553734", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * 4. Appointment Confirmed Flex Template (ยืนยันการจอง)
 */
export async function createAppointmentConfirmedFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || 'จะแจ้งให้ทราบ';
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `✅ ยืนยันการจองเรียบร้อย: ${serviceName} วันที่ ${appointmentDate}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "✅ ยืนยันการจองเรียบร้อย", weight: "bold", size: "md", color: "#ffffff", align: "center" }
                ],
                backgroundColor: "#2E7D32",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: `การจองบริการของคุณได้รับการยืนยันจากทางร้านเรียบร้อยแล้วค่ะ`, size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#222222", flex: 3, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "ขอบคุณที่ไว้วางใจเรา กรุณามาถึงก่อนเวลา 10-15 นาทีนะคะ", size: "xs", color: "#2E7D32", wrap: true, align: "center", weight: "bold" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#E8F5E9",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * 5. Service Completed Flex Template (บริการเสร็จสมบูรณ์ พร้อมตัวเลือกปุ่มรีวิวแบบรวมในข้อความเดียว)
 */
export async function createServiceCompletedFlexTemplate(appointmentData: any, options?: { includeReviewButton?: boolean }) {
    const { id, appointmentId, serviceInfo, customerInfo, totalPointsAwarded, note } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';
    const points = Number(totalPointsAwarded || 0);

    const bubble: any = {
        type: "bubble",
        size: "mega",
        header: {
            type: "box",
            layout: "vertical",
            contents: [
                { type: "text", text: "✨ บริการเสร็จสมบูรณ์", weight: "bold", size: "md", color: "#ffffff", align: "center" }
            ],
            backgroundColor: "#553734",
            paddingAll: "16px"
        },
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                { type: "text", text: `บริการ "${serviceName}" เสร็จสิ้นเรียบร้อยแล้ว`, size: "md", color: "#553734", weight: "bold", margin: "sm" },
                { type: "text", text: "หวังเป็นอย่างยิ่งว่าคุณจะได้รับความพึงพอใจและความผ่อนคลายสูงสุด", size: "sm", color: "#666666", wrap: true, margin: "xs" },
                ...(points > 0 ? [
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "🎉 แต้มสะสมที่ได้รับ", size: "sm", color: "#2E7D32", weight: "bold", flex: 2 },
                            { type: "text", text: `+${points} แต้ม`, weight: "bold", size: "md", color: "#2E7D32", flex: 1, align: "end" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#E8F5E9",
                        cornerRadius: "8px"
                    }
                ] : []),
                ...(note && note.trim() ? [
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "หมายเหตุจากผู้ให้บริการ:", size: "xs", color: "#777777" },
                            { type: "text", text: note.trim(), size: "sm", color: "#333333", wrap: true, weight: "bold", margin: "xs" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    }
                ] : []),
                {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: "ขอบคุณที่เลือกใช้บริการของเรา หากมีข้อเสนอแนะยินดีรับฟังเสมอค่ะ", size: "xs", color: "#553734", wrap: true, align: "center" }
                    ],
                    margin: "md",
                    paddingAll: "12px",
                    backgroundColor: "#F5F2ED",
                    cornerRadius: "8px"
                }
            ],
            spacing: "sm",
            paddingAll: "20px"
        }
    };

    if (options?.includeReviewButton && safeId) {
        bubble.footer = {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "uri",
                        label: "⭐ ให้คะแนนและรีวิวบริการ",
                        uri: `https://liff.line.me/${liffId}/review/${safeId}`
                    },
                    color: "#553734"
                }
            ],
            spacing: "sm",
            paddingAll: "16px"
        };
    }

    return {
        type: "flex",
        altText: `✨ บริการเสร็จสมบูรณ์ - ขอบคุณคุณ ${customerName}`,
        contents: bubble
    };
}

/**
 * 6. Appointment Cancelled Flex Template (แจ้งยกเลิกนัดหมาย)
 */
export async function createAppointmentCancelledFlexTemplate(appointmentData: any, reason: string) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `❌ แจ้งยกเลิกการนัดหมาย - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "❌ แจ้งยกเลิกการนัดหมาย", weight: "bold", size: "md", color: "#ffffff", align: "center" }
                ],
                backgroundColor: "#D32F2F",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: `การจองบริการ "${serviceName}" ได้รับการยกเลิกเรียบร้อยแล้ว`, size: "sm", color: "#D32F2F", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: reason || "ไม่ได้ระบุ", size: "sm", color: "#D32F2F", flex: 3, wrap: true, align: "end", weight: "bold" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#FFEBEE",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "หากท่านต้องการนัดหมายใหม่ สามารถทำรายการจองผ่าน LINE OA ได้ตลอดเวลาค่ะ", size: "xs", color: "#666666", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    }
                ],
                paddingAll: "20px",
                spacing: "sm"
            }
        }
    };
}

/**
 * 7. New Booking Flex Template (ตอบรับการส่งจองคิวใหม่)
 */
export async function createNewBookingFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceName, serviceInfo, customerInfo, date, time, paymentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const resolvedServiceName = serviceName || formatServiceName(serviceInfo);
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalPrice ?? paymentInfo?.totalAmount ?? serviceInfo?.price ?? 0;
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `✅ ส่งคำขอจองคิว "${resolvedServiceName}" สำเร็จ - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: "✅ จองบริการสำเร็จ", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#553734",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ระบบได้รับการจองของคุณเรียบร้อยแล้ว กรุณารอการตรวจสอบและยืนยันจากทางร้าน", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: resolvedServiceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ยอดรวม", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${formattedAmount} ${currencySymbol}`, size: "sm", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * 8. Payment Confirmation Flex Template (ยืนยันชำระเงิน + ยืนยันคิวเรียบร้อย)
 */
export async function createPaymentConfirmationFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, paymentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const totalAmount = paymentInfo?.totalPrice ?? paymentInfo?.amountPaid ?? 0;
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `✅ ยืนยันการชำระเงิน ${formattedAmount} ${currencySymbol} - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: "✅ ยืนยันการชำระเงินเรียบร้อย", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#2E7D32",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ทางร้านได้รับการชำระเงินของคุณเรียบร้อยแล้ว การนัดหมายได้รับการยืนยันสมบูรณ์", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "ยอดชำระแล้ว", weight: "bold", size: "md", color: "#333333", flex: 2 },
                            { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "lg", color: "#2E7D32", align: "end", flex: 3 }
                        ],
                        margin: "md",
                        paddingAll: "14px",
                        backgroundColor: "#E8F5E9",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * 9. Appointment Reminder 1 hour Flex Template (แจ้งเตือนล่วงหน้า 1 ชม.)
 */
export async function createAppointmentReminderFlexTemplate(bookingData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = bookingData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `🔔 แจ้งเตือนนัดหมาย: อีก 1 ชั่วโมงสำหรับบริการ ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: "🔔 แจ้งเตือนนัดหมาย", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#F57C00",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ขอแจ้งเตือนนัดหมายของคุณใกล้จะถึงเวลาในอีก 1 ชั่วโมงข้างหน้านี้ค่ะ", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: time || '', size: "md", color: "#F57C00", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 3, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#222222", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#FFF8E1",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "หากติดขัดหรือต้องการปรับเปลี่ยนเวลา กรุณาติดต่อทางร้านโดยด่วนนะคะ", size: "xs", color: "#553734", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

/**
 * 10. Daily Appointment Notification Flex Template (สรุปคิวนัดหมายประจำวัน)
 */
export async function createDailyAppointmentNotificationFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    const appointmentDate = formatSafeDate(date);

    return {
        type: "flex",
        altText: `📅 คุณมีนัดหมายวันนี้: ${serviceName} เวลา ${time || ''}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: "📅 นัดหมายของคุณวันนี้", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#553734",
                paddingAll: "16px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: `สวัสดีค่ะ ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "วันนี้คุณมีนัดหมายบริการกับเรา อย่าลืมเผื่อเวลาในการเดินทางนะคะ 😊", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลานัด", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: time || '—', size: "md", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#222222", flex: 3, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#222222", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F8F8F8",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "เราพร้อมดูแลและมอบบริการที่ดีที่สุดให้คุณ แล้วพบกันนะคะ ✨", size: "xs", color: "#553734", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F2ED",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}
