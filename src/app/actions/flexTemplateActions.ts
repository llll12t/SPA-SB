"use server";
import { getShopProfile, getNotificationSettings } from './settingsActions';

/**
 * Helper function to retrieve the effective LIFF ID dynamically
 * Checks process.env.NEXT_PUBLIC_LIFF_ID first, then DB notification settings
 */
async function getEffectiveLiffId(): Promise<string> {
    try {
        const notifRes = await getNotificationSettings();
        if (notifRes.success && notifRes.settings?.lineNotifications?.liffId) {
            return notifRes.settings.lineNotifications.liffId.trim();
        }
    } catch (e) {
        console.warn("Failed to get LIFF ID from settings:", e);
    }
    if (process.env.NEXT_PUBLIC_LIFF_ID && process.env.NEXT_PUBLIC_LIFF_ID.trim()) {
        return process.env.NEXT_PUBLIC_LIFF_ID.trim();
    }
    return '';
}

/**
 * Builds a safe LIFF or Web URL for single-LIFF path forwarding
 */
function buildLiffUrl(liffId: string, path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (liffId) {
        return `https://liff.line.me/${liffId}${cleanPath}`;
    }
    return `https://spa-sb.vercel.app${cleanPath}`;
}

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
 * Helper function to format service name with clean text without emojis
 */
