"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

interface AppointmentCardProps {
    job: Appointment;
    onQrCodeClick: (id: string) => void;
    onCancelClick: (appointment: Appointment) => void;
    onConfirmClick: (appointment: Appointment) => void;
    isConfirming: boolean;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ job, onQrCodeClick, onCancelClick, onConfirmClick, isConfirming }) => {
    const { profile } = useProfile();
    const currency = profile?.currencySymbol || '฿';

    const statusConfig: Record<string, { text: string; bg: string; textCol: string; border: string }> = {
        'awaiting_confirmation': { text: 'รอยืนยันคิว', bg: 'bg-amber-100/95', textCol: 'text-amber-900', border: 'border-amber-300' },
        'confirmed': { text: 'ยืนยันเรียบร้อย', bg: 'bg-emerald-100/95', textCol: 'text-emerald-900', border: 'border-emerald-300' },
        'in_progress': { text: 'กำลังรับบริการ', bg: 'bg-indigo-100/95', textCol: 'text-indigo-900', border: 'border-indigo-300' },
        'pending': { text: 'รอดำเนินการ', bg: 'bg-blue-100/95', textCol: 'text-blue-900', border: 'border-blue-300' },
        'completed': { text: 'เสร็จสิ้น', bg: 'bg-gray-100', textCol: 'text-gray-700', border: 'border-gray-200' },
        'cancelled': { text: 'ยกเลิกแล้ว', bg: 'bg-rose-100/95', textCol: 'text-rose-900', border: 'border-rose-300' },
        'blocked': { text: 'ไม่ว่าง', bg: 'bg-gray-100', textCol: 'text-gray-600', border: 'border-gray-200' },
    };

    const status = statusConfig[job.status] || { text: job.status, bg: 'bg-gray-100', textCol: 'text-gray-800', border: 'border-gray-200' };

    // Convert potentially any timestamp to date
    const rawDateTime = job.appointmentInfo?.dateTime ?? job.dateTime ?? job.date;
    const appointmentDateTime = rawDateTime && typeof rawDateTime.toDate === 'function'
        ? rawDateTime.toDate()
        : new Date(rawDateTime ?? Date.now());

    const addOns = job.appointmentInfo?.addOns || [];
    const technicianName = job.appointmentInfo?.technicianInfo?.firstName || job.appointmentInfo?.technicianName;

    return (
        <div className="bg-white rounded-3xl border border-[#e7e0da] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Header with flower decoration */}
            <div className="bg-gradient-to-r from-[#5d4037] via-[#4a3429] to-[#3e2723] p-4 text-white relative overflow-hidden">
                <div className="absolute top-[-20px] right-[-20px] opacity-15 pointer-events-none">
                    <SpaFlowerIcon className="w-24 h-24" color="#ffffff" />
                </div>

                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <div className="text-[11px] text-[#d7ccc8] font-medium tracking-wide">เวลานัดหมาย</div>
                        <div className="font-bold text-base text-white mt-0.5">
                            {format(appointmentDateTime, 'd MMMM yyyy', { locale: th })}
                        </div>
                        <div className="text-xs text-[#faf8f5]/90 flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>{format(appointmentDateTime, 'HH:mm')} น.</span>
                            {job.appointmentInfo?.duration && (
                                <span className="text-[#d7ccc8]">({job.appointmentInfo.duration} นาที)</span>
                            )}
                        </div>
                    </div>

                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold shadow-xs border ${status.bg} ${status.textCol} ${status.border}`}>
                        {status.text}
                    </span>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-[#3e2723] truncate">
                            {job.serviceInfo?.name}
                        </h3>

                        {/* Multi-area service details */}
                        {job.serviceInfo?.serviceType === 'multi-area' && (
                            <div className="mt-1 flex flex-wrap gap-1">
                                {job.serviceInfo?.selectedArea && (
                                    <span className="text-[11px] bg-[#faf8f5] text-[#5d4037] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                                        {job.serviceInfo.selectedArea.name}
                                    </span>
                                )}
                                {job.serviceInfo?.selectedPackage && (
                                    <span className="text-[11px] bg-[#faf8f5] text-[#5d4037] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                                        {job.serviceInfo.selectedPackage.name}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Option-based service details */}
                        {job.serviceInfo?.serviceType === 'option-based' && (
                            <div className="mt-1 text-xs text-[#5d4037]">
                                <span className="font-semibold">{job.serviceInfo?.selectedOptionName}</span>
                                {job.serviceInfo?.selectedAreas && job.serviceInfo.selectedAreas.length > 0 && (
                                    <span className="text-[#8d6e63] ml-1">({job.serviceInfo.selectedAreas.join(', ')})</span>
                                )}
                            </div>
                        )}

                        {/* Area-based-options service details */}
                        {job.serviceInfo?.serviceType === 'area-based-options' && job.serviceInfo?.selectedAreaOptions && job.serviceInfo.selectedAreaOptions.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                                {job.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                                    <div key={idx} className="text-[11px] text-[#5d4037]">
                                        • {opt.areaName} ({opt.optionName})
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Technician info */}
                        {technicianName && technicianName !== 'ระบบจัดให้อัตโนมัติ' && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8d6e63]">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>ผู้ดูแล: <strong className="text-[#5d4037]">{technicianName}</strong></span>
                            </div>
                        )}
                    </div>

                    <span className="text-xs text-[#8d6e63] font-semibold whitespace-nowrap">
                        {job.paymentInfo?.basePrice?.toLocaleString()} {currency}
                    </span>
                </div>

                {/* Add-on Services */}
                {addOns.length > 0 && (
                    <div className="space-y-1 text-xs text-[#5d4037] pl-3 border-l-2 border-[#5d4037]/20 py-0.5">
                        {addOns.map((addon, index) => (
                            <div key={index} className="flex justify-between">
                                <span>+ {addon.name}</span>
                                <span className="font-medium">{addon.price?.toLocaleString()} {currency}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Total Price Row */}
                <div className="pt-2 border-t border-[#e7e0da]/60 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-[#8d6e63]">ราคารวมสุทธิ</span>
                    <div className="text-right">
                        <span className="font-black text-base text-[#5d4037]">
                            {job.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} {currency}
                        </span>
                        {job.paymentInfo?.discount && job.paymentInfo.discount > 0 ? (
                            <div className="text-[10px] text-emerald-700 font-semibold">
                                ส่วนลด {job.paymentInfo.discount.toLocaleString()} {currency}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-[#e7e0da]/60 flex items-center justify-between gap-2">
                    <button
                        onClick={() => job.id && onQrCodeClick(job.id)}
                        className="py-2 px-3.5 rounded-xl text-xs font-bold text-[#5d4037] bg-[#faf8f5] hover:bg-[#f5f0eb] border border-[#e7e0da] transition-all flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        <span>QR Code</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {job.status === 'awaiting_confirmation' && (
                            <button
                                onClick={() => onConfirmClick(job)}
                                disabled={isConfirming}
                                className="py-2 px-4 rounded-xl text-xs font-bold text-white bg-[#5d4037] hover:bg-[#4a3429] shadow-sm shadow-[#5d4037]/20 transition-all active:scale-95"
                            >
                                {isConfirming ? '...' : 'ยืนยันคิว'}
                            </button>
                        )}

                        {job.status === 'confirmed' && (
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                                มาก่อน 10 นาที
                            </span>
                        )}

                        {job.status !== 'in_progress' && (
                            <button
                                onClick={() => onCancelClick(job)}
                                className="text-xs text-rose-500 hover:text-rose-700 font-medium py-1.5 px-2 hover:underline"
                            >
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;
