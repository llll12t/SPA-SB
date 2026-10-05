"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, collection, getDocs, query, where, orderBy, doc, getDoc } from '@/app/lib/supabaseDb';
import { format } from 'date-fns';
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
        className={`rounded-2xl p-4 flex items-center space-x-4 transition-all w-full shadow-sm ${!isAvailable ? 'bg-gray-100 opacity-60 cursor-not-allowed' : isSelected ? 'bg-[#F5F2ED] ring-2 ring-[#5D4037] cursor-pointer' : 'bg-white cursor-pointer hover:shadow-md'}`}
    >
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
            {technician.imageUrl ? (
                <img
                    src={technician.imageUrl}
                    alt={technician.firstName}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                    {technician.firstName.charAt(0)}
                </div>
            )}
        </div>
        <div className="flex-1">
            <p className="font-bold text-lg text-gray-800">{technician.firstName}</p>
        </div>
        <div className="flex items-center space-x-3">
            <p className={`text-sm px-3 py-1 rounded-full ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
            </p>
            {isSelected && isAvailable && (
                <div className="w-6 h-6 bg-[#5D4037] rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
            if (!appt.time || !appt.serviceInfo?.duration) return; // Ensure duration exists

            const [hours, minutes] = appt.time.split(':').map(Number);
            const startMinutes = hours * 60 + minutes;
            // Use fallback duration of 60 if missing
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

    // --- แก้ไข: ส่งค่า params ทั้งหมดต่อไปยังหน้า General Info ---
    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันและเวลาที่ต้องการจอง', "warning");
            return;
        }

        if (useTechnician && !selectedTechnician) {
            showToast('กรุณาเลือกช่างเสริมสวยที่ต้องการ', "warning");
            return;
        }

        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);

        // Legacy Params
        if (areaIndex !== null) params.set('areaIndex', areaIndex);
        if (packageIndex !== null) params.set('packageIndex', packageIndex);

        // Option-Based Params (ส่งต่อ)
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
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} backUrl="/appointment" />
            <div className="min-h-screen flex flex-col items-center px-6 py-2 pb-32">
                {/* Calendar */}
                <div className="w-full bg-white p-4 rounded-2xl max-w-md mx-auto flex flex-col items-center shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between w-full mb-4">
                        <button
                            onClick={() => setActiveMonth(prev => {
                                const d = new Date(prev);
                                d.setMonth(d.getMonth() - 1);
                                return d;
                            })}
                            className="px-3 py-2 text-xl text-[#5D4037] hover:bg-gray-100 rounded-full transition-colors"
                        >&#60;</button>
                        <span className="font-bold text-lg text-[#5D4037]">
                            {activeMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            onClick={() => setActiveMonth(prev => {
                                const d = new Date(prev);
                                d.setMonth(d.getMonth() + 1);
                                return d;
                            })}
                            className="px-3 py-2 text-xl text-[#5D4037] hover:bg-gray-100 rounded-full transition-colors"
                        >&#62;</button>
                    </div>
                    <div className="w-full">
                        {/* Header วันในสัปดาห์ */}
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                                <div key={i} className="text-sm text-[#5D4037] text-center font-semibold py-2">{d}</div>
                            ))}
                        </div>

                        {/* วันที่ในเดือน */}
                        <div className="grid grid-cols-7 gap-1.5">
                            {(() => {
                                const year = activeMonth.getFullYear();
                                const month = activeMonth.getMonth();
                                const firstDay = new Date(year, month, 1);
                                // Start from previous month days if needed to align weeks? 
                                // Original code subtracts dayOfWeek from start date.
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

                                    const isDisabled = isPast || !isBusinessOpen || !isCurrentMonth; // Disable if not current month or closed or past

                                    days.push(
                                        <button
                                            key={i}
                                            onClick={() => !isDisabled && setDate(d)}
                                            className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-semibold transition-all relative
                                            ${!isCurrentMonth ? 'text-gray-300' :
                                                    isSelected ? 'bg-[#5D4037] text-white shadow-md transform scale-105' :
                                                        isToday ? 'border-2 border-[#5D4037] text-[#5D4037] bg-white' :
                                                            isHoliday ? 'bg-red-50 text-red-400 border border-red-100' :
                                                                'bg-white text-gray-700 hover:bg-gray-50 border border-transparent'}
                                            ${isDisabled && isCurrentMonth ? 'opacity-30 cursor-not-allowed text-gray-400' : ''}
                                            ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''} 
                                        `}
                                            disabled={isDisabled}
                                        >
                                            {d.getDate()}
                                            {isHoliday && isCurrentMonth && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full"></span>
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

                {/* Available Time */}
                <div className="w-full max-w-md mx-auto mt-6">
                    <h2 className="text-base font-bold mb-3 text-gray-800 pl-1">เลือกช่วงเวลา</h2>

                    {date && !isDateOpen(date) ? (
                        <div className="text-center p-6 bg-red-50 border border-red-100 rounded-xl">
                            {(() => {
                                const dateStr = format(date, 'yyyy-MM-dd');
                                const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);

                                if (holidayInfo) {
                                    return (
                                        <div>
                                            <p className="text-red-600 font-medium">วันหยุดพิเศษ</p>
                                            {holidayInfo.note && (
                                                <p className="text-red-500 text-sm mt-1">{holidayInfo.note}</p>
                                            )}
                                        </div>
                                    );
                                } else {
                                    return <p className="text-gray-600 font-medium">ร้านปิดทำการในวันนี้</p>;
                                }
                            })()}
                            <p className="text-sm text-gray-500 mt-1">กรุณาเลือกวันอื่น</p>
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
                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => !isDisabled && setTime(slot)}
                                            className={`rounded-xl py-2 text-sm font-medium transition-all
                                            ${time === slot
                                                    ? 'bg-[#5D4037] text-white shadow-md transform scale-105'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#5D4037] hover:text-[#5D4037]'}
                                            ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50 border-transparent text-gray-400 decoration-slate-400' : ''}`}
                                            disabled={isDisabled}
                                            style={isDisabled ? { textDecoration: 'line-through' } : {}}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Technician Selection */}
                {/* Only show if enabled in settings and a time is selected */}
                {useTechnician && time && (
                    <div className="w-full max-w-md mx-auto mt-6">
                        <h2 className="text-base font-bold mb-3 text-gray-800 pl-1">เลือกช่าง (Optional)</h2>
                        {loading ? (
                            <div className="text-center py-4 text-gray-500">กำลังโหลดรายชื่อช่าง...</div>
                        ) : technicians.length === 0 ? (
                            <div className="text-center text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">ไม่มีช่างที่พร้อมให้บริการ</div>
                        ) : (
                            <div className="space-y-3">
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

            {/* Confirm Button Fixed Bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t h-20 z-50">
                <div className="max-w-md mx-auto h-full px-4 flex items-center">
                    <button
                        onClick={handleConfirm}
                        disabled={!date || !time || (useTechnician && selectedTechnician == null)}
                        className="w-full bg-[#5D4037] hover:bg-[#3E2723] text-white py-2.5 rounded-2xl font-bold text-base shadow-lg shadow-[#5D4037]/20 transition-all transform active:scale-95 disabled:bg-gray-300 disabled:shadow-none"
                    >
                        ถัดไป
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
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <SelectDateTimeContent />
        </Suspense>
    );
}
