"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, collection, getDocs, query, orderBy, where, doc, getDoc } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
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
            setValidationError('กรุณากรอกข้อมูลให้ครบถ้วน: บริการ, วันที่, เวลา, ชื่อลูกค้า และเบอร์โทรศัพท์');
            return;
        }

        setIsSubmitting(true);
        try {
            const lineUserId = customerInfo.lineUserId?.trim() || null;
            const technician = technicians.find(t => t.id === selectedTechnicianId);

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
                createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'admin'
            };

            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                setValidationError('ไม่พบการยืนยันตัวตนของผู้ดูแลระบบ');
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

    if (loading || profileLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลฟอร์มนัดหมาย...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* 1. Frameless Operations Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8d6e63] hover:text-[#5d4037] transition-colors"
                        >
                            <span>← แดชบอร์ด</span>
                        </Link>
                        <span className="text-[#d7ccc8]">/</span>
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723] tracking-tight">
                            สร้างการนัดหมายใหม่
                        </h1>
                    </div>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        ลงคิวนัดหมายล่วงหน้า เลือกบริการ วันเวลา และระบุข้อมูลลูกค้าเพื่อยืนยันการจอง
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard"
                        className="h-9 px-3.5 text-xs font-bold rounded-xl border border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed] transition-colors flex items-center"
                    >
                        ยกเลิก
                    </Link>
                </div>
            </div>

            {/* 2. Main Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Service & Booking (8 Cols) */}
                <div className="lg:col-span-8 space-y-5">
                    {/* Step 1: Select Service */}
                    <section className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#e7e0da]">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] text-xs font-bold flex items-center justify-center">
                                    1
                                </span>
                                <h2 className="font-bold text-sm text-[#3e2723]">เลือกบริการ</h2>
                            </div>
                            {triedSubmit && !selectedService && (
                                <span className="text-xs text-rose-600 font-bold animate-in fade-in-50">
                                    ⚠️ กรุณาเลือกบริการ
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {services.filter(s => s.status === 'available').map(s => {
                                const isSelected = selectedServiceId === s.id;
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => handleServiceChange(s.id!)}
                                        className={`cursor-pointer border rounded-xl p-3 flex gap-3 transition-all select-none ${
                                            isSelected
                                                ? 'bg-[#f5f2ed] border-[#5d4037] ring-1 ring-[#5d4037] shadow-2xs'
                                                : 'bg-[#faf8f5] hover:bg-white border-[#e7e0da] hover:border-[#d7ccc8]'
                                        }`}
                                    >
                                        {s.imageUrl ? (
                                            <img
                                                src={s.imageUrl}
                                                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#d7ccc8]"
                                                alt=""
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white border border-[#d7ccc8] flex items-center justify-center text-lg shrink-0">
                                                💆
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs sm:text-sm text-[#3e2723] truncate">
                                                {s.serviceName || s.name}
                                            </div>
                                            <div className="text-xs text-[#5d4037] font-semibold mt-0.5 tabular-nums">
                                                {s.price ? `${s.price.toLocaleString()} บาท` : 'ราคาตามตัวเลือก'}
                                            </div>
                                            {s.duration && (
                                                <div className="text-[11px] text-[#8d6e63]">
                                                    ⏱ {s.duration} นาที
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Service Options (Dynamic) */}
                        {selectedService?.serviceType === 'option-based' && (
                            <div className="mt-4 bg-[#faf8f5] p-3.5 rounded-xl border border-[#e7e0da] space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-[#3e2723] uppercase mb-2">เลือกพื้นที่บริการ:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedService.selectableAreas?.map((area: string) => {
                                            const isAreaSelected = selectedAreas.includes(area);
                                            return (
                                                <button
                                                    key={area}
                                                    type="button"
                                                    onClick={() => setSelectedAreas(prev => prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area])}
                                                    className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
                                                        isAreaSelected
                                                            ? 'bg-[#5d4037] text-white border-[#5d4037]'
                                                            : 'bg-white border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed]'
                                                    }`}
                                                >
                                                    {area}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-[#3e2723] uppercase mb-2">เลือกแพ็คเกจ:</p>
                                    <div className="space-y-2">
                                        {selectedService.serviceOptions?.map((opt: any, idx: number) => (
                                            <label
                                                key={idx}
                                                className={`flex items-center gap-2.5 p-2.5 bg-white border rounded-xl cursor-pointer transition-colors ${
                                                    selectedOptionIndex === idx
                                                        ? 'border-[#5d4037] ring-1 ring-[#5d4037]'
                                                        : 'border-[#e7e0da] hover:border-[#d7ccc8]'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    checked={selectedOptionIndex === idx}
                                                    onChange={() => setSelectedOptionIndex(idx)}
                                                    className="accent-[#5d4037]"
                                                />
                                                <span className="text-xs font-semibold text-[#3e2723] flex-1">
                                                    {opt.name} - {opt.duration} นาที
                                                </span>
                                                <span className="text-xs font-bold text-[#5d4037] tabular-nums">
                                                    {opt.price?.toLocaleString()} บาท {selectedAreas.length > 1 ? `x ${selectedAreas.length}` : ''}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedService?.serviceType === 'multi-area' && selectedService.areas && (
                            <div className="mt-4 bg-[#faf8f5] p-3.5 rounded-xl border border-[#e7e0da] space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-[#3e2723] uppercase mb-2">เลือกพื้นที่บริการ:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedService.areas.map((area: any, idx: number) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => { setSelectedAreaIndex(idx); setSelectedPackageIndex(null); }}
                                                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
                                                    selectedAreaIndex === idx
                                                        ? 'bg-[#5d4037] text-white border-[#5d4037]'
                                                        : 'bg-white border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed]'
                                                }`}
                                            >
                                                {area.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedAreaIndex !== null && selectedService.areas[selectedAreaIndex]?.packages && (
                                    <div>
                                        <p className="text-xs font-bold text-[#3e2723] uppercase mb-2">เลือกแพ็คเกจ:</p>
                                        <div className="space-y-2">
                                            {selectedService.areas[selectedAreaIndex].packages.map((pkg: any, idx: number) => (
                                                <label
                                                    key={idx}
                                                    className={`flex items-center gap-2.5 p-2.5 bg-white border rounded-xl cursor-pointer transition-colors ${
                                                        selectedPackageIndex === idx
                                                            ? 'border-[#5d4037] ring-1 ring-[#5d4037]'
                                                            : 'border-[#e7e0da] hover:border-[#d7ccc8]'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        checked={selectedPackageIndex === idx}
                                                        onChange={() => setSelectedPackageIndex(idx)}
                                                        className="accent-[#5d4037]"
                                                    />
                                                    <span className="text-xs font-semibold text-[#3e2723] flex-1">
                                                        {pkg.name}
                                                    </span>
                                                    <span className="text-xs font-bold text-[#5d4037] tabular-nums">
                                                        {pkg.duration} นาที | {pkg.price?.toLocaleString()} บาท
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedService?.serviceType === 'area-based-options' && selectedService.areaOptions && (
                            <div className="mt-4 bg-[#faf8f5] p-3.5 rounded-xl border border-[#e7e0da] space-y-3">
                                {selectedService.areaOptions.map((areaGroup: any) => (
                                    <div key={areaGroup.areaName}>
                                        <p className="text-xs font-bold text-[#3e2723] uppercase mb-2">{areaGroup.areaName}:</p>
                                        <div className="space-y-2">
                                            {areaGroup.options.map((opt: any, idx: number) => (
                                                <label
                                                    key={idx}
                                                    className="flex items-center gap-2.5 p-2.5 bg-white border border-[#e7e0da] rounded-xl cursor-pointer hover:border-[#d7ccc8]"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedAreaOptions[areaGroup.areaName] === idx}
                                                        onChange={() => setSelectedAreaOptions(prev => {
                                                            const next = { ...prev };
                                                            if (next[areaGroup.areaName] === idx) delete next[areaGroup.areaName];
                                                            else next[areaGroup.areaName] = idx;
                                                            return next;
                                                        })}
                                                        className="accent-[#5d4037] rounded"
                                                    />
                                                    <span className="text-xs font-semibold text-[#3e2723] flex-1">
                                                        {opt.name}
                                                    </span>
                                                    <span className="text-xs font-bold text-[#5d4037] tabular-nums">
                                                        {opt.duration} นาที | {opt.price?.toLocaleString()} บาท
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Step 2: Date & Time */}
                    <section className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-[#e7e0da]">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] text-xs font-bold flex items-center justify-center">
                                    2
                                </span>
                                <h2 className="font-bold text-sm text-[#3e2723]">เลือกวันและเวลา</h2>
                            </div>
                            {triedSubmit && (!appointmentDate || !appointmentTime) && (
                                <span className="text-xs text-rose-600 font-bold animate-in fade-in-50">
                                    ⚠️ กรุณาเลือกทั้งวันที่และเวลา
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                            {/* Calendar Component */}
                            <div>
                                <FullCalendar
                                    selectedDate={appointmentDate}
                                    onDateSelect={setAppointmentDate}
                                    weeklySchedule={bookingSettings.weeklySchedule}
                                    holidayDates={bookingSettings.holidayDates}
                                />
                            </div>

                            {/* Time Slots */}
                            <div className="bg-[#faf8f5] p-4 rounded-2xl border border-[#e7e0da] space-y-3">
                                <div>
                                    <div className="text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
                                        ช่วงเวลาที่ว่าง
                                    </div>
                                    <div className="text-xs font-bold text-[#3e2723] mt-0.5">
                                        {appointmentDate
                                            ? format(new Date(appointmentDate), 'EEEEที่ d MMMM yyyy', { locale: th })
                                            : 'กรุณาคลิกเลือกวันที่จากปฏิทิน'}
                                    </div>
                                </div>

                                {appointmentDate ? (
                                    <TimeSlotGrid
                                        timeSlots={availableTimeSlots}
                                        selectedTime={appointmentTime}
                                        onSelect={setAppointmentTime}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-xs text-[#8d6e63]">
                                        คลิกเลือกวันที่จากปฏิทินด้านซ้ายเพื่อดูช่วงเวลา
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Step 3: Technicians (Optional) */}
                    {bookingSettings.useTechnician && appointmentTime && (
                        <section className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-[#e7e0da]">
                                <span className="w-6 h-6 rounded-lg bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] text-xs font-bold flex items-center justify-center">
                                    3
                                </span>
                                <h2 className="font-bold text-sm text-[#3e2723]">เลือกช่างผู้ให้บริการ (ไม่บังคับ)</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {technicians.map(tech => (
                                    <TechnicianCard
                                        key={tech.id}
                                        technician={tech}
                                        isSelected={selectedTechnicianId === tech.id}
                                        onSelect={(t) => setSelectedTechnicianId(t.id)}
                                        isAvailable={!unavailableTechnicianIds.has(tech.id)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column: Customer Info & Order Summary (4 Cols) */}
                <div className="lg:col-span-4 space-y-5">
                    {/* Customer Info Card */}
                    <section className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5">
                        <div className="pb-2 border-b border-[#e7e0da]">
                            <h2 className="font-bold text-sm text-[#3e2723]">ข้อมูลลูกค้า</h2>
                            <p className="text-[11px] text-[#8d6e63]">ระบุเบอร์โทรเพื่อค้นหาประวัติอัตโนมัติ</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase block mb-1">
                                    เบอร์โทรศัพท์ <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    value={customerInfo.phone}
                                    onChange={e => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                                    className={`w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border transition-all outline-none font-medium text-[#3e2723] placeholder:text-[#a1887f] ${
                                        triedSubmit && !customerInfo.phone
                                            ? 'border-rose-400 bg-rose-50/20'
                                            : 'border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037]'
                                    }`}
                                    placeholder="08x-xxx-xxxx"
                                />
                                {triedSubmit && !customerInfo.phone && (
                                    <div className="text-[10px] text-rose-600 font-bold mt-1">
                                        กรุณาระบุเบอร์โทรศัพท์
                                    </div>
                                )}
                                {isCheckingCustomer && (
                                    <span className="text-[11px] text-[#5d4037] font-medium block mt-1">
                                        กำลังค้นหาประวัติลูกค้า...
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase block mb-1">
                                    ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={customerInfo.fullName}
                                    onChange={e => setCustomerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                                    className={`w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border transition-all outline-none font-medium text-[#3e2723] placeholder:text-[#a1887f] ${
                                        triedSubmit && !customerInfo.fullName
                                            ? 'border-rose-400 bg-rose-50/20'
                                            : existingCustomer
                                            ? 'bg-emerald-50/40 border-emerald-300'
                                            : 'bg-[#faf8f5] border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037]'
                                    }`}
                                    placeholder="ชื่อและนามสกุลลูกค้า"
                                />
                                {triedSubmit && !customerInfo.fullName && (
                                    <div className="text-[10px] text-rose-600 font-bold mt-1">
                                        กรุณาระบุชื่อลูกค้า
                                    </div>
                                )}
                            </div>

                            {existingCustomer && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-1.5">
                                    <span>✓</span>
                                    <span>พบข้อมูลลูกค้าในระบบ ({existingCustomer.points || 0} คะแนน)</span>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase block mb-1">
                                    LINE User ID (ถ้ามี)
                                </label>
                                <input
                                    type="text"
                                    value={customerInfo.lineUserId}
                                    onChange={e => setCustomerInfo(prev => ({ ...prev, lineUserId: e.target.value }))}
                                    className="w-full h-10 px-3.5 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none font-mono text-[#3e2723] placeholder:text-[#a1887f]"
                                    placeholder="U1234567890..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase block mb-1">
                                    หมายเหตุประกอบ
                                </label>
                                <textarea
                                    value={customerInfo.note}
                                    onChange={e => setCustomerInfo(prev => ({ ...prev, note: e.target.value }))}
                                    className="w-full p-3 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] resize-none font-medium placeholder:text-[#a1887f]"
                                    rows={2}
                                    placeholder="เช่น ลูกค้าแพ้น้ำมันหอมบางชนิด, ขอน้ำหนักมือปานกลาง..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Order Summary Card */}
                    <section className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                        <div className="pb-2 border-b border-[#e7e0da]">
                            <h2 className="font-bold text-sm text-[#3e2723]">สรุปรายละเอียดการจอง</h2>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-[#8d6e63]">บริการ</span>
                                <span className="font-bold text-[#3e2723] text-right truncate">
                                    {selectedService?.serviceName || '-'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-[#8d6e63]">ระยะเวลา</span>
                                <span className="font-medium text-[#3e2723] tabular-nums">
                                    {totalDuration} นาที
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-[#8d6e63]">วันที่นัด</span>
                                <span className="font-medium text-[#3e2723] tabular-nums">
                                    {appointmentDate ? format(new Date(appointmentDate), 'd MMM yyyy', { locale: th }) : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-[#8d6e63]">เวลา</span>
                                <span className="font-medium text-[#3e2723] tabular-nums">
                                    {appointmentTime ? `${appointmentTime} น.` : '-'}
                                </span>
                            </div>
                            {selectedTechnicianId && (
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-[#8d6e63]">ช่าง</span>
                                    <span className="font-medium text-[#5d4037]">
                                        {technicians.find(t => t.id === selectedTechnicianId)?.firstName || '-'}
                                    </span>
                                </div>
                            )}

                            {/* Price highlight */}
                            <div className="pt-3 border-t border-[#e7e0da] flex justify-between items-baseline">
                                <span className="text-xs font-bold text-[#3e2723] uppercase">ยอดสุทธิ</span>
                                <div className="text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
                                    {totalPrice.toLocaleString()}{' '}
                                    <span className="text-xs font-bold text-[#5d4037]">บาท</span>
                                </div>
                            </div>
                        </div>

                        {validationError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium animate-in fade-in-50">
                                ⚠️ {validationError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full h-11 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>กำลังบันทึกการนัดหมาย...</span>
                                </>
                            ) : (
                                <span>ยืนยันการนัดหมาย</span>
                            )}
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
}
