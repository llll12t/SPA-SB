"use server";
import { getShopProfile } from './settingsActions';
import { ServiceInfoSnap } from '@/types';

/**
 * Helper function to format service name with multi-area package info
 */
function formatServiceName(serviceInfo: ServiceInfoSnap): string {
    let serviceName = serviceInfo?.name || 'บริการของคุณ';

    // เพิ่มข้อมูล multi-area และ package ถ้ามี
    if (serviceInfo?.selectedArea && serviceInfo?.selectedPackage) {
        serviceName = `${serviceName}\n📍 ${serviceInfo.selectedArea.name}\n📦 ${serviceInfo.selectedPackage.duration} นาที`;
    }

    return serviceName;
}

export async function createPaymentFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, paymentInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalAmount || paymentInfo?.totalPrice || serviceInfo?.price || 0;
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);

    const serviceName = formatServiceName(serviceInfo);

    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';

    return {
        type: "flex",
        altText: `ชำระเงิน ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ชำระเงิน", weight: "bold", size: "md", color: "#553734", align: "center", margin: "none" },
                    { type: "separator", margin: "md", color: "#553734" },
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "text", text: "กรุณาชำระเงินสำหรับการจองของคุณ", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time, size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    },
                    {
                        type: "box", layout: "horizontal",
                        contents: [{ type: "text", text: "ยอดชำระ", weight: "bold", size: "md", color: "#333333", flex: 0 }, { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "md", color: "#553734", align: "end" }],
                        margin: "md", paddingAll: "16px", backgroundColor: "#F5F2ED", cornerRadius: "8px"
                    }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box", layout: "vertical",
                contents: [{ type: "button", style: "primary", height: "sm", action: { type: "uri", label: "ชำระเงิน", uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/payment/${id}` }, color: "#553734" }],
                spacing: "sm", paddingAll: "20px"
            }
        }
    };
}

export async function createReviewFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || appointmentId || '').toString();
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return {
        type: "flex",
        altText: `ให้คะแนนรีวิว ${serviceName}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ให้คะแนนรีวิว", weight: "bold", size: "md", color: "#553734", align: "center", margin: "none" },
                    { type: "separator", margin: "md", color: "#553734" },
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "text", text: "ช่วยรีวิวบริการของเรา", size: "md", color: "#553734", weight: "bold", margin: "sm" },
                    { type: "text", text: "เพื่อช่วยให้เราปรับปรุงบริการให้ดียิ่งขึ้น", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time, size: "sm", color: "#333333", flex: 1, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    },
                    { type: "box", layout: "vertical", contents: [{ type: "text", text: "กดปุ่มด้านล่างเพื่อให้คะแนนและแสดงความคิดเห็น", size: "sm", color: "#553734", wrap: true, align: "center" }], margin: "md", paddingAll: "12px", backgroundColor: "#F5F2ED", cornerRadius: "8px" }
                ],
                spacing: "md",
                paddingAll: "20px"
            },
            footer: {
                type: "box", layout: "vertical",
                contents: [{ type: "button", style: "primary", height: "sm", action: { type: "uri", label: "ให้คะแนน", uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/review/${safeId}` }, color: "#553734" }],
                spacing: "sm", paddingAll: "20px"
            }
        }
    };
}

