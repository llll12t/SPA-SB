"use client";

import { useMemo } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

interface AppointmentCardProps {
    appointment: Appointment;
    onManage: (app: Appointment) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
    awaiting_confirmation: {
        label: 'รอยืนยัน',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dotClass: 'bg-amber-500',
    },
    confirmed: {
        label: 'ยืนยันแล้ว',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        dotClass: 'bg-emerald-500',
    },
    in_progress: {
        label: 'กำลังบริการ',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200/80',
        dotClass: 'bg-purple-500',
    },
    completed: {
        label: 'เสร็จสิ้น',
        badgeClass: 'bg-[#f5f2ed] text-[#5d4037] border-[#d7ccc8]',
        dotClass: 'bg-[#5d4037]',
    },
    cancelled: {
        label: 'ยกเลิก',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
    },
    pending: {
        label: 'รอชำระ/จอง',
        badgeClass: 'bg-amber-50/70 text-amber-700 border-amber-200/70',
        dotClass: 'bg-amber-400',
    },
};

export default function AppointmentCard({ appointment, onManage }: AppointmentCardProps) {
    const { profile } = useProfile();

    const appointmentDateTime = useMemo(() => {
        if (!appointment.time || !appointment.date) {
            return new Date();
        }
        const [hours, minutes] = appointment.time.split(':');
        const parsed = parseISO(appointment.date as string);
        parsed.setHours(parseInt(hours || '0', 10), parseInt(minutes || '0', 10));
        return parsed;
    }, [appointment.date, appointment.time]);

    const checkInStatus = useMemo(() => {
        if (!appointment.time || !appointment.date) return { text: '', color: '', bg: '' };

        const diff = differenceInMinutes(appointmentDateTime, new Date());
        if (appointment.status === 'in_progress') {
            return {
                text: 'กำลังอยู่ระหว่างให้บริการ',
                color: 'text-purple-700',
                bg: 'bg-purple-50 border-purple-200'
            };
        }
        if (appointment.status !== 'pending' && appointment.status !== 'confirmed' && appointment.status !== 'awaiting_confirmation') {
            return { text: '', color: '', bg: '' };
        }
        if (diff > 60) {
            return {
                text: `เช็คอินล่วงหน้า (นัดอีก ${Math.round(diff / 60)} ชม.)`,
                color: 'text-[#8d6e63]',
                bg: 'bg-[#faf8f5] border-[#e7e0da]'
            };
        }
        if (diff < -30) {
            return {
                text: 'เกินเวลานัดหมาย',
                color: 'text-rose-700',
                bg: 'bg-rose-50 border-rose-200'
            };
        }
        return {
            text: 'พร้อมสำหรับเช็คอินเข้ารับบริการ',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50 border-emerald-200'
        };
    }, [appointmentDateTime, appointment.status, appointment.time, appointment.date]);

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const currentStatus = STATUS_CONFIG[appointment.status as string] || {
        label: appointment.status || 'ไม่ระบุ',
        badgeClass: 'bg-stone-50 text-stone-700 border-stone-200',
        dotClass: 'bg-stone-400',
    };

    return (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs hover:shadow-xs transition-all space-y-3.5">
            {/* Header: Customer & Badges */}
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#f5f2ed] border border-[#e7e0da] flex items-center justify-center text-[#5d4037] font-bold text-sm shrink-0">
                        {(appointment.customerInfo.fullName || appointment.customerInfo.name || 'ล').slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-base text-[#3e2723] truncate">
                            {appointment.customerInfo.fullName || appointment.customerInfo.name || 'ไม่ระบุชื่อ'}
                        </p>
                        <p className="text-xs text-[#8d6e63] font-mono mt-0.5">
                            {appointment.customerInfo.phone || '-'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-amber-50 text-amber-800 border-amber-200/80'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {isPaid ? 'ชำระแล้ว' : 'รอชำระเงิน'}
                    </span>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${currentStatus.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dotClass}`} />
                        {currentStatus.label}
                    </span>
                </div>
            </div>

            {/* Service Summary Card */}
            <div className="bg-[#faf8f5] p-3.5 rounded-xl border border-[#f0eae4] space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[#5d4037] shrink-0" />
                        <p className="font-bold text-xs sm:text-sm text-[#3e2723] truncate">
                            {appointment.serviceInfo?.name || 'บริการสปา'}
                        </p>
                    </div>
                    {appointment.appointmentInfo?.duration && (
                        <span className="text-[11px] font-semibold text-[#8d6e63] bg-white px-2 py-0.5 rounded-md border border-[#e7e0da] shrink-0">
                            {appointment.appointmentInfo.duration} นาที
                        </span>
                    )}
                </div>

                {/* Option-Based Details */}
                {appointment.serviceInfo?.serviceType === 'option-based' && (
                    <div className="text-xs text-[#5d4037] space-y-1 pt-1 border-t border-[#e7e0da]/60">
                        {appointment.serviceInfo?.selectedOptionName && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[#8d6e63]">ตัวเลือก:</span>
                                <span className="font-semibold">{appointment.serviceInfo.selectedOptionName}</span>
                            </div>
                        )}
                        {appointment.serviceInfo?.selectedAreas && appointment.serviceInfo.selectedAreas.length > 0 && (
                            <div className="flex items-start gap-1.5 text-[11px] text-[#8d6e63]">
                                <span>ตำแหน่ง:</span>
                                <span>{appointment.serviceInfo.selectedAreas.join(', ')} ({appointment.serviceInfo.selectedAreas.length} จุด)</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Area-Based-Options Details */}
                {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions && appointment.serviceInfo.selectedAreaOptions.length > 0 && (
                    <div className="text-xs text-[#5d4037] space-y-1 pt-1 border-t border-[#e7e0da]/60">
                        {appointment.serviceInfo.selectedAreaOptions.map((opt: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span>• {opt.areaName} ({opt.optionName})</span>
                                <span className="text-[#8d6e63] font-mono">{opt.duration} น. | {Number(opt.price).toLocaleString()} {profile.currencySymbol}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Multi-Area Details */}
                {appointment.serviceInfo?.serviceType === 'multi-area' && (
                    <div className="text-xs text-[#5d4037] space-y-1 pt-1 border-t border-[#e7e0da]/60">
                        {appointment.serviceInfo?.selectedArea && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-[#8d6e63]">บริเวณ:</span>
                                <span className="font-semibold">{appointment.serviceInfo.selectedArea.name}</span>
                            </div>
                        )}
                        {appointment.serviceInfo?.selectedPackage && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-[#8d6e63]">แพ็กเกจ:</span>
                                <span className="font-semibold">{appointment.serviceInfo.selectedPackage.name}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Add-ons */}
                {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                    <div className="border-t border-[#e7e0da]/70 pt-2 mt-1 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d4037]">บริการเสริม:</p>
                        <div className="space-y-1">
                            {appointment.appointmentInfo.addOns.map((addon: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs text-[#5d4037]">
                                    <span>+ {addon.name}</span>
                                    <span className="text-[11px] text-[#8d6e63] font-mono">
                                        {addon.duration} น. | {Number(addon.price).toLocaleString()} {profile.currencySymbol}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Date, Time & Total Price Strip */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-[#5d4037]">
                    <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-[#8d6e63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">
                            {appointment.date ? format(parseISO(appointment.date), 'dd MMM yyyy', { locale: th }) : '-'}
                        </span>
                    </div>
                    {appointment.time && (
                        <div className="flex items-center gap-1 font-bold text-[#3e2723] bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                            <svg className="w-3 h-3 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{appointment.time} น.</span>
                        </div>
                    )}
                </div>

                <div className="text-right">
                    <span className="text-base font-extrabold text-[#3e2723] font-mono">
                        {appointment.paymentInfo?.totalPrice?.toLocaleString() || 0}
                    </span>
                    <span className="text-xs font-bold text-[#8d6e63] ml-1">
                        {profile.currencySymbol || '฿'}
                    </span>
                </div>
            </div>

            {/* Check-in Status Hint Banner */}
            {checkInStatus.text && (
                <div className={`px-3 py-2 rounded-xl text-xs font-semibold text-center border flex items-center justify-center gap-1.5 ${checkInStatus.bg} ${checkInStatus.color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{checkInStatus.text}</span>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={() => onManage(appointment)}
                className="w-full h-11 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
                <span>จัดการนัดหมาย</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
