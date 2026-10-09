"use client";

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { useToast } from '@/app/components/Toast';
import { useLiffContext } from '@/context/LiffProvider';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { updateAppointmentStatus, updatePaymentStatusByEmployee } from '@/app/actions/employeeActions';
import PaymentQrModal from './PaymentQrModal';
import { Appointment } from '@/types';

interface ManagementModalProps {
    appointment: Appointment;
    onClose: () => void;
    onAction: (app: Appointment) => void;
    profile: any;
}

export default function ManagementModal({ appointment, onClose, onAction, profile }: ManagementModalProps) {
    const [showQr, setShowQr] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        action: (() => Promise<void>) | null;
    }>({ show: false, title: '', message: '', action: null });

    const { showToast } = useToast();
    const { liff } = useLiffContext();

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
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updatePaymentStatusByEmployee(appointment.id, profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            onAction({ ...appointment, paymentInfo: { ...appointment.paymentInfo, paymentStatus: 'paid' } });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('ยืนยันการเข้ารับบริการสำเร็จ!', 'success');
            onAction({ ...appointment, status: 'in_progress' });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus: any) => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await updateAppointmentStatus(appointment.id, newStatus, profile.userId, { lineAccessToken });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            onAction({ ...appointment, status: newStatus });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const confirmPayment = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการชำระเงิน",
            message: `ยืนยันว่าลูกค้าได้ชำระเงินครบถ้วน ${appointment.paymentInfo?.totalPrice?.toLocaleString() || 0} ${profile?.currencySymbol || 'บาท'} ใช่หรือไม่?`,
            action: handleUpdatePayment
        });
    };

    const confirmComplete = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันเสร็จสิ้นบริการ",
            message: "ต้องการบันทึกว่าการบริการนี้เสร็จสิ้นแล้วใช่หรือไม่?",
            action: async () => handleStatusChange('completed')
        });
    };

    const confirmCancel = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการยกเลิก",
            message: "คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            action: async () => handleStatusChange('cancelled')
        });
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity"
                onClick={onClose}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-[#faf8f5] rounded-t-3xl border-t border-[#e7e0da] shadow-2xl p-4 sm:p-5 z-50 max-h-[88vh] overflow-y-auto space-y-3.5 max-w-xl mx-auto animate-in slide-in-from-bottom duration-200">
                {/* Header */}
                <div className="flex justify-between items-center pb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[#5d4037] bg-[#f5ede8] px-2.5 py-0.5 rounded-full border border-[#e8ddd7]">
                            คิว #{appointment.id.slice(0, 6).toUpperCase()}
                        </span>
                        <h2 className="text-base font-bold text-[#3e2723]">จัดการนัดหมาย</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white hover:bg-[#f5ede8] border border-[#e7e0da] flex items-center justify-center text-[#8d6e63] hover:text-[#5d4037] text-lg font-bold transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 1. Appointment Info */}
                <div className="bg-white p-4 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-base text-[#3e2723]">
                                {appointment.customerInfo.fullName || appointment.customerInfo.name || 'ไม่ระบุชื่อ'}
                            </p>
                            <p className="text-xs text-[#8d6e63] font-mono mt-0.5">{appointment.customerInfo.phone || '-'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                            {isPaid ? 'ชำระแล้ว' : 'รอชำระ'}
                        </span>
                    </div>

                    <div className="bg-[#faf8f5] p-3 rounded-xl border border-[#f0eae4] space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-[#3e2723]">{appointment.serviceInfo?.name}</span>
                            {appointment.appointmentInfo?.duration && (
                                <span className="text-[11px] text-[#8d6e63] font-medium">{appointment.appointmentInfo.duration} นาที</span>
                            )}
                        </div>

                        {appointment.serviceInfo?.serviceType === 'multi-area' && (
                            <div className="space-y-1 text-[#5d4037] pt-1 border-t border-[#e7e0da]/60">
                                {appointment.serviceInfo?.selectedArea && (
                                    <p>บริเวณ: {appointment.serviceInfo.selectedArea.name}</p>
                                )}
                                {appointment.serviceInfo?.selectedPackage && (
                                    <p>แพ็กเกจ: {appointment.serviceInfo.selectedPackage.name}</p>
                                )}
                            </div>
                        )}

                        {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                            <div className="pt-1.5 border-t border-[#e7e0da]/60 space-y-0.5">
                                <p className="text-[10px] font-bold text-[#5d4037]">บริการเสริม:</p>
                                {appointment.appointmentInfo.addOns.map((addon: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-[11px] text-[#8d6e63]">
                                        <span>+ {addon.name}</span>
                                        <span>{Number(addon.price).toLocaleString()} {profile?.currencySymbol}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center text-xs text-[#5d4037] pt-1">
                        <span>
                            {appointment.date ? format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th }) : '-'}
                        </span>
                        <span className="font-bold text-[#3e2723] bg-[#f5ede8] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                            {appointment.time} น.
                        </span>
                    </div>
                </div>

                {/* 2. Payment Section */}
                <div className="bg-white p-4 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8d6e63]">ยอดรวม</span>
                            <div className="text-xl font-extrabold text-[#3e2723] font-mono mt-0.5">
                                {appointment.paymentInfo?.totalPrice?.toLocaleString() || 0}{' '}
                                <span className="text-xs font-bold text-[#8d6e63] font-sans">{profile?.currencySymbol || 'บาท'}</span>
                            </div>
                        </div>
                    </div>

                    {!isPaid && (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setShowQr(true)}
                                disabled={isUpdating}
                                className="h-10.5 rounded-xl bg-white hover:bg-[#faf8f5] text-[#5d4037] border border-[#d7ccc8] font-bold text-xs transition-all active:scale-95"
                            >
                                แสดง QR Code
                            </button>
                            <button
                                onClick={confirmPayment}
                                disabled={isUpdating}
                                className="h-10.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
                            >
                                ยืนยันรับชำระเงิน
                            </button>
                        </div>
                    )}
                </div>

                {/* 3. Check-in Section */}
                <div className="bg-white p-4 rounded-2xl border border-[#e7e0da] shadow-2xs">
                    {isCheckedIn ? (
                        <div className="text-center bg-purple-50 p-3.5 rounded-xl border border-purple-200">
                            <p className="text-purple-800 font-bold text-xs">กำลังให้บริการลูกค้าในขณะนี้</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleCheckIn}
                            disabled={isUpdating || !['pending', 'confirmed', 'awaiting_confirmation'].includes(appointment.status)}
                            className="w-full h-11 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                            ยืนยันการเข้ารับบริการ
                        </button>
                    )}
                </div>

                {/* 4. Complete & Cancel Operations */}
                <div className="bg-white p-4 rounded-2xl border border-[#e7e0da] shadow-2xs">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={confirmComplete}
                            disabled={isUpdating || appointment.status === 'completed'}
                            className="h-10.5 rounded-xl bg-[#4a3429] hover:bg-[#32231b] text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                            เสร็จสิ้นบริการ
                        </button>
                        <button
                            onClick={confirmCancel}
                            disabled={isUpdating || appointment.status === 'cancelled'}
                            className="h-10.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
                        >
                            ยกเลิกนัด
                        </button>
                    </div>
                </div>
            </div>

            <PaymentQrModal
                show={showQr}
                onClose={() => setShowQr(false)}
                appointment={appointment}
                profile={profile}
            />

            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, show: false })}
                isProcessing={isUpdating}
            />
        </>
    );
}