export async function createReviewThankYouFlexTemplate(reviewData: any) {
    const { rating, comment, customerName } = reviewData;
    const stars = '⭐'.repeat(rating);
    const customerDisplayName = customerName || 'คุณลูกค้า';

    return {
        type: "flex",
        altText: `🎉 ขอบคุณสำหรับรีวิว ${rating} ดาว`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ขอบคุณสำหรับรีวิว!", weight: "bold", size: "md", color: "#553734", align: "center", margin: "none" },
                    { type: "text", text: stars, size: "md", color: "#553734", align: "center", margin: "sm" },
                    { type: "separator", margin: "md", color: "#553734" },
                    { type: "text", text: `เรียน ${customerDisplayName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "คะแนนที่ให้", size: "md", color: "#666666", flex: 0 }, { type: "text", text: `${rating}/5 ดาว`, weight: "bold", size: "md", color: "#553734", align: "end" }], margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px" },
                    ...(comment ? [
                        { type: "text", text: "ความคิดเห็น", size: "sm", color: "#666666", margin: "md" },
                        { type: "box", layout: "vertical", contents: [{ type: "text", text: `"${comment}"`, size: "md", color: "#333333", wrap: true, style: "italic" }], margin: "sm", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px" }
                    ] : []),
                    { type: "box", layout: "vertical", contents: [{ type: "text", text: "ความคิดเห็นของคุณมีค่ามากสำหรับเรา เราจะนำไปปรับปรุงบริการต่อไป", size: "sm", color: "#553734", wrap: true, align: "center" }], margin: "md", paddingAll: "12px", backgroundColor: "#F5F2ED", cornerRadius: "8px" }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

export async function createAppointmentConfirmedFlexTemplate(appointmentData: any) {
    const { serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || 'จะแจ้งให้ทราบ';
    const appointmentDate = new Date(date).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return {
        type: "flex",
        altText: `การจองได้รับการยืนยันแล้ว`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ยืนยันการจอง", weight: "bold", size: "md", color: "#4CAF50", align: "center", margin: "none" },
                    { type: "separator", margin: "md", color: "#4CAF50" },
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "text", text: `การจอง "${serviceName}" ได้รับการยืนยันแล้ว`, size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time, size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ช่างผู้ให้บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    },
                    { type: "box", layout: "vertical", contents: [{ type: "text", text: "ขอบคุณที่ไว้ใจเรา ขอให้มีวันที่ยอดเยี่ยม", size: "sm", color: "#4CAF50", wrap: true, align: "center" }], margin: "md", paddingAll: "12px", backgroundColor: "#E8F5E8", cornerRadius: "8px" }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

export async function createServiceCompletedFlexTemplate(appointmentData: any) {
    const { serviceInfo, customerInfo, totalPointsAwarded, note } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);

    return {
        type: "flex",
        altText: `บริการเสร็จสมบูรณ์`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "บริการเสร็จสมบูรณ์", weight: "bold", size: "md", color: "#553734", align: "center", margin: "none" },
                    { type: "separator", margin: "md", color: "#553734" },
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "text", text: `บริการ "${serviceName}" เสร็จสิ้นเรียบร้อยแล้ว`, size: "md", color: "#553734", weight: "bold", margin: "sm" },
                    { type: "text", text: "หวังว่าคุณจะพึงพอใจกับบริการของเรา", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    ...(totalPointsAwarded && totalPointsAwarded > 0 ? [
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "พ้อยที่ได้รับ", size: "md", color: "#666666", flex: 0 }, { type: "text", text: `${totalPointsAwarded} พ้อย`, weight: "bold", size: "md", color: "#553734", align: "end" }], margin: "md", paddingAll: "12px", backgroundColor: "#F5F2ED", cornerRadius: "8px" }
                    ] : []),
                    ...(note && note.trim() ? [
                        { type: "box", layout: "vertical", contents: [{ type: "text", text: note.trim(), size: "sm", color: "#333333", wrap: true, align: "center", weight: "bold" }], margin: "md", paddingAll: "12px", backgroundColor: "#E8F5E8", cornerRadius: "8px" }
                    ] : []),
                    { type: "box", layout: "vertical", contents: [{ type: "text", text: "ขอบคุณที่ใช้บริการ หากมีข้อเสนอแนะยินดีรับฟังเสมอ", size: "sm", color: "#553734", wrap: true, align: "center" }], margin: "md", paddingAll: "12px", backgroundColor: "#F5F2ED", cornerRadius: "8px" }
                ],
                spacing: "md",
                paddingAll: "20px"
            }
        }
    };
}

export async function createAppointmentCancelledFlexTemplate(appointmentData: any, reason: string) {
    const { id, serviceInfo, customerInfo, date, time } = appointmentData;
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const safeId = (id || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    let appointmentDate = date;
    try { appointmentDate = new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}

    return {
        type: "flex",
        altText: "แจ้งยกเลิกการจอง",
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    { type: "text", text: "ยกเลิกการจอง", weight: "bold", size: "md", color: "#D32F2F", align: "center" },
                    { type: "separator", margin: "md", color: "#D32F2F" },
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333", margin: "md" },
                    { type: "text", text: `การจอง "${serviceName}" ถูกยกเลิก`, size: "sm", color: "#D32F2F", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เหตุผล", size: "sm", color: "#666666", flex: 1 }, { type: "text", text: reason || "ไม่ได้ระบุ", size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#FFEBEE", cornerRadius: "8px"
                    }
                ],
                paddingAll: "20px",
                spacing: "md"
            }
        }
    };
}

export async function createNewBookingFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceName, serviceInfo, customerInfo, date, time, paymentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const resolvedServiceName = serviceName || serviceInfo?.name || 'บริการของคุณ';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const totalAmount = paymentInfo?.totalPrice ?? paymentInfo?.totalAmount ?? serviceInfo?.price ?? 0;
    const { profile } = await getShopProfile();
    const currencySymbol = profile?.currencySymbol || 'บาท';
    const formattedAmount = new Intl.NumberFormat('th-TH').format(totalAmount);
    let appointmentDate = date;
    try { appointmentDate = new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}

    return {
        type: "flex",
        altText: `✅ จองบริการ "${resolvedServiceName}" สำเร็จ`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box", layout: "vertical",
                contents: [{ type: "text", text: "✅ จองบริการสำเร็จ", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#553734", paddingAll: "16px"
            },
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ระบบได้รับการจองของคุณเรียบร้อยแล้ว กรุณารอการยืนยันจากทีมงาน", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: resolvedServiceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ยอดรวม", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${formattedAmount} ${currencySymbol}`, size: "sm", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    }
                ],
                spacing: "md", paddingAll: "20px"
            }
        }
    };
}

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
    let appointmentDate = date;
    try { appointmentDate = new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}

    return {
        type: "flex",
        altText: `✅ ยืนยันการชำระเงิน ${formattedAmount} ${currencySymbol}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box", layout: "vertical",
                contents: [{ type: "text", text: "✅ ยืนยันการชำระเงิน", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#4CAF50", paddingAll: "16px"
            },
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "การชำระเงินของคุณได้รับการยืนยันเรียบร้อยแล้ว", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    },
                    {
                        type: "box", layout: "horizontal",
                        contents: [{ type: "text", text: "ยอดชำระ", weight: "bold", size: "md", color: "#333333", flex: 0 }, { type: "text", text: `${formattedAmount} ${currencySymbol}`, weight: "bold", size: "md", color: "#4CAF50", align: "end" }],
                        margin: "md", paddingAll: "16px", backgroundColor: "#E8F5E9", cornerRadius: "8px"
                    }
                ],
                spacing: "md", paddingAll: "20px"
            }
        }
    };
}

export async function createAppointmentReminderFlexTemplate(bookingData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = bookingData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    let appointmentDate = date;
    try { appointmentDate = new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}

    return {
        type: "flex",
        altText: `🔔 แจ้งเตือนนัดหมาย "${serviceName}" วันนี้`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box", layout: "vertical",
                contents: [{ type: "text", text: "🔔 แจ้งเตือนนัดหมาย", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#FF9800", paddingAll: "16px"
            },
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: `เรียน ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "ขอเตือนให้ทราบว่าคุณมีนัดหมายในวันนี้ค่ะ", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 2, align: "end" }, { type: "text", text: time || '', size: "sm", color: "#333333", flex: 1, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ช่าง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#333333", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#FFF8E1", cornerRadius: "8px"
                    },
                    { type: "box", layout: "vertical", contents: [{ type: "text", text: "หากต้องการเปลี่ยนแปลงหรือยกเลิก กรุณาติดต่อก่อนนะคะ", size: "sm", color: "#553734", wrap: true, align: "center" }], margin: "md", paddingAll: "12px", backgroundColor: "#F5F2ED", cornerRadius: "8px" }
                ],
                spacing: "md", paddingAll: "20px"
            }
        }
    };
}

