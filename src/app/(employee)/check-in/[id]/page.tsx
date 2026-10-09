"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { useLiffContext } from '@/context/LiffProvider';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { updateAppointmentStatus, updatePaymentStatusByEmployee, findAppointmentById } from '@/app/actions/employeeActions';
import PaymentQrModal from '../components/PaymentQrModal';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { Appointment } from '@/types';

export default function AppointmentManagementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { profile: storeProfile } = useProfile();
    const { profile: liffProfile, liff } = useLiffContext();
    const { showToast } = useToast();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [loading, setLoading] = useState(true);
    const [showQr, setShowQr] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        action: (() => Promise<void>) | null;
    }>({ show: false, title: '', message: '', action: null });

    useEffect(() => {
        const fetchAppointment = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const lineAccessToken = liff?.getAccessToken?.();
                const result = await findAppointmentById(id, { lineAccessToken });
                if (result.success && result.appointment) {
                    setAppointment(result.appointment);
                } else {
                    showToast('ไม่พบข้อมูลนัดหมาย', 'error');
                    router.back();
                }
            } catch (error) {
                console.error("Error fetching appointment:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
                router.back();
            } finally {
                setLoading(false);
            }
        };

        fetchAppointment();
    }, [id, router, showToast, liff]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#faf8f5] flex flex-col">
                <EmployeeHeader showBackButton />
                <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-3">
                    <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin" />
                    <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลนัดหมาย...</p>
                </div>
            </div>
        );
    }

    if (!appointment) return null;

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const isCheckedIn = appointment.status === 'in_progress';

    const executeConfirmAction = async () => {
        if (confirmModal.action) {
            await confirmModal.action();
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleUpdatePayment = async () => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updatePaymentStatusByEmployee(appointment.id, liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, paymentInfo: { ...prev.paymentInfo, paymentStatus: 'paid' } }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('ยืนยันการเข้ารับบริการสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: 'in_progress' }) : null);
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus: any) => {
        if (!liffProfile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, newStatus, liffProfile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            setAppointment(prev => prev ? ({ ...prev, status: newStatus }) : null);
            if (newStatus === 'cancelled') {
                setTimeout(() => router.back(), 1500);
            }
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const confirmPayment = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการรับชำระเงิน",
            message: `ยืนยันว่าได้รับเงินจำนวน ${appointment.paymentInfo?.totalPrice?.toLocaleString() || 0} ${storeProfile?.currencySymbol || 'บาท'} ครบถ้วนแล้วใช่หรือไม่?`,
            action: handleUpdatePayment
        });
    };

    const confirmComplete = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันเสร็จสิ้นบริการ",
            message: "บันทึกว่าการบริการลูกค้าครั้งนี้เสร็จสิ้นสมบูรณ์ใช่หรือไม่?",
            action: async () => handleStatusChange('completed')
        });
    };

    const confirmCancel = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการยกเลิกนัดหมาย",
            message: "คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            action: async () => handleStatusChange('cancelled')
        });
    };

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-10">
            <EmployeeHeader showBackButton />

            <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
                {/* Header Strip */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#5d4037] bg-[#f5ede8] px-2.5 py-0.5 rounded-full border border-[#e8ddd7]">
                                คิว #{appointment.id.slice(0, 6).toUpperCase()}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-[#3e2723] mt-1">
                            จัดการคิวบริการ
                        </h1>
                    </div>
                </div>

                {/* 1. Customer & Service Details Card */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3.5">
                    {/* Customer Info */}
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-[#f5ede8] border border-[#e7e0da] flex items-center justify-center text-[#5d4037] font-bold text-base shrink-0">
                                {(appointment.customerInfo.fullName || appointment.customerInfo.name || 'ล').slice(0, 1)}
                            </div>
                            <div>
                                <p className="font-bold text-base text-[#3e2723]">
                                    {appointment.customerInfo.fullName || appointment.customerInfo.name || 'ไม่ระบุชื่อ'}
                                </p>
                                <p className="text-xs text-[#8d6e63] font-mono mt-0.5">
                                    {appointment.customerInfo.phone || '-'}
                                </p>
                            </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isPaid ? 'ชำระแล้ว' : 'รอชำระ'}
                        </span>
                    </div>

                    {/* Service Breakdown */}
                    <div className="bg-[#faf8f5] p-3.5 rounded-xl border border-[#f0eae4] space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#5d4037]" />
                                <p className="font-bold text-sm text-[#3e2723]">
                                    {appointment.serviceInfo?.name || 'บริการสปา'}
                                </p>
                            </div>
                            {appointment.appointmentInfo?.duration && (
                                <span className="text-[11px] font-semibold text-[#8d6e63] bg-white px-2 py-0.5 rounded-md border border-[#e7e0da]">
                                    {appointment.appointmentInfo.duration} นาที
                                </span>
                            )}
                        </div>

                        {/* Multi-area service details */}
                        {appointment.serviceInfo?.serviceType === 'multi-area' && (
                            <div className="text-xs text-[#5d4037] space-y-1 pt-1.5 border-t border-[#e7e0da]/60">
                                {appointment.serviceInfo?.selectedArea && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[#8d6e63]">บริเวณ:</span>
                                        <span className="font-semibold">{appointment.serviceInfo.selectedArea.name}</span>
                                    </div>
                                )}
                                {appointment.serviceInfo?.selectedPackage && (
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span>แพ็กเกจ: {appointment.serviceInfo.selectedPackage.name}</span>
                                        <span className="text-[#8d6e63]">{appointment.serviceInfo.selectedPackage.duration} นาที</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Option-based service details */}
                        {appointment.serviceInfo?.serviceType === 'option-based' && (
                            <div className="text-xs text-[#5d4037] space-y-1 pt-1.5 border-t border-[#e7e0da]/60">
                                {appointment.serviceInfo?.selectedOptionName && (
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">ตัวเลือก: {appointment.serviceInfo.selectedOptionName}</span>
                                        {appointment.serviceInfo.selectedOptionDuration && (
                                            <span className="text-[11px] text-[#8d6e63]">{appointment.serviceInfo.selectedOptionDuration} นาที/จุด</span>
                                        )}
                                    </div>
                                )}
                                {appointment.serviceInfo?.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                                    <p className="text-[11px] text-[#8d6e63]">
                                        ตำแหน่ง: {appointment.serviceInfo.selectedAreas.join(', ')} ({appointment.serviceInfo.selectedAreas.length} จุด)
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Area-based-options service details */}
                        {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions && appointment.serviceInfo.selectedAreaOptions.length > 0 && (
                            <div className="text-xs text-[#5d4037] space-y-1 pt-1.5 border-t border-[#e7e0da]/60">
                                {appointment.serviceInfo.selectedAreaOptions.map((opt: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px]">
                                        <span>• {opt.areaName} ({opt.optionName})</span>
                                        <span className="text-[#8d6e63] font-mono">
                                            {opt.duration} น. | {Number(opt.price).toLocaleString()} {storeProfile?.currencySymbol}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add-ons */}
                        {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                            <div className="border-t border-[#e7e0da]/70 pt-2 space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d4037]">บริการเสริม:</p>
                                {appointment.appointmentInfo.addOns.map((addon: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs text-[#5d4037]">
                                        <span>+ {addon.name}</span>
                                        <span className="text-[11px] text-[#8d6e63] font-mono">
                                            {addon.duration} น. | {Number(addon.price).toLocaleString()} {storeProfile?.currencySymbol}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center gap-1.5 text-[#5d4037]">
                            <svg className="w-4 h-4 text-[#8d6e63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">
                                {appointment.date ? format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th }) : '-'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 font-bold text-[#3e2723] bg-[#f5f2ed] px-2.5 py-1 rounded-lg border border-[#e7e0da]">
                            <span>{appointment.time} น.</span>
                        </div>
                    </div>
                </div>

                {/* 2. Payment Section */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8d6e63]">ยอดชำระบริการ</span>
                            <div className="text-xl sm:text-2xl font-extrabold text-[#3e2723] font-mono mt-0.5">
                                {appointment.paymentInfo?.totalPrice?.toLocaleString() || 0}{' '}
                                <span className="text-xs font-bold text-[#8d6e63] font-sans">
                                    {storeProfile?.currencySymbol || 'บาท'}
                                </span>
                            </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                            isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isPaid ? 'ชำระเงินเรียบร้อย' : 'รอรับชำระเงิน'}
                        </span>
                    </div>

                    {!isPaid && (
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                                onClick={() => setShowQr(true)}
                                disabled={isUpdating}
                                className="h-11 rounded-xl bg-white hover:bg-[#faf8f5] text-[#5d4037] border border-[#d7ccc8] font-bold text-xs shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
                            >
                                <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                <span>แสดง QR Code</span>
                            </button>
                            <button
                                onClick={confirmPayment}
                                disabled={isUpdating}
                                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
                            >
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>ยืนยันรับเงินแล้ว</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. Check-in Section */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#3e2723]">สถานะการเข้ารับบริการ</span>
                    </div>

                    {isCheckedIn ? (
                        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-center space-y-1">
                            <div className="flex items-center justify-center gap-1.5 text-purple-800 font-bold text-sm">
                                <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
                                <span>กำลังให้บริการลูกค้าอยู่ในขณะนี้</span>
                            </div>
                            <p className="text-[11px] text-purple-600">
                                เมื่อการให้บริการเสร็จสิ้น กรุณากดปุ่ม &quot;เสร็จสิ้นบริการ&quot; ด้านล่าง
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleCheckIn}
                            disabled={isUpdating || !['pending', 'confirmed', 'awaiting_confirmation'].includes(appointment.status)}
                            className="w-full h-12 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-sm shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>ยืนยันการเช็คอิน / เริ่มให้บริการ</span>
                        </button>
                    )}
                </div>

                {/* 4. Complete & Cancel Operations */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <span className="text-xs font-bold text-[#3e2723] block">การดำเนินการขั้นตอนถัดไป</span>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={confirmComplete}
                            disabled={isUpdating || appointment.status === 'completed'}
                            className="h-11 rounded-xl bg-[#4a3429] hover:bg-[#32231b] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                            <span>✓ เสร็จสิ้นบริการ</span>
                        </button>
                        <button
                            onClick={confirmCancel}
                            disabled={isUpdating || appointment.status === 'cancelled'}
                            className="h-11 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                            <span>ยกเลิกนัดหมาย</span>
                        </button>
                    </div>
                </div>
            </main>

            <PaymentQrModal
                show={showQr}
                onClose={() => setShowQr(false)}
                appointment={appointment}
                profile={storeProfile}
            />

            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, show: false })}
                isProcessing={isUpdating}
            />
        </div>
    );
}
