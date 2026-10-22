"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment } from '@/types';

const statusConfig: Record<string, { text: string; bg: string; textCol: string; border: string }> = {
    'completed': { text: 'สำเร็จ', bg: 'bg-emerald-50', textCol: 'text-emerald-700', border: 'border-emerald-200/60' },
    'cancelled': { text: 'ยกเลิก', bg: 'bg-rose-50', textCol: 'text-rose-600', border: 'border-rose-200/60' },
};

interface HistoryCardProps {
    appointment: Appointment;
    onBookAgain?: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    const currency = profile?.currencySymbol || '฿';

    // Safe date conversion
    let appointmentDateTime = new Date();
    try {
        if (appointment.appointmentInfo?.dateTime) {
            appointmentDateTime = typeof appointment.appointmentInfo.dateTime.toDate === 'function'
                ? appointment.appointmentInfo.dateTime.toDate()
                : new Date(appointment.appointmentInfo.dateTime);
        } else {
            appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);
        }
    } catch (e) {
        console.error("Invalid date in history card", e);
    }

    const statusText = appointment.status || 'unknown';
    const status = statusConfig[statusText] || { text: statusText, bg: 'bg-gray-50', textCol: 'text-gray-600', border: 'border-gray-200' };

    const serviceName = appointment.serviceInfo?.name || 'บริการสปา';
    const price = appointment.paymentInfo?.totalPrice?.toLocaleString() || '-';

    return (
        <div className="bg-white rounded-2xl p-3.5 border border-[#e7e0da] shadow-xs flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
            {/* Left: Date & Time */}
            <div className="flex flex-col items-center min-w-[52px] pr-3 border-r border-[#e7e0da]">
                <span className="text-xl font-black text-[#3e2723] leading-none">
                    {format(appointmentDateTime, 'd')}
                </span>
                <span className="text-[11px] text-[#8d6e63] font-semibold mt-0.5">
                    {format(appointmentDateTime, 'MMM', { locale: th })}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">
                    {format(appointmentDateTime, 'HH:mm')} น.
                </span>
            </div>

            {/* Center: Service Details */}
            <div className="flex-grow min-w-0">
                <h3 className="text-xs font-bold text-[#3e2723] truncate">
                    {serviceName}
                </h3>
                <div className="text-[11px] text-[#8d6e63] truncate mt-0.5">
                    {appointment.serviceInfo?.selectedPackage && <span>{appointment.serviceInfo.selectedPackage.name} </span>}
                    {appointment.serviceInfo?.selectedOptionName && <span>{appointment.serviceInfo.selectedOptionName} </span>}
                    {appointment.serviceInfo?.selectedArea && <span>{appointment.serviceInfo.selectedArea.name} </span>}
                    {appointment.appointmentInfo?.addOns && appointment.appointmentInfo.addOns.length > 0 && (
                        <span className="text-[#5d4037] font-medium">+ {appointment.appointmentInfo.addOns.length} บริการเสริม</span>
                    )}
                </div>
            </div>

            {/* Right: Status, Price & Action */}
            <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${status.bg} ${status.textCol} ${status.border} whitespace-nowrap`}>
                    {status.text}
                </span>
                <span className="text-xs font-bold text-[#5d4037]">
                    {price} {currency}
                </span>
                {onBookAgain && (
                    <button
                        onClick={onBookAgain}
                        className="text-[10px] text-[#5d4037] hover:text-[#3e2723] font-semibold underline mt-0.5"
                    >
                        จองอีกครั้ง
                    </button>
                )}
            </div>
        </div>
    );
};

export default HistoryCard;