export async function createDailyAppointmentNotificationFlexTemplate(appointmentData: any) {
    const { id, appointmentId, serviceInfo, customerInfo, date, time, appointmentInfo } = appointmentData;
    const safeId = (id || appointmentId || '').toString();
    const shortId = safeId ? safeId.substring(0, 8).toUpperCase() : '—';
    const customerName = customerInfo?.fullName || customerInfo?.firstName || 'คุณลูกค้า';
    const serviceName = formatServiceName(serviceInfo);
    const technicianName = appointmentInfo?.technicianInfo?.firstName || appointmentInfo?.technician || null;
    let appointmentDate = date;
    try { appointmentDate = new Date(date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (_) {}

    return {
        type: "flex",
        altText: `📅 นัดหมายของคุณวันนี้: ${serviceName} เวลา ${time || ''}`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box", layout: "vertical",
                contents: [{ type: "text", text: "📅 นัดหมายของคุณวันนี้", weight: "bold", size: "md", color: "#ffffff", align: "center" }],
                backgroundColor: "#553734", paddingAll: "16px"
            },
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: `สวัสดี ${customerName}`, weight: "bold", size: "md", color: "#333333" },
                    { type: "text", text: "คุณมีนัดหมายในวันนี้ค่ะ อย่าลืมมาตรงเวลานะคะ 😊", size: "sm", color: "#666666", wrap: true, margin: "sm" },
                    {
                        type: "box", layout: "vertical",
                        contents: [
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "บริการ", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: serviceName, size: "sm", color: "#333333", flex: 3, wrap: true, align: "end" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "เวลา", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: time || '—', size: "sm", color: "#553734", flex: 3, align: "end", weight: "bold" }] },
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "วันที่", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: `${appointmentDate}`, size: "sm", color: "#333333", flex: 3, align: "end" }] },
                            ...(technicianName ? [{ type: "box", layout: "horizontal", contents: [{ type: "text", text: "ช่าง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: technicianName, size: "sm", color: "#333333", flex: 3, align: "end" }] }] : []),
                            { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รหัสการจอง", size: "sm", color: "#666666", flex: 2 }, { type: "text", text: shortId, size: "sm", color: "#333333", flex: 3, align: "end" }] }
                        ],
                        spacing: "sm", margin: "md", paddingAll: "12px", backgroundColor: "#F8F8F8", cornerRadius: "8px"
                    }
                ],
                spacing: "md", paddingAll: "20px"
            }
        }
    };
}
