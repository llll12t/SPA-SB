"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, collection, getDocs, query, where, orderBy, doc, getDoc } from '@/app/lib/supabaseDb';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import { TechnicianInfo, Service, ServiceOption, AddOnService } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

// --- Technician Card Component ---
interface TechnicianCardProps {
    technician: TechnicianInfo & { id: string, imageUrl?: string };
    isSelected: boolean;
    onSelect: (technician: TechnicianInfo & { id: string }) => void;
    isAvailable: boolean;
}

const TechnicianCard: React.FC<TechnicianCardProps> = ({ technician, isSelected, onSelect, isAvailable }) => (
    <div
        onClick={() => isAvailable && onSelect(technician)}
        className={`rounded-2xl p-3.5 flex items-center space-x-3.5 transition-all w-full border ${
            !isAvailable
                ? 'bg-gray-50/70 border-gray-200/60 opacity-60 cursor-not-allowed'
                : isSelected
                    ? 'bg-[#5d4037]/5 border-[#5d4037] ring-2 ring-[#5d4037]/30 shadow-sm cursor-pointer'
                    : 'bg-white border-[#e7e0da] hover:border-[#8d6e63] hover:shadow-sm cursor-pointer'
        }`}
    >
        <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm">
            {technician.imageUrl ? (
                <img
                    src={technician.imageUrl}
                    alt={technician.firstName}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full bg-[#f5f0eb] flex items-center justify-center text-[#5d4037] font-bold text-base">
                    {technician.firstName.charAt(0)}
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-[#3e2723] truncate">{technician.firstName} {technician.lastName || ''}</p>
            {technician.nickname && (
                <p className="text-xs text-[#8d6e63]">({technician.nickname})</p>
            )}
        </div>
        <div className="flex items-center space-x-2.5">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isAvailable
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-600 border border-rose-200/60'
            }`}>
                {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
            </span>
            {isSelected && isAvailable && (
                <div className="w-6 h-6 bg-[#5d4037] rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}
        </div>
    </div>
);

function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useProfile();
    const { showToast } = useToast();

    // Params
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');

    // Legacy Params (Multi-Area)
    const areaIndex = searchParams.get('areaIndex');
    const packageIndex = searchParams.get('packageIndex');

    // New Params (Option-Based)
    const selectedOptionName = searchParams.get('selectedOptionName');
    const selectedOptionPrice = searchParams.get('selectedOptionPrice');
    const selectedOptionDuration = searchParams.get('selectedOptionDuration');
    const selectedAreasParam = searchParams.get('selectedAreas');
    const selectedAreaOptionsParam = searchParams.get('selectedAreaOptions');

    const [service, setService] = useState<Service | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<AddOnService[]>([]);
    const [date, setDate] = useState<Date | null>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0); // Default to today 7:00
    });
    const [activeMonth, setActiveMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1, 7, 0, 0);
    });

    const [time, setTime] = useState('');
    const [technicians, setTechnicians] = useState<(TechnicianInfo & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTechnician, setSelectedTechnician] = useState<(TechnicianInfo & { id: string }) | null>(null);
    const [timeQueues, setTimeQueues] = useState<any[]>([]);
    const [totalTechnicians, setTotalTechnicians] = useState(1);
    const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
    const [useTechnician, setUseTechnician] = useState(false);
    const [weeklySchedule, setWeeklySchedule] = useState<any>({});
    const [holidayDates, setHolidayDates] = useState<any[]>([]);
    const [unavailableTechnicianIds, setUnavailableTechnicianIds] = useState<Set<string>>(new Set());
    const [bufferMinutes, setBufferMinutes] = useState(0);
    const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
    const [appointmentsForDay, setAppointmentsForDay] = useState<any[]>([]);

    // Fetch service data
    useEffect(() => {
        if (!serviceId) return;

        const fetchService = async () => {
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setService({ id: docSnap.id, ...docSnap.data() } as Service);
                }
            } catch (error) {
                console.error("Error fetching service:", error);
            }
        };
        fetchService();
    }, [serviceId]);

    // Process add-ons
    useEffect(() => {
        if (!service || !addOns) return;

        const addOnNames = addOns.split(',');
        const selected = (service.addOnServices || []).filter(addOn =>
            addOnNames.includes(addOn.name)
        );
        setSelectedAddOns(selected);
    }, [service, addOns]);

    // Fetch technicians
    useEffect(() => {
        const fetchTechnicians = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'technicians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const querySnapshot = await getDocs(q);
                setTechnicians(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TechnicianInfo & { id: string })));
            } catch (e) {
                console.error("Error fetching technicians:", e);
            }
            setLoading(false);
        };
        fetchTechnicians();
    }, []);

    // Fetch booking settings
    useEffect(() => {
        const fetchBookingSettings = async () => {
            try {
                const bookingSettingsDoc = await getDoc(doc(db, 'settings', 'booking'));
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setTimeQueues(Array.isArray(settings.timeQueues) ? settings.timeQueues : []);
                    setTotalTechnicians(Number(settings.totalTechnicians ?? settings.totalBeauticians) || 1);
                    setUseTechnician(!!(settings.useTechnician ?? settings.useBeautician));
                    setWeeklySchedule(settings.weeklySchedule || {});
                    setHolidayDates(Array.isArray(settings.holidayDates) ? settings.holidayDates : []);
                    setBufferMinutes(Number(settings.bufferMinutes) || 0);
                }
            } catch (error) {
                console.error("Error fetching booking settings:", error);
            }
        };
        fetchBookingSettings();
    }, []);

    // Fetch appointments & Calculate availability
    useEffect(() => {
        if (!date) return;

        const fetchAppointments = async () => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );

            try {
                const querySnapshot = await getDocs(q);
                const appointments = querySnapshot.docs.map(doc => doc.data());
                setAppointmentsForDay(appointments);
            } catch (error) {
                console.error("Error fetching appointments:", error);
                setAppointmentsForDay([]);
            }
        };

        fetchAppointments();
    }, [date]);

    useEffect(() => {
        if (!appointmentsForDay) return;

        const counts: Record<string, number> = {};
        appointmentsForDay.forEach(appt => {
            if (appt.time) {
                counts[appt.time] = (counts[appt.time] || 0) + 1;
            }
        });
        setSlotCounts(counts);

        const slotOverlapCounts: Record<string, number> = {};
        const unavailable = new Set<string>();
        const bufferTime = bufferMinutes || 0;

        appointmentsForDay.forEach(appt => {
            if (!appt.time || !appt.serviceInfo?.duration) return;

            const [hours, minutes] = appt.time.split(':').map(Number);
            const startMinutes = hours * 60 + minutes;
            const duration = appt.serviceInfo?.duration || appt.appointmentInfo?.duration || 60;
            const endMinutes = startMinutes + duration + bufferTime;

            timeQueues.forEach(queue => {
                if (!queue.time) return;
                const [qHours, qMinutes] = queue.time.split(':').map(Number);
                const qTimeMinutes = qHours * 60 + qMinutes;

                if (qTimeMinutes > startMinutes && qTimeMinutes < endMinutes) {
                    slotOverlapCounts[queue.time] = (slotOverlapCounts[queue.time] || 0) + 1;
                }
            });
        });

        timeQueues.forEach(queue => {
            if (!queue.time) return;
            const maxSlots = useTechnician ? technicians.length : (queue.count || totalTechnicians);
            const overlapCount = slotOverlapCounts[queue.time] || 0;
            const bookedCount = counts[queue.time] || 0;

            if (bookedCount + overlapCount >= maxSlots) {
                unavailable.add(queue.time);
            }
        });

        setUnavailableSlots(unavailable);
    }, [appointmentsForDay, timeQueues, bufferMinutes, useTechnician, technicians, totalTechnicians]);

    // Calculate technician availability
    useEffect(() => {
        if (time && appointmentsForDay.length > 0) {
            const unavailableIds = new Set<string>(
                appointmentsForDay
                    .filter(appt => appt.time === time && appt.technicianId)
                    .map(appt => appt.technicianId)
            );
            setUnavailableTechnicianIds(unavailableIds);

            if (selectedTechnician && unavailableIds.has(selectedTechnician.id)) {
                setSelectedTechnician(null);
                showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning');
            }
        } else {
            setUnavailableTechnicianIds(new Set());
        }
    }, [time, appointmentsForDay, selectedTechnician, showToast]);

    useEffect(() => {
        setTime('');
        setSelectedTechnician(null);
    }, [date]);

    // Forward params to General Info
    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันและเวลาที่ต้องการจอง', "warning");
            return;
        }

        if (useTechnician && !selectedTechnician) {
            showToast('กรุณาเลือกผู้ให้บริการที่ต้องการ', "warning");
            return;
        }

        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);

        // Legacy Params
        if (areaIndex !== null) params.set('areaIndex', areaIndex);
        if (packageIndex !== null) params.set('packageIndex', packageIndex);

        // Option-Based Params
        if (selectedOptionName) params.set('selectedOptionName', selectedOptionName);
        if (selectedOptionPrice) params.set('selectedOptionPrice', selectedOptionPrice);
        if (selectedOptionDuration) params.set('selectedOptionDuration', selectedOptionDuration);
        if (selectedAreasParam) params.set('selectedAreas', selectedAreasParam);
        if (selectedAreaOptionsParam) params.set('selectedAreaOptions', selectedAreaOptionsParam);

        params.set('date', format(date, 'yyyy-MM-dd'));
        params.set('time', time);

        if (useTechnician && selectedTechnician) {
            params.set('technicianId', selectedTechnician.id);
        } else {
            params.set('technicianId', 'auto-assign');
        }

        router.push(`/appointment/general-info?${params.toString()}`);
    };

    const isDateOpen = (checkDate: Date) => {
        const dayOfWeek = checkDate.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        const isRegularlyOpen = daySchedule ? daySchedule.isOpen : true;
        if (!isRegularlyOpen) return false;

        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const isHoliday = holidayDates.some(holiday => holiday.date === dateStr);
        if (isHoliday) return false;

        return true;
    };

    const isTimeInBusinessHours = (timeSlot: string) => {
        if (!date) return true;
        const dayOfWeek = date.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.isOpen) return false;

        const slotTime = timeSlot.replace(':', '');
        const openTime = daySchedule.openTime.replace(':', '');
        const closeTime = daySchedule.closeTime.replace(':', '');

        return slotTime >= openTime && slotTime <= closeTime;
    };

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <CustomerHeader showBackButton={true} showActionButtons={false} backUrl="/appointment" />
            
            <div className="w-full max-w-md mx-auto px-4 py-4 pb-36 space-y-6">
                
                {/* Step indicator */}
                <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold text-[#5d4037] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#5d4037] text-white flex items-center justify-center text-[11px] font-bold">2</span>
                        เลือกวันและเวลาที่สะดวก
                    </span>
                    <span className="text-[#8d6e63]">ขั้นตอน 2 จาก 3</span>
                </div>

                {/* Calendar Card */}
                <div className="w-full bg-white p-5 rounded-3xl shadow-sm border border-[#e7e0da]">
                    {/* Month Navigator */}
                    <div className="flex items-center justify-between w-full mb-4">
                        <button
                            onClick={() => setActiveMonth(prev => {
                                const d = new Date(prev);
                                d.setMonth(d.getMonth() - 1);
                                return d;
                            })}
                            className="w-9 h-9 flex items-center justify-center text-[#5d4037] hover:bg-[#5d4037]/10 rounded-full transition-colors active:scale-95"
                            aria-label="Previous month"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span className="font-bold text-base text-[#3e2723]">
                            {activeMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            onClick={() => setActiveMonth(prev => {
                                const d = new Date(prev);
                                d.setMonth(d.getMonth() + 1);
                                return d;
                            })}
                            className="w-9 h-9 flex items-center justify-center text-[#5d4037] hover:bg-[#5d4037]/10 rounded-full transition-colors active:scale-95"
                            aria-label="Next month"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <div className="w-full">
                        {/* Day names */}
                        <div className="grid grid-cols-7 gap-1 mb-2.5">
                            {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                                <div key={i} className="text-xs text-[#8d6e63] text-center font-semibold py-1">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Calendar days grid */}
                        <div className="grid grid-cols-7 gap-1.5">
                            {(() => {
                                const year = activeMonth.getFullYear();
                                const month = activeMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const startDate = new Date(firstDay);
                                startDate.setDate(startDate.getDate() - firstDay.getDay());

                                const days = [];
                                const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 7, 0, 0);

                                for (let i = 0; i < 42; i++) {
                                    const d = new Date(currentDate);
                                    const isCurrentMonth = d.getMonth() === month;
                                    const isToday = (new Date()).toDateString() === d.toDateString();
                                    const isSelected = date && d.toDateString() === date.toDateString();
                                    const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
                                    const isBusinessOpen = isDateOpen(d);

                                    const dateStr = format(d, 'yyyy-MM-dd');
                                    const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);
                                    const isHoliday = !!holidayInfo;

                                    const isDisabled = isPast || !isBusinessOpen || !isCurrentMonth;

                                    days.push(
                                        <button
                                            key={i}
                                            onClick={() => !isDisabled && setDate(d)}
                                            className={`h-10 w-full flex items-center justify-center rounded-2xl text-xs font-semibold transition-all relative ${
                                                !isCurrentMonth ? 'opacity-0 pointer-events-none' : ''
                                            } ${
                                                isSelected
                                                    ? 'bg-[#5d4037] text-white shadow-md shadow-[#5d4037]/25 scale-105 z-10'
                                                    : isToday
                                                        ? 'border-2 border-[#5d4037] text-[#5d4037] bg-[#5d4037]/5 font-bold'
                                                        : isHoliday
                                                            ? 'bg-rose-50 text-rose-500 border border-rose-100'
                                                            : 'bg-transparent text-[#3e2723] hover:bg-[#faf8f5]'
                                            } ${
                                                isDisabled && isCurrentMonth ? 'opacity-30 cursor-not-allowed text-gray-400 hover:bg-transparent' : ''
                                            }`}
                                            disabled={isDisabled}
                                        >
                                            {d.getDate()}
                                            {isHoliday && isCurrentMonth && (
                                                <span className="absolute bottom-1 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                                            )}
                                        </button>
                                    );
                                    currentDate.setDate(currentDate.getDate() + 1);
                                }

                                return days;
                            })()}
                        </div>
                    </div>
                </div>

                {/* Available Time Slots */}
                <div className="w-full">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="text-sm font-bold text-[#3e2723] flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            เลือกรอบเวลาบริการ
                        </h2>
                        {date && (
                            <span className="text-xs text-[#8d6e63]">
                                {format(date, 'd MMM yyyy', { locale: th })}
                            </span>
                        )}
                    </div>

                    {date && !isDateOpen(date) ? (
                        <div className="text-center p-6 bg-rose-50/70 border border-rose-100 rounded-2xl">
                            {(() => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);

                                if (holidayInfo) {
                                    return (
                                        <div>
                                            <p className="text-rose-600 font-bold text-sm">วันหยุดพิเศษ</p>
                                            {holidayInfo.note && (
                                                <p className="text-rose-500 text-xs mt-1">{holidayInfo.note}</p>
                                            )}
                                        </div>
                                    );
                                } else {
                                    return <p className="text-[#3e2723] font-medium text-sm">ร้านปิดทำการในวันนี้</p>;
                                }
                            })()}
                            <p className="text-xs text-[#8d6e63] mt-1.5">กรุณาเลือกวันอื่นสำหรับการนัดหมาย</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {timeQueues
                                .filter(q => q.time && isTimeInBusinessHours(q.time))
                                .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                                .map(queue => {
                                    const slot = queue.time;
                                    const max = useTechnician ? technicians.length : (queue.count || totalTechnicians);
                                    const booked = slotCounts[slot] || 0;
                                    const isFull = booked >= max;
                                    const isOverlapping = unavailableSlots.has(slot);
                                    const isDisabled = isFull || isOverlapping;
                                    const isSelected = time === slot;

                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => !isDisabled && setTime(slot)}
                                            disabled={isDisabled}
                                            className={`rounded-2xl py-2.5 text-xs font-semibold transition-all border ${
                                                isSelected
                                                    ? 'bg-[#5d4037] text-white border-[#5d4037] shadow-md shadow-[#5d4037]/20 scale-[1.02]'
                                                    : isDisabled
                                                        ? 'bg-gray-100/70 text-gray-400 border-gray-200/50 cursor-not-allowed line-through'
                                                        : 'bg-white text-[#4a3429] border-[#e7e0da] hover:border-[#8d6e63] hover:bg-[#faf8f5]'
                                            }`}
                                        >
                                            {slot} น.
                                        </button>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Technician Selection */}
                {useTechnician && time && (
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-sm font-bold text-[#3e2723] flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                เลือกผู้ให้บริการ
                            </h2>
                            <span className="text-xs text-[#8d6e63]">ระบุช่างที่ต้องการ</span>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-6 text-xs text-[#8d6e63]">
                                <SpaFlowerIcon className="w-8 h-8 animate-spin mb-2" color="#5d4037" />
                                <span>กำลังโหลดรายชื่อผู้ให้บริการ...</span>
                            </div>
                        ) : technicians.length === 0 ? (
                            <div className="text-center text-xs text-[#8d6e63] bg-white p-5 rounded-2xl border border-[#e7e0da]">
                                ไม่มีผู้ให้บริการที่พร้อมในขณะนี้
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {technicians.map(technician => (
                                    <TechnicianCard
                                        key={technician.id}
                                        technician={technician}
                                        isSelected={selectedTechnician?.id === technician.id}
                                        onSelect={setSelectedTechnician}
                                        isAvailable={!unavailableTechnicianIds.has(technician.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Sticky Floating Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#e7e0da] pb-[env(safe-area-inset-bottom,16px)] pt-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                <div className="max-w-md mx-auto px-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[#8d6e63] font-medium">เวลานัดหมายที่เลือก</div>
                        {date && time ? (
                            <div className="text-sm font-bold text-[#3e2723] truncate flex items-center gap-1.5 mt-0.5">
                                <span>{format(date, 'd MMM yyyy', { locale: th })}</span>
                                <span className="text-[#8d6e63]">•</span>
                                <span className="text-[#5d4037]">{time} น.</span>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 mt-0.5">โปรดเลือกวันและเวลา</div>
                        )}
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={!date || !time || (useTechnician && selectedTechnician == null)}
                        className="bg-[#5d4037] hover:bg-[#4a3429] active:scale-[0.98] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md shadow-[#5d4037]/20 transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                    >
                        <span>ถัดไป</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SelectDateTimePage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                    <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <SelectDateTimeContent />
        </Suspense>
    );
}
