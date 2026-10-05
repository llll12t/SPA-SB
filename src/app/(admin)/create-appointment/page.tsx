"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, collection, getDocs, query, orderBy, where, doc, getDoc } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { format } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { useProfile } from '@/context/ProfileProvider';
import TechnicianCard from '@/app/components/admin/TechnicianCard';
import TimeSlotGrid from '@/app/components/admin/TimeSlotGrid';
import FullCalendar from '@/app/components/FullCalendar';
import { Technician, Service } from '@/types';

// Local Types
interface BookingSettings {
    timeQueues: { time: string; count?: number }[];
    weeklySchedule: Record<number, { isOpen: boolean; openTime?: string; closeTime?: string }>;
    holidayDates: { date: string; reason?: string }[];
    totalTechnicians: number;
    useTechnician: boolean;
    bufferMinutes: number;
}

const defaultWeeklySchedule = {
    0: { isOpen: false },  // Sun
    1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    6: { isOpen: false }   // Sat
};

export default function CreateAppointmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    // Form State
    const [customerInfo, setCustomerInfo] = useState({ fullName: '', phone: '', note: '', lineUserId: '' });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState<string[]>([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [triedSubmit, setTriedSubmit] = useState(false);

    // Service Type States
    const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(null);
    const [selectedPackageIndex, setSelectedPackageIndex] = useState<number | null>(null);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
    const [selectedAreaOptions, setSelectedAreaOptions] = useState<Record<string, number>>({});

    // Data State
    const [services, setServices] = useState<Service[]>([]);
    const [technicians, setTechnicians] = useState<Technician[]>([]);

    // Booking State
    const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
        timeQueues: [],
        weeklySchedule: defaultWeeklySchedule,
        holidayDates: [],
        totalTechnicians: 1,
        useTechnician: true,
        bufferMinutes: 0
    });
    const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
    const [unavailableSlots, setUnavailableSlots] = useState<Set<string>>(new Set());
    const [unavailableTechnicianIds, setUnavailableTechnicianIds] = useState<Set<string>>(new Set());

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState<any>(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
    const [timeQueueFull, setTimeQueueFull] = useState(false);



    useEffect(() => {
        const d = searchParams.get('date');
        const t = searchParams.get('time');
        const techId = searchParams.get('technicianId');
        if (d) setAppointmentDate(d);
        if (t) setAppointmentTime(t);
        if (techId) setSelectedTechnicianId(techId);
    }, [searchParams]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [bookingSettingsDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', 'booking'))
                ]);

                // Services
                const servicesSnapshot = await getDocs(query(collection(db, 'services'), orderBy('serviceName')));
                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));

                // Settings
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setBookingSettings({
                        timeQueues: Array.isArray(settings.timeQueues) ? settings.timeQueues : [],
                        weeklySchedule: settings.weeklySchedule || defaultWeeklySchedule,
                        holidayDates: Array.isArray(settings.holidayDates) ? settings.holidayDates : [],
                        totalTechnicians: Number(settings.totalTechnicians ?? settings.totalBeauticians ?? settings.totaltechnicians ?? settings.totalbeauticians) || 1,
                        useTechnician: !!(settings.useTechnician ?? settings.useBeautician ?? settings.usetechnician ?? settings.usebeautician),
                        bufferMinutes: Number(settings.bufferMinutes) || 0
                    });
                }

                // Technicians
                const techniciansSnapshot = await getDocs(query(collection(db, 'technicians'), where('status', '==', 'available'), orderBy('firstName')));
                setTechnicians(techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));

            } catch (error) {
                console.error("Error fetching data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [showToast]);

    useEffect(() => {
        if (!appointmentDate) return;

        const fetchAppointmentsForDate = async () => {
            const dateStr = format(new Date(appointmentDate), 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );
            const querySnapshot = await getDocs(q);
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());

            // Slot Counts
            const counts: Record<string, number> = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) counts[appt.time] = (counts[appt.time] || 0) + 1;
            });
            setSlotCounts(counts);

            // Overlap & Availability
            const slotOverlapCounts: Record<string, number> = {};
            const unavailable = new Set<string>();
            const bufferTime = bookingSettings.bufferMinutes || 0;

            appointmentsForDay.forEach(appt => {
                if (!appt.time || !appt.serviceInfo?.duration) return;
                const [hours, minutes] = appt.time.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                const duration = appt.serviceInfo.duration || 60;
                const endMinutes = startMinutes + duration + bufferTime;

                bookingSettings.timeQueues.forEach(queue => {
                    if (!queue.time) return;
                    const [qHours, qMinutes] = queue.time.split(':').map(Number);
                    const qTimeMinutes = qHours * 60 + qMinutes;
                    if (qTimeMinutes > startMinutes && qTimeMinutes < endMinutes) {
                        slotOverlapCounts[queue.time] = (slotOverlapCounts[queue.time] || 0) + 1;
                    }
                });
            });

            bookingSettings.timeQueues.forEach(queue => {
                const maxSlots = bookingSettings.useTechnician ? technicians.length : (queue.count || bookingSettings.totalTechnicians);
                const overlapCount = slotOverlapCounts[queue.time] || 0;
                const bookedCount = counts[queue.time] || 0;
                if (bookedCount + overlapCount >= maxSlots) unavailable.add(queue.time);
            });
            setUnavailableSlots(unavailable);

            // Technician Availability
            if (appointmentTime) {
                const unavailableIds = new Set<string>(
                    appointmentsForDay
                        .filter(appt => appt.time === appointmentTime && appt.technicianId)
                        .map(appt => appt.technicianId)
                );
                setUnavailableTechnicianIds(unavailableIds);
                if (selectedTechnicianId && unavailableIds.has(selectedTechnicianId)) {
                    setSelectedTechnicianId('');
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning');
                }
            } else {
                setUnavailableTechnicianIds(new Set());
            }
        };

        fetchAppointmentsForDate();
    }, [appointmentDate, appointmentTime, selectedTechnicianId, bookingSettings, technicians.length, showToast]);

    useEffect(() => {
        // Customer check delay
        const shouldCheck = (customerInfo.phone && customerInfo.phone.length >= 9) || (customerInfo.lineUserId && customerInfo.lineUserId.length > 0);
        if (!shouldCheck) { setExistingCustomer(null); return; }

        const checkExistingCustomer = async () => {
            setIsCheckingCustomer(true);
            try {
                if (customerInfo.lineUserId) {
                    const customerDoc = await getDoc(doc(db, 'customers', customerInfo.lineUserId));
                    if (customerDoc.exists()) {
                        setExistingCustomer({ id: customerDoc.id, ...customerDoc.data() });
                        setIsCheckingCustomer(false);
                        return;
                    }
                }
                if (customerInfo.phone) {
                    const q = query(collection(db, 'customers'), where('phone', '==', customerInfo.phone));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) setExistingCustomer({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
                    else setExistingCustomer(null);
                }
            } catch (error) { console.error(error); setExistingCustomer(null); }
            finally { setIsCheckingCustomer(false); }
        };

        const timer = setTimeout(checkExistingCustomer, 1000);
        return () => clearTimeout(timer);
    }, [customerInfo.phone, customerInfo.lineUserId]);

    // Computed
    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedAddOns = useMemo(() => (selectedService?.addOnServices || []).filter((a: any) => selectedAddOnNames.includes(a.name)), [selectedService, selectedAddOnNames]);

    const { basePrice, addOnsTotal, totalPrice, totalDuration } = useMemo(() => {
        if (!selectedService) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, totalDuration: 0 };
        let base = 0, duration = 0;

        if (selectedService.serviceType === 'multi-area') {
            if (selectedAreaIndex !== null && selectedPackageIndex !== null) {
                const pkg = selectedService.areas?.[selectedAreaIndex]?.packages?.[selectedPackageIndex];
                if (pkg) { base = pkg.price; duration = pkg.duration; }
            }
        } else if (selectedService.serviceType === 'option-based') {
            if (selectedOptionIndex !== null) {
                const opt = selectedService.serviceOptions?.[selectedOptionIndex];
                if (opt) {
                    const mult = Math.max(1, selectedAreas.length);
                    base = opt.price * mult;
                    duration = opt.duration * mult;
                }
            }
        } else if (selectedService.serviceType === 'area-based-options') {
            Object.entries(selectedAreaOptions).forEach(([areaName, optIdx]) => {
                const grp = selectedService.areaOptions?.find((g: any) => g.areaName === areaName);
                const opt = grp?.options[optIdx];
                if (opt) { base += Number(opt.price) || 0; duration += Number(opt.duration) || 0; }
            });
        } else {
            base = selectedService.price || 0;
            duration = selectedService.duration || 0;
        }

        const addOnsPrice = selectedAddOns.reduce((s: number, a: any) => s + (a.price || 0), 0);
        const addOnsDuration = selectedAddOns.reduce((s: number, a: any) => s + (a.duration || 0), 0);

        return { basePrice: base, addOnsTotal: addOnsPrice, totalPrice: base + addOnsPrice, totalDuration: duration + addOnsDuration };
    }, [selectedService, selectedAddOns, selectedAreaIndex, selectedPackageIndex, selectedOptionIndex, selectedAreas, selectedAreaOptions]);

    const availableTimeSlots = useMemo(() => {
        if (!appointmentDate || !bookingSettings.timeQueues) return [];
        const date = new Date(appointmentDate);
        const day = date.getDay();
        const sched = bookingSettings.weeklySchedule[day];
        const isHoliday = bookingSettings.holidayDates.some(h => h.date === appointmentDate) || !sched?.isOpen;

        if (isHoliday || !sched?.isOpen) return [];

        const open = sched.openTime?.replace(':', '') || '0900';
        const close = sched.closeTime?.replace(':', '') || '1700';

        let slots = bookingSettings.timeQueues.filter(q => {
            const t = q.time.replace(':', '');
            return t >= open && t <= close;
        }).map(q => q.time).sort();

        // Filter past time if today
        if (format(new Date(), 'yyyy-MM-dd') === appointmentDate) {
            const nowTime = format(new Date(), 'HH:mm');
            slots = slots.filter(s => s > nowTime);
        }

        // Filter unavailable
        const finalSlots = slots.filter(s => !unavailableSlots.has(s));
        setTimeQueueFull(finalSlots.length === 0);
        return finalSlots;
    }, [appointmentDate, bookingSettings, unavailableSlots]);

    const handleServiceChange = (id: string) => {
        setSelectedServiceId(id);
        setSelectedAddOnNames([]);
        setSelectedAreaIndex(null); setSelectedPackageIndex(null);
        setSelectedOptionIndex(null); setSelectedAreas([]);
        setSelectedAreaOptions({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTriedSubmit(true);
        setValidationError(null);
        if (!selectedService || !appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone) {
            setValidationError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        setIsSubmitting(true);
        try {
            const lineUserId = customerInfo.lineUserId?.trim() || null;

            // Construct Data
            const technician = technicians.find(t => t.id === selectedTechnicianId);

            // NOTE: Simplified construction for brevity, ensure matches interface
            const apptData: any = {
                userId: lineUserId,
                userInfo: { displayName: customerInfo.fullName },
                status: 'awaiting_confirmation',
                customerInfo: { ...customerInfo },
                serviceInfo: {
                    id: selectedService.id,
                    name: selectedService.serviceName,
                    imageUrl: selectedService.imageUrl,
                    price: basePrice,
                    duration: totalDuration
                },
                date: appointmentDate,
                time: appointmentTime,
                serviceId: selectedService.id,
                technicianId: technician?.id || null,
                appointmentInfo: {
                    dateTime: new Date(`${appointmentDate}T${appointmentTime}`),
                    technicianId: technician?.id,
                    addOns: selectedAddOns,
                    duration: totalDuration
                },
                paymentInfo: {
                    basePrice, addOnsTotal, totalPrice, originalPrice: totalPrice,
                    paymentStatus: 'pending'
                },
                createdAt: new Date(),
                createdBy: { type: 'admin', adminId: auth.currentUser?.uid || '', adminName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin' },
                needsCustomerNotification: true
            };

            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setValidationError('ไม่พบการยืนยันตัวตน');
                return;
            }
            const res = await createAppointmentWithSlotCheck(apptData, { adminToken: token });
            if (res.success) {
                showToast('สร้างการนัดหมายสำเร็จ', 'success');
                router.push('/dashboard');
            } else {
                throw new Error(res.error);
            }

        } catch (err: any) {
            setValidationError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || profileLoading) return <div className="flex justify-center items-center h-96"><div className="w-8 h-8 rounded-full border-2 border-t-blue-600 animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-6">
                {/* 1. Service Selection */}
                <section className="bg-white border rounded-lg p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-gray-900">1. เลือกบริการ</h2>
                        {triedSubmit && !selectedService && <span className="text-xs text-red-600 font-semibold">⚠️ กรุณาเลือกบริการ</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {services.filter(s => s.status === 'available').map(s => (
                            <div key={s.id} onClick={() => handleServiceChange(s.id!)}
                                className={`cursor-pointer border rounded-md p-3 flex gap-3 transition-colors ${selectedServiceId === s.id ? 'bg-gray-50 border-gray-900 ring-1 ring-gray-900' : 'hover:bg-gray-50'}`}>
                                {s.imageUrl && <img src={s.imageUrl} className="w-12 h-12 rounded object-cover" alt="" />}
                                <div>
                                    <div className="font-medium text-sm text-gray-900">{s.serviceName || s.name}</div>
                                    <div className="text-xs text-gray-500">{s.price ? `${profile?.currencySymbol}${s.price}` : 'ราคาตามตัวเลือก'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Dynamic Options UI based on Service Type */}
                    {selectedService?.serviceType === 'option-based' && (
                        <div className="mt-4 border-t pt-4">
                            <p className="text-sm font-medium mb-2">เลือกพื้นที่:</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedService.selectableAreas?.map((area: string) => (
                                    <button key={area} type="button"
                                        onClick={() => setSelectedAreas(prev => prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area])}
                                        className={`px-3 py-1 rounded border text-sm ${selectedAreas.includes(area) ? 'bg-gray-900 text-white' : 'bg-white'}`}>
                                        {area}
                                    </button>
                                ))}
                            </div>
                            <p className="text-sm font-medium mb-2">เลือกแพ็คเกจ:</p>
                            <div className="space-y-2">
                                {selectedService.serviceOptions?.map((opt: any, idx: number) => (
                                    <label key={idx} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                        <input type="radio" checked={selectedOptionIndex === idx} onChange={() => setSelectedOptionIndex(idx)} className="text-gray-900 focus:ring-gray-900" />
                                        <span className="text-sm">{opt.name} - {opt.duration} นาที ({opt.price} บาท {selectedAreas.length > 1 ? `x ${selectedAreas.length}` : ''})</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedService?.serviceType === 'multi-area' && selectedService.areas && (
                        <div className="mt-4 border-t pt-4">
                            <p className="text-sm font-medium mb-2">เลือกพื้นที่บริการ:</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {selectedService.areas.map((area: any, idx: number) => (
                                    <button key={idx} type="button"
                                        onClick={() => { setSelectedAreaIndex(idx); setSelectedPackageIndex(null); }}
                                        className={`px-3 py-1 rounded border text-sm transition-colors ${selectedAreaIndex === idx ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}>
                                        {area.name}
                                    </button>
                                ))}
                            </div>
                            {selectedAreaIndex !== null && selectedService.areas[selectedAreaIndex]?.packages && (
                                <>
                                    <p className="text-sm font-medium mb-2">เลือกแพ็คเกจ:</p>
                                    <div className="space-y-2">
                                        {selectedService.areas[selectedAreaIndex].packages.map((pkg: any, idx: number) => (
                                            <label key={idx} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                                <input type="radio" checked={selectedPackageIndex === idx} onChange={() => setSelectedPackageIndex(idx)} className="text-gray-900 focus:ring-gray-900" />
                                                <span className="text-sm flex-1">{pkg.name}</span>
                                                <span className="text-sm text-gray-500">{pkg.duration} นาที | {pkg.price} บาท</span>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {selectedService?.serviceType === 'area-based-options' && selectedService.areaOptions && (
                        <div className="mt-4 border-t pt-4 space-y-4">
                            {selectedService.areaOptions.map((areaGroup: any) => (
                                <div key={areaGroup.areaName}>
                                    <p className="text-sm font-medium mb-2">{areaGroup.areaName}:</p>
                                    <div className="space-y-2">
                                        {areaGroup.options.map((opt: any, idx: number) => (
                                            <label key={idx} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                                <input type="checkbox"
                                                    checked={selectedAreaOptions[areaGroup.areaName] === idx}
                                                    onChange={() => setSelectedAreaOptions(prev => {
                                                        const next = { ...prev };
                                                        if (next[areaGroup.areaName] === idx) delete next[areaGroup.areaName];
                                                        else next[areaGroup.areaName] = idx;
                                                        return next;
                                                    })}
                                                    className="rounded text-gray-900 focus:ring-gray-900"
                                                />
                                                <span className="text-sm flex-1">{opt.name}</span>
                                                <span className="text-sm text-gray-500">{opt.duration} นาที | {opt.price} บาท</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* 2. Date & Time */}
                <section className="bg-white border rounded-lg p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-gray-900">2. เลือกวันและเวลา</h2>
                        {triedSubmit && (!appointmentDate || !appointmentTime) && <span className="text-xs text-red-600 font-semibold">⚠️ กรุณาเลือกวันที่และเวลา</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FullCalendar selectedDate={appointmentDate} onDateSelect={setAppointmentDate} weeklySchedule={bookingSettings.weeklySchedule} holidayDates={bookingSettings.holidayDates} />
                        <div>
                            <h3 className="text-sm font-medium mb-3">เวลาที่ว่าง {appointmentDate && `(${format(new Date(appointmentDate), 'dd/MM/yyyy')})`}</h3>
                            {appointmentDate ?
                                <TimeSlotGrid timeSlots={availableTimeSlots} selectedTime={appointmentTime} onSelect={setAppointmentTime} />
                                : <div className="text-gray-400 text-sm text-center py-4">กรุณาเลือกวันที่ก่อน</div>
                            }
                        </div>
                    </div>
                </section>

                {/* Technicians (Optional) */}
                {bookingSettings.useTechnician && appointmentTime && (
                    <section className="bg-white border rounded-lg p-5">
                        <h2 className="font-semibold text-gray-900 mb-4">เลือกช่าง (ไม่บังคับ)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {technicians.map(tech => (
                                <TechnicianCard key={tech.id} technician={tech} isSelected={selectedTechnicianId === tech.id}
                                    onSelect={(t) => setSelectedTechnicianId(t.id)} isAvailable={!unavailableTechnicianIds.has(tech.id)} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Right Column: Customer & Summary */}
            <div className="space-y-6">
                <section className="bg-white border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">ข้อมูลลูกค้า</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-gray-500">เบอร์โทรศัพท์</label>
                            <input type="tel" value={customerInfo.phone} onChange={e => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))} className={`w-full border rounded p-2 text-sm ${triedSubmit && !customerInfo.phone ? 'border-red-500 focus:ring-red-500 focus:border-red-500 ring-1 ring-red-500' : 'border-gray-300'}`} placeholder="08x-xxx-xxxx" />
                            {triedSubmit && !customerInfo.phone && <div className="text-[11px] text-red-600 font-semibold mt-0.5">กรุณากรอกเบอร์โทรศัพท์</div>}
                            {isCheckingCustomer && <span className="text-xs text-blue-500">กำลังตรวจสอบ...</span>}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">ชื่อ-นามสกุล</label>
                            <input type="text" value={customerInfo.fullName} onChange={e => setCustomerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                                className={`w-full border rounded p-2 text-sm ${triedSubmit && !customerInfo.fullName ? 'border-red-500 focus:ring-red-500 focus:border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${existingCustomer ? 'bg-green-50' : ''}`} placeholder="ชื่อลูกค้า" />
                            {triedSubmit && !customerInfo.fullName && <div className="text-[11px] text-red-600 font-semibold mt-0.5">กรุณากรอกชื่อ-นามสกุล</div>}
                        </div>
                        {existingCustomer && <div className="text-xs text-green-600">✓ พอลูกค้าเดิมในระบบ ({existingCustomer.points || 0} คะแนน)</div>}
                        <div>
                            <label className="text-xs font-medium text-gray-500">LINE User ID (Optional)</label>
                            <input type="text" value={customerInfo.lineUserId} onChange={e => setCustomerInfo(prev => ({ ...prev, lineUserId: e.target.value }))} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">หมายเหตุ</label>
                            <textarea value={customerInfo.note} onChange={e => setCustomerInfo(prev => ({ ...prev, note: e.target.value }))} className="w-full border rounded p-2 text-sm" rows={2} />
                        </div>
                    </div>
                </section>

                <section className="bg-gray-50 border rounded-lg p-5">
                    <h2 className="font-semibold text-gray-900 mb-4">สรุปรายการ</h2>
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between"><span>บริการ</span><span className="font-medium">{selectedService?.serviceName || '-'}</span></div>
                        <div className="flex justify-between"><span>ระยะเวลา</span><span>{totalDuration} นาที</span></div>
                        {selectedAddOns.length > 0 && <div className="flex justify-between text-gray-500"><span>บริการเสริม</span><span>{selectedAddOns.length} รายการ</span></div>}
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                            <span>ยอดสุทธิ</span>
                            <span>{profile?.currencySymbol}{totalPrice.toLocaleString()}</span>
                        </div>
                    </div>
                    {validationError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                            ⚠️ {validationError}
                        </div>
                    )}
                    <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-3 rounded-lg font-medium btn-primary">
                        {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการนัดหมาย'}
                    </button>
                </section>
            </div>
        </div>
    );
}
