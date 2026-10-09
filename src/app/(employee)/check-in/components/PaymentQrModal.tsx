"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import { getPaymentSettings } from '@/app/actions/settingsActions';
import { useLiffContext } from '@/context/LiffProvider';
import { Appointment } from '@/types';

interface PaymentQrModalProps {
    show: boolean;
    onClose: () => void;
    appointment: Appointment;
    profile: any;
}

export default function PaymentQrModal({ show, onClose, appointment, profile }: PaymentQrModalProps) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { liff } = useLiffContext();

    useEffect(() => {
        if (show && appointment) {
            const generateQR = async () => {
                setLoading(true);
                setError('');
                setQrCodeUrl('');
                try {
                    const lineAccessToken = liff?.getAccessToken?.();
                    const settingsResult = await getPaymentSettings({ lineAccessToken });
                    if (!settingsResult.success || !settingsResult.settings) {
                        throw new Error(settingsResult.error || "ไม่พบการตั้งค่าการชำระเงิน");
                    }

                    const settings: any = settingsResult.settings;
                    if (settings.method === 'image') {
                        if (!settings.qrCodeImageUrl) throw new Error("แอดมินยังไม่ได้ตั้งค่ารูปภาพ QR Code");
                        setQrCodeUrl(settings.qrCodeImageUrl);
                    } else if (settings.method === 'promptpay') {
                        if (!settings.promptPayAccount) throw new Error("แอดมินยังไม่ได้ตั้งค่าบัญชี PromptPay");
                        const amount = appointment.paymentInfo?.totalPrice || 0;
                        const payload = generatePayload(settings.promptPayAccount, { amount });
                        const url = await QRCode.toDataURL(payload);
                        setQrCodeUrl(url);
                    } else {
                        throw new Error("รูปแบบการชำระเงินไม่ถูกต้อง");
                    }
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointment, liff]);

    if (!show) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-[100] p-4 animate-in fade-in-50"
            onClick={onClose}
        >
            <div
                className="bg-white p-6 sm:p-7 rounded-3xl border border-[#e7e0da] shadow-2xl w-full max-w-sm text-center space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#5d4037] bg-[#f5ede8] border border-[#e8ddd7]">
                        PromptPay / QR Code
                    </span>
                    <h2 className="text-base font-bold text-[#3e2723] mt-2">
                        สแกนเพื่อชำระเงิน
                    </h2>
                    <p className="text-2xl font-extrabold text-[#3e2723] font-mono mt-1">
                        {appointment.paymentInfo?.totalPrice?.toLocaleString() || 0}{' '}
                        <span className="text-xs font-bold text-[#8d6e63] font-sans">
                            {profile?.currencySymbol || 'บาท'}
                        </span>
                    </p>
                </div>

                {/* QR Code Container */}
                <div className="w-64 h-64 mx-auto rounded-2xl border border-[#e7e0da] bg-[#faf8f5] p-3 flex items-center justify-center shadow-inner">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin" />
                            <p className="text-xs font-medium text-[#8d6e63]">กำลังสร้าง QR Code...</p>
                        </div>
                    ) : error ? (
                        <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
                            {error}
                        </div>
                    ) : qrCodeUrl ? (
                        <div className="relative w-full h-full">
                            <Image
                                src={qrCodeUrl}
                                alt="Payment QR Code"
                                fill
                                className="object-contain rounded-xl"
                                unoptimized
                            />
                        </div>
                    ) : null}
                </div>

                <p className="text-[11px] text-[#8d6e63]">
                    ให้ลูกค้าเปิดแอปพลิเคชันธนาคารเพื่อสแกน QR Code นี้
                </p>

                <button
                    onClick={onClose}
                    className="w-full h-11 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        </div>
    );
}