function formatServiceName(serviceInfo: any): string {
    let serviceName = serviceInfo?.name || 'บริการสปา';

    if (serviceInfo?.selectedArea && serviceInfo?.selectedPackage) {
        serviceName = `${serviceName}\nบริเวณ: ${serviceInfo.selectedArea.name || ''}\nระยะเวลา: ${serviceInfo.selectedPackage.duration || ''} นาที`;
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
 * 1. Payment Flex Template (แจ้งชำระเงิน - ไม่มี Header)
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
    const liffId = await getEffectiveLiffId();
    const paymentUri = buildLiffUrl(liffId, `/payment/${safeId}`);

    return {
        type: "flex",
        altText: `แจ้งชำระเงิน ${formattedAmount} ${currencySymbol} - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "แจ้งชำระเงิน", weight: "bold", size: "lg", color: "#3E2723" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "กรุณาตรวจสอบรายละเอียดและดำเนินการชำระเงินสำหรับการนัดหมาย", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end", weight: "bold" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "ยอดที่ต้องชำระ", weight: "bold", size: "sm", color: "#333333", flex: 2 },
                            { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "md", color: "#553734", align: "end", flex: 3 }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F0EB",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            uri: paymentUri
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 2. Review Request Flex Template (ขอประเมินความพึงพอใจ - ไม่มี Header)
 */
export async function createReviewFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);
    const liffId = await getEffectiveLiffId();
    const reviewUri = buildLiffUrl(liffId, `/review/${safeId}`);

    return {
        type: "flex",
        altText: `ขอความคิดเห็นและประเมินบริการ ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ประเมินความพึงพอใจการบริการ", weight: "bold", size: "lg", color: "#3E2723" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "ความคิดเห็นของคุณมีคุณค่าอย่างยิ่ง เพื่อให้เราพัฒนาและส่งมอบบริการที่ดียิ่งขึ้น", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่รับบริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "ร่วมให้คะแนนและคำแนะนำเพื่อรับแต้มสะสมพิเศษ", size: "xs", color: "#553734", wrap: true, align: "center", weight: "bold" }
                        ],
                        margin: "sm",
                        paddingAll: "10px",
                        backgroundColor: "#F5F0EB",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            uri: reviewUri
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 3. Review Thank You Flex Template (ขอบคุณหลังส่งรีวิว - ไม่มี Header)
 */
export async function createReviewThankYouFlexTemplate(reviewData: any) {
    const rawRating = Number(reviewData?.rating);
    const rating = isNaN(rawRating) || rawRating < 1 ? 5 : Math.min(5, Math.floor(rawRating));
    const customerDisplayName = reviewData?.customerName || reviewData?.customerInfo?.fullName || 'คุณลูกค้า';
    const pointsAwarded = Number(reviewData?.pointsAwarded ?? reviewData?.points ?? 0);
    const comment = typeof reviewData?.comment === 'string' ? reviewData.comment.trim() : '';

    return {
        type: "flex",
        altText: `ขอบคุณสำหรับการประเมินบริการ ${rating} คะแนน - ${customerDisplayName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ขอบคุณสำหรับการประเมินบริการ", weight: "bold", size: "lg", color: "#3E2723", align: "center" },
                    { type: "text", text: `คะแนนประเมิน ${rating} / 5 คะแนน`, size: "sm", align: "center", weight: "bold", color: "#553734", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: `เรียน ${customerDisplayName}`, weight: "bold", size: "xs", color: "#795548", margin: "md" },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "คะแนนที่คุณมอบให้", size: "xs", color: "#666666", flex: 2 },
                            { type: "text", text: `${rating} จาก 5 คะแนน`, weight: "bold", size: "sm", color: "#553734", flex: 2, align: "end" }
                        ],
                        margin: "sm",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    ...(comment ? [
                        {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                { type: "text", text: "ความคิดเห็นของคุณ:", size: "xxs", color: "#888888" },
                                { type: "text", text: `"${comment}"`, size: "xs", color: "#333333", wrap: true, style: "italic", margin: "xs" }
                            ],
                            margin: "sm",
                            paddingAll: "12px",
                            backgroundColor: "#F9F7F5",
                            cornerRadius: "8px"
                        }
                    ] : []),
                    ...(pointsAwarded > 0 ? [
                        {
                            type: "box",
                            layout: "horizontal",
                            contents: [
                                { type: "text", text: "แต้มสะสมพิเศษที่ได้รับ", size: "xs", color: "#2E7D32", weight: "bold", flex: 2 },
                                { type: "text", text: `+${pointsAwarded} แต้ม`, weight: "bold", size: "sm", color: "#2E7D32", flex: 1, align: "end" }
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
                        backgroundColor: "#F5F0EB",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
            }
        }
    };
}

/**
 * 4. Appointment Confirmed Flex Template (ยืนยันการจอง - ไม่มี Header)
 */
export async function createAppointmentConfirmedFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || 'จะแจ้งให้ทราบ';
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = formatSafeDate(date);
    const liffId = await getEffectiveLiffId();
    const myAppointmentsUri = buildLiffUrl(liffId, '/my-appointments');

    return {
        type: "flex",
        altText: `ยืนยันการจองเรียบร้อย: ${serviceName} วันที่ ${appointmentDate}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ยืนยันการจองบริการ", weight: "bold", size: "lg", color: "#2E7D32" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "การจองบริการของคุณได้รับการยืนยันจากทางร้านเรียบร้อยแล้วค่ะ", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "xs", color: "#222222", flex: 3, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "กรุณามาถึงก่อนเวลา 10-15 นาทีเพื่อเตรียมความพร้อมนะคะ", size: "xs", color: "#2E7D32", wrap: true, align: "center", weight: "bold" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#E8F5E9",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            label: "📋 ดูรายการจองของฉัน",
                            uri: myAppointmentsUri
                        },
                        color: "#2E7D32"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 5. Service Completed Flex Template (บริการเสร็จสมบูรณ์ - ไม่มี Header)
 */
export async function createServiceCompletedFlexTemplate(appointmentData: any, options?: { includeReviewButton?: boolean }) {
    const { id, appointmentId, serviceInfo, customerInfo, totalPointsAwarded, note } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const liffId = await getEffectiveLiffId();
    const reviewUri = buildLiffUrl(liffId, `/review/${safeId}`);
    const points = Number(totalPointsAwarded || 0);

    const bubble: any = {
        type: "bubble",
        size: "mega",
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                { type: "text", text: "บริการเสร็จสิ้นสมบูรณ์", weight: "bold", size: "lg", color: "#3E2723" },
                { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                { type: "separator", color: "#EFEBE9", margin: "md" },
                { type: "text", text: `บริการ "${serviceName}" เสร็จสิ้นเรียบร้อยแล้ว`, size: "sm", color: "#553734", weight: "bold", margin: "md" },
                { type: "text", text: "หวังเป็นอย่างยิ่งว่าคุณจะได้รับความพึงพอใจและความผ่อนคลายสูงสุด", size: "xs", color: "#666666", wrap: true, margin: "xs" },
                ...(points > 0 ? [
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "แต้มสะสมที่ได้รับ", size: "xs", color: "#2E7D32", weight: "bold", flex: 2 },
                            { type: "text", text: `+${points} แต้ม`, weight: "bold", size: "sm", color: "#2E7D32", flex: 1, align: "end" }
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
                            { type: "text", text: "หมายเหตุจากผู้ให้บริการ:", size: "xxs", color: "#777777" },
                            { type: "text", text: note.trim(), size: "xs", color: "#333333", wrap: true, weight: "bold", margin: "xs" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
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
                    backgroundColor: "#F5F0EB",
                    cornerRadius: "8px"
                }
            ],
            spacing: "sm",
            paddingAll: "18px"
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
                        uri: reviewUri
                    },
                    color: "#553734"
                }
            ],
            spacing: "sm",
            paddingAll: "14px"
        };
    }

    return {
        type: "flex",
        altText: `บริการเสร็จสิ้นสมบูรณ์ - ขอบคุณคุณ ${customerName}`,
        contents: bubble
    };
}

