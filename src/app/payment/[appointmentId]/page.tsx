"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, db } from '@/app/lib/supabaseDb';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import { Appointment } from '@/types';

export default function PaymentPage() {
    const params = useParams();
    const appointmentId = params?.appointmentId as string;
    const [appointment, setAppointment] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [paymentSettings, setPaymentSettings] = useState<any | null>(null);

    useEffect(() => {
        const fetchAppointmentAndSettings = async () => {
            if (!appointmentId) {
                setError('ไม่พบรหัสการนัดหมาย');
                setLoading(false);
                return;
            }

            try {
                // Fetch Payment Settings first
                const paymentRef = doc(db, 'settings', 'payment');
                const paymentSnap = await getDoc(paymentRef);
                if (!paymentSnap.exists()) {
                    throw new Error("ไม่พบการตั้งค่าการชำระเงินของร้านค้า");
                }
                const settings = paymentSnap.data();
                setPaymentSettings(settings);

                // Fetch Appointment
                const appointmentRef = doc(db, 'appointments', appointmentId);
                const appointmentSnap = await getDoc(appointmentRef);
                if (!appointmentSnap.exists()) {
                    throw new Error("ไม่พบข้อมูลการนัดหมาย");
                }
                const appointmentData = { id: appointmentSnap.id, ...appointmentSnap.data() } as Appointment;
                setAppointment(appointmentData);

                // Generate QR Code based on settings
                if (settings.method === 'image') {
                    if (!settings.qrCodeImageUrl) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่ารูปภาพ QR Code");
                    }
                    setQrCodeDataUrl(settings.qrCodeImageUrl);
                } else if (settings.method === 'promptpay') {
                    const amount = Number(appointmentData.paymentInfo?.totalPrice);
                    if (isNaN(amount) || amount <= 0) {
                        throw new Error("ยอดชำระของรายการนี้ไม่ถูกต้อง");
                    }
                    if (!settings.promptPayAccount) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่าบัญชี PromptPay");
                    }
                    const payload = generatePayload(settings.promptPayAccount, { amount });
                    const qrCodeUrl = await QRCode.toDataURL(payload, { width: 300 });
                    setQrCodeDataUrl(qrCodeUrl);
                } else if (settings.method === 'bankinfo') {
                    if (!settings.bankInfoText) {
                        throw new Error("ร้านค้ายังไม่ได้ตั้งค่าข้อมูลบัญชีธนาคาร");
                    }
                    // ไม่ต้องสร้าง QR Code สำหรับ bankinfo
                } else {
                    throw new Error("รูปแบบการชำระเงินที่ร้านค้าตั้งค่าไว้ไม่ถูกต้อง");
                }

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointmentAndSettings();
    }, [appointmentId]);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#d7ccc8] border-t-[#5d4037] mx-auto mb-3"></div>
                <p className="text-[#8d6e63] text-xs font-medium">กำลังโหลดข้อมูลการชำระเงิน...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-6">
                <div className="bg-white rounded-3xl border border-rose-200 p-6 text-center shadow-md space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto text-xl font-bold">
                        !
                    </div>
                    <h3 className="text-base font-bold text-[#3e2723]">เกิดข้อผิดพลาด</h3>
                    <p className="text-xs text-[#5d4037]">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-[#e7e0da] shadow-md p-6 text-center space-y-5">
                {/* Header */}
                <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border bg-[#f5f2ed] text-[#5d4037] border-[#d7ccc8]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5d4037]" />
                        <span>รอชำระเงิน</span>
                    </span>
                    <h1 className="text-base font-bold text-[#3e2723] pt-1">
                        {appointment?.serviceInfo?.name || 'บริการสปา & นวดเพื่อสุขภาพ'}
                    </h1>
                    {appointment?.id && (
                        <p className="font-mono text-[11px] text-[#8d6e63]">
                            รหัสนัดหมาย: {appointment.id}
                        </p>
                    )}
                </div>

                {/* Price Display Box */}
                <div className="p-4 rounded-2xl bg-[#f5f2ed] border border-[#d7ccc8] space-y-1">
                    <span className="text-[11px] font-bold text-[#8d6e63] uppercase tracking-wide block">
                        ยอดที่ต้องชำระสุทธิ
                    </span>
                    <div className="text-3xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
                        {appointment?.paymentInfo?.totalPrice?.toLocaleString() || '0'}{' '}
                        <span className="text-base font-bold text-[#5d4037]">บาท</span>
                    </div>
                </div>

                {/* QR Section */}
                <div className="space-y-3">
                    {paymentSettings?.method === 'bankinfo' ? (
                        <div className="bg-[#faf8f5] rounded-2xl p-4 text-left border border-[#d7ccc8] space-y-2">
                            <div className="flex items-center gap-2 pb-2 border-b border-[#e7e0da]">
                                <svg className="w-4 h-4 text-[#5d4037]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span className="font-bold text-xs text-[#3e2723]">ข้อมูลบัญชีธนาคารสำหรับโอนเงิน</span>
                            </div>
                            <pre className="whitespace-pre-wrap font-sans text-[#3e2723] leading-relaxed text-xs">
                                {paymentSettings.bankInfoText}
                            </pre>
                        </div>
                    ) : qrCodeDataUrl ? (
                        <div className="flex flex-col items-center space-y-3">
                            {/* QR Image Plate */}
                            <div className="p-3 bg-white rounded-2xl border border-[#d7ccc8] shadow-2xs inline-block">
                                <img
                                    src={qrCodeDataUrl}
                                    alt="QR Code สำหรับชำระเงิน"
                                    className="w-[190px] h-[190px] object-contain rounded-xl"
                                />
                            </div>

                            {/* PromptPay Number Badge */}
                            {paymentSettings?.method === 'promptpay' && (
                                <div className="inline-flex items-center gap-2 bg-[#f5f2ed] px-3 py-1.5 rounded-xl border border-[#d7ccc8]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#5d4037]" />
                                    <span className="text-xs font-mono font-bold text-[#3e2723] tabular-nums">
                                        พร้อมเพย์: {paymentSettings.promptPayAccount}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-rose-50 text-rose-700 text-xs p-3.5 rounded-xl border border-rose-200">
                            <p className="font-semibold">ไม่สามารถสร้าง QR Code สำหรับชำระเงินได้</p>
                        </div>
                    )}
                </div>

                {/* Footer instructions */}
                <div className="pt-4 border-t border-dashed border-[#e7e0da] text-center">
                    <p className="text-xs text-[#8d6e63] leading-relaxed">
                        สแกน QR Code เพื่อชำระเงินตามยอดข้างต้น<br />
                        <span className="font-semibold text-[#5d4037]">เมื่อชำระแล้ว กรุณาส่งสลิปหลักฐานผ่านทาง LINE OA</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