/**
 * 6. Appointment Cancelled Flex Template (แจ้งยกเลิกนัดหมาย - ไม่มี Header)
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
        altText: `แจ้งยกเลิกการนัดหมาย - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "แจ้งยกเลิกการนัดหมาย", weight: "bold", size: "lg", color: "#D32F2F" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: `การจองบริการ "${serviceName}" ได้รับการยกเลิกเรียบร้อยแล้ว`, size: "xs", color: "#D32F2F", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#333333", flex: 3, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล", size: "xs", color: "#666666", flex: 2 }, { type: "text", text: reason || "ไม่ได้ระบุ", size: "xs", color: "#D32F2F", flex: 3, wrap: true, align: "end", weight: "bold" }] }
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
                            { type: "text", text: "หากท่านต้องการนัดหมายใหม่ สามารถเลือกทำรายการผ่าน LINE ได้ตลอดเวลาค่ะ", size: "xs", color: "#666666", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    }
                ],
                paddingAll: "18px",
                spacing: "sm"
            }
        }
    };
}

/**
 * 7. New Booking Flex Template (ตอบรับการส่งจองคิวใหม่ - ไม่มี Header)
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
    const liffId = await getEffectiveLiffId();
    const myAppointmentsUri = buildLiffUrl(liffId, '/my-appointments');

    return {
        type: "flex",
        altText: `ส่งคำขอจองบริการ "${resolvedServiceName}" สำเร็จ - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ส่งคำขอจองบริการสำเร็จ", weight: "bold", size: "lg", color: "#3E2723" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "ระบบได้รับการจองของคุณเรียบร้อยแล้ว กรุณารอการตรวจสอบและยืนยันจากทางร้าน", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: resolvedServiceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ยอดรวม", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${formattedAmount} ${currencySymbol}`, size: "xs", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            label: "📋 ดูรายการจองของฉัน",
                            uri: myAppointmentsUri
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 8. Payment Confirmation Flex Template (ยืนยันชำระเงิน - ไม่มี Header)
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
    const liffId = await getEffectiveLiffId();
    const myAppointmentsUri = buildLiffUrl(liffId, '/my-appointments');

    return {
        type: "flex",
        altText: `ยืนยันการชำระเงิน ${formattedAmount} ${currencySymbol} - รหัส ${shortId}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ยืนยันการชำระเงินเรียบร้อย", weight: "bold", size: "lg", color: "#2E7D32" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "ทางร้านได้รับการชำระเงินของคุณเรียบร้อยแล้ว การนัดหมายได้รับการยืนยันสมบูรณ์", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 2, align: "end" }, { type: "text", text: time || '', size: "xs", color: "#222222", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            { type: "text", text: "ยอดชำระแล้ว", weight: "bold", size: "sm", color: "#333333", flex: 2 },
                            { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "md", color: "#2E7D32", align: "end", flex: 3 }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#E8F5E9",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            label: "📋 ดูรายการจองของฉัน",
                            uri: myAppointmentsUri
                        },
                        color: "#2E7D32"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 9. Appointment Reminder 1 hour Flex Template (แจ้งเตือนล่วงหน้า 1 ชม. - ไม่มี Header)
 */
export async function createAppointmentReminderFlexTemplate(bookingData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = bookingData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    const appointmentDate = formatSafeDate(date);
    const liffId = await getEffectiveLiffId();
    const myAppointmentsUri = buildLiffUrl(liffId, '/my-appointments');

    return {
        type: "flex",
        altText: `แจ้งเตือนนัดหมาย: อีก 1 ชั่วโมงสำหรับบริการ ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "แจ้งเตือนการนัดหมาย", weight: "bold", size: "lg", color: "#795548" },
                    { type: "text", text: `เรียน ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "ขอแจ้งเตือนนัดหมายของคุณใกล้จะถึงเวลาในอีก 1 ชั่วโมงข้างหน้านี้ค่ะ", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: time || '', size: "sm", color: "#795548", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 3, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "xs", color: "#222222", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "หากติดขัดหรือต้องการปรับเปลี่ยนเวลา กรุณาติดต่อทางร้านโดยด่วนนะคะ", size: "xs", color: "#795548", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#EFEBE9",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            label: "📋 ดูรายละเอียดนัดหมาย",
                            uri: myAppointmentsUri
                        },
                        color: "#795548"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}

/**
 * 10. Daily Appointment Notification Flex Template (สรุปคิวนัดหมายประจำวัน - ไม่มี Header)
 */
export async function createDailyAppointmentNotificationFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    const appointmentDate = formatSafeDate(date);
    const liffId = await getEffectiveLiffId();
    const myAppointmentsUri = buildLiffUrl(liffId, '/my-appointments');

    return {
        type: "flex",
        altText: `นัดหมายของคุณวันนี้: ${serviceName} เวลา ${time || ''}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "นัดหมายบริการวันนี้", weight: "bold", size: "lg", color: "#3E2723" },
                    { type: "text", text: `สวัสดีค่ะ ${customerName}`, size: "xs", color: "#795548", margin: "xs" },
                    { type: "separator", color: "#EFEBE9", margin: "md" },
                    { type: "text", text: "วันนี้คุณมีนัดหมายบริการกับเรา กรุณาเผื่อเวลาในการเดินทางเพื่อความสะดวกค่ะ", size: "xs", color: "#666666", wrap: true, margin: "md" },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: serviceName, size: "xs", color: "#222222", flex: 3, wrap: true, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลานัด", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: time || '—', size: "sm", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "xs", color: "#222222", flex: 3, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ผู้ให้บริการ", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: technicianName, size: "xs", color: "#222222", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "xs", color: "#777777", flex: 2 }, { type: "text", text: shortId, size: "xs", color: "#222222", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm",
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F9F7F5",
                        cornerRadius: "8px"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            { type: "text", text: "เราพร้อมดูแลและมอบบริการที่ดีที่สุดให้คุณ แล้วพบกันนะคะ", size: "xs", color: "#553734", wrap: true, align: "center" }
                        ],
                        margin: "md",
                        paddingAll: "12px",
                        backgroundColor: "#F5F0EB",
                        cornerRadius: "8px"
                    }
                ],
                spacing: "sm",
                paddingAll: "18px"
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
                            label: "📋 ตรวจสอบเวลานัดหมาย",
                            uri: myAppointmentsUri
                        },
                        color: "#553734"
                    }
                ],
                spacing: "sm",
                paddingAll: "14px"
            }
        }
    };
}
