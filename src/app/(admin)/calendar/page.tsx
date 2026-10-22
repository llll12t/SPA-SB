"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where, db } from "@/app/lib/supabaseDb";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays } from "date-fns";
import { th } from "date-fns/locale";
import { useToast } from "@/app/components/Toast";
import { Appointment, Technician } from "@/types";
import { useRouter } from "next/navigation";
import { blockAppointmentSlot } from "@/app/actions/blockActions";

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string; blockBg: string }> = {
    awaiting_confirmation: {
        label: "รอยืนยัน",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
        dotClass: "bg-amber-500",
        blockBg: "bg-amber-50/90 border-amber-300 text-amber-900",
    },
    pending: {
        label: "รออนุมัติ",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200/80",
        dotClass: "bg-amber-500",
        blockBg: "bg-amber-50/90 border-amber-300 text-amber-900",
    },
    confirmed: {
        label: "ยืนยันแล้ว",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
        dotClass: "bg-emerald-500",
        blockBg: "bg-emerald-50/90 border-emerald-300 text-emerald-900",
    },
    completed: {
        label: "เสร็จสิ้น",
        badgeClass: "bg-[#f5f2ed] text-[#5d4037] border-[#d7ccc8]",
        dotClass: "bg-[#5d4037]",
        blockBg: "bg-[#f5f2ed]/90 border-[#d7ccc8] text-[#3e2723]",
    },
    cancelled: {
        label: "ยกเลิก",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
        blockBg: "bg-rose-50/90 border-rose-300 text-rose-900",
    },
    blocked: {
        label: "ปิดกั้นช่วงเวลา",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-300",
        dotClass: "bg-stone-500",
        blockBg: "bg-stone-200/90 border-stone-400 text-stone-800",
    },
};

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd");

export default function CalendarPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [techniciansList, setTechniciansList] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));

    const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");
    const [isBlockMode, setIsBlockMode] = useState(false);
    const [blockModal, setBlockModal] = useState<{ isOpen: boolean; techId: string | null; time: string | null }>({
        isOpen: false,
        techId: null,
        time: null,
    });
    const [blockReason, setBlockReason] = useState("");
    const [blockDuration, setBlockDuration] = useState(60);

    // Fetch Technicians
    useEffect(() => {
        const fetchTechnicians = async () => {
            try {
                const q = query(collection(db, "technicians"), orderBy("firstName"));
                const snap = await getDocs(q);
                setTechniciansList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Technician)));
            } catch (error) {
                console.error("Error fetching technicians:", error);
            }
        };
        fetchTechnicians();
    }, []);

    // Fetch Appointments for Active Month
    useEffect(() => {
        const fetchAppointments = async () => {
            setLoading(true);
            try {
                const monthStart = startOfMonth(activeMonth);
                const monthEnd = endOfMonth(activeMonth);
                const q = query(
                    collection(db, "appointments"),
                    orderBy("date"),
                    where("date", ">=", formatDateKey(monthStart)),
                    where("date", "<=", formatDateKey(monthEnd))
                );
                const snap = await getDocs(q);
                setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));

                const sel = new Date(selectedDate);
                if (sel.getMonth() !== activeMonth.getMonth() || sel.getFullYear() !== activeMonth.getFullYear()) {
                    setSelectedDate(formatDateKey(activeMonth));
                }
            } catch (e) {
                console.error(e);
                showToast("ไม่สามารถโหลดข้อมูลได้", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchAppointments();
    }, [activeMonth, showToast]);

    const appointmentsByDate = useMemo(() => {
        return appointments.reduce((acc, apt) => {
            if (!apt.date) return acc;
            const key = typeof apt.date === "string" ? apt.date : format(apt.date.toDate(), "yyyy-MM-dd");
            if (!acc[key]) acc[key] = [];
            acc[key].push(apt);
            return acc;
        }, {} as Record<string, Appointment[]>);
    }, [appointments]);

    const calendarDays = useMemo(() => {
        const firstDay = startOfMonth(activeMonth);
        const startDay = addDays(firstDay, -firstDay.getDay());
        return Array.from({ length: 42 }, (_, i) => {
            const date = addDays(startDay, i);
            const dateKey = formatDateKey(date);
            return {
                date,
                dateKey,
                isCurrentMonth: date.getMonth() === activeMonth.getMonth(),
                isToday: dateKey === formatDateKey(new Date()),
                appointments: appointmentsByDate[dateKey] || [],
            };
        });
    }, [activeMonth, appointmentsByDate]);

    const selectedAppointments = appointmentsByDate[selectedDate] || [];

    // Timeline Helpers
    const timeSlots = useMemo(() => Array.from({ length: 13 }, (_, i) => `${(9 + i).toString().padStart(2, "0")}:00`), []);
    const parseTime = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    };
    const timeToPosition = (t: string) => ((parseTime(t) - 540) / 720) * 100;
    const durationToHeight = (d: number) => (d / 720) * 100;

    const technicians = useMemo(() => {
        const techMap = new Map();
        techniciansList.forEach((t) => {
            techMap.set(t.id, { id: t.id, name: `${t.firstName} ${t.lastName || ""}`.trim() });
        });
        selectedAppointments.forEach((apt: any) => {
            if (apt.technicianInfo?.id) {
                const id = apt.technicianInfo.id;
                if (!techMap.has(id)) {
                    techMap.set(id, { id, name: `${apt.technicianInfo.firstName || ""} ${apt.technicianInfo.lastName || ""}`.trim() });
                }
            }
        });
        if (techMap.size === 0) techMap.set("default", { id: "default", name: "ทั้งหมด" });
        return Array.from(techMap.values());
    }, [selectedAppointments, techniciansList]);

    const appointmentsByTechnician = useMemo(() => {
        const byTech: any = {};
        technicians.forEach((t: any) => (byTech[t.id] = []));
        selectedAppointments.forEach((apt: any) => {
            const id = apt.technicianId || apt.technicianInfo?.id || "default";
            if (byTech[id] === undefined && !technicians.some((t: any) => t.id === id)) {
                if (byTech["default"]) byTech["default"].push(apt);
            } else if (byTech[id]) {
                byTech[id].push(apt);
            }
        });

        Object.values(byTech).forEach((apts: any) => {
            apts.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
            apts.forEach((apt: any, idx: number) => {
                const start = parseTime(apt.time || "09:00");
                const end = start + (apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60);
                const overlapping = apts.filter(
                    (o: any, i: number) =>
                        i !== idx &&
                        parseTime(o.time || "09:00") < end &&
                        parseTime(o.time || "09:00") + (o.serviceInfo?.duration || o.appointmentInfo?.duration || 60) > start
                );
                apt._totalColumns = overlapping.length + 1;
                const used = new Set(overlapping.map((o: any) => o._column).filter((c: any) => c !== undefined));
                for (let c = 0; c < apt._totalColumns; c++) {
                    if (!used.has(c)) {
                        apt._column = c;
                        break;
                    }
                }
            });
        });
        return byTech;
    }, [selectedAppointments, technicians]);

    const handleDayNav = (dir: number) => {
        const d = addDays(new Date(selectedDate), dir);
        setSelectedDate(formatDateKey(d));
        if (d.getMonth() !== activeMonth.getMonth()) setActiveMonth(startOfMonth(d));
    };

    const handleSlotClick = (techId: string, time: string) => {
        if (isBlockMode) {
            setBlockModal({ isOpen: true, techId, time });
            return;
        }
        const params = new URLSearchParams();
        params.set("date", selectedDate);
        params.set("time", time);
        if (techId !== "default") params.set("technicianId", techId);
        window.open(`/create-appointment?${params.toString()}`, "_blank");
    };

    const confirmBlockPayload = async () => {
        if (!blockModal.time || !blockModal.techId) return;
        setLoading(true);
        try {
            await blockAppointmentSlot({
                date: selectedDate,
                time: blockModal.time,
                technicianId: blockModal.techId === "default" ? undefined : blockModal.techId,
                duration: blockDuration,
                note: blockReason || "Not Available",
            });
            showToast("บันทึกการปิดกั้นช่วงเวลาสำเร็จ", "success");
            setBlockModal({ isOpen: false, techId: null, time: null });
            setBlockReason("");
            window.location.reload();
        } catch (e: any) {
            showToast(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    if (loading && appointments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลตารางนัดหมาย...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Block Modal */}
            {blockModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in-50">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-sm border border-[#d7ccc8]/70 shadow-2xl space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#f5f2ed] text-[#5d4037] border border-[#d7ccc8] flex items-center justify-center shrink-0">
                                🚫
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-[#3e2723]">ปิดกั้นช่วงเวลาให้บริการ</h3>
                                <p className="text-xs text-[#8d6e63] mt-0.5">
                                    {blockModal.techId !== "default" && technicians.find((t) => t.id === blockModal.techId)?.name}
                                    <br />
                                    เวลา {blockModal.time} น. ({selectedDate})
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-1">
                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase tracking-wide block mb-1">
                                    ระยะเวลาที่ปิดกั้น
                                </label>
                                <select
                                    value={blockDuration}
                                    onChange={(e) => setBlockDuration(Number(e.target.value))}
                                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] font-medium"
                                >
                                    <option value={30}>30 นาที</option>
                                    <option value={60}>1 ชั่วโมง (60 นาที)</option>
                                    <option value={120}>2 ชั่วโมง</option>
                                    <option value={180}>3 ชั่วโมง</option>
                                    <option value={240}>4 ชั่วโมง (ครึ่งวัน)</option>
                                    <option value={480}>ทั้งวัน (8 ชั่วโมง)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[#3e2723] uppercase tracking-wide block mb-1">
                                    เหตุผลประกอบ
                                </label>
                                <input
                                    type="text"
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    placeholder="เช่น พักเที่ยง, ลากิจ, ซ่อมเครื่องมือ"
                                    className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] font-medium placeholder:text-[#a1887f]"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setBlockModal({ isOpen: false, techId: null, time: null })}
                                className="px-3.5 h-9 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={confirmBlockPayload}
                                className="px-4 h-9 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white text-xs font-bold shadow-xs transition-colors"
                            >
                                ยืนยันปิดกั้น
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Frameless Clean Operations Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723] tracking-tight">
                            ปฏิทินนัดหมาย
                        </h1>
                        <span className="text-[11px] font-semibold text-[#5d4037] bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#d7ccc8]/70">
                            {format(activeMonth, "MMMM yyyy", { locale: th })}
                        </span>
                    </div>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        ตรวจสอบตารางเวลาคิวบริการ และจัดสรรช่างผู้ให้บริการแบบเรียลไทม์
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* View Switcher */}
                    <div className="inline-flex p-1 bg-white rounded-xl border border-[#d7ccc8] gap-1 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setViewMode("calendar")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "calendar"
                                    ? "bg-[#5d4037] text-white shadow-2xs"
                                    : "text-[#5d4037] hover:text-[#3e2723]"
                            }`}
                        >
                            ปฏิทิน (เดือน)
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("timeline")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "timeline"
                                    ? "bg-[#5d4037] text-white shadow-2xs"
                                    : "text-[#5d4037] hover:text-[#3e2723]"
                            }`}
                        >
                            เส้นเวลา (ช่าง)
                        </button>
                    </div>

                    {/* Block Slot Mode Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsBlockMode(!isBlockMode)}
                        className={`h-9 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                            isBlockMode
                                ? "bg-rose-50 border-rose-300 text-rose-700"
                                : "bg-white border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed]"
                        }`}
                    >
                        <span>{isBlockMode ? "✕ ออกจากโหมดปิดกั้น" : "🚫 ปิดกั้นช่วงเวลา"}</span>
                    </button>

                    {/* Create Appointment */}
                    <button
                        type="button"
                        onClick={() => router.push("/create-appointment")}
                        className="h-9 px-3.5 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                        <span>+ นัดหมายใหม่</span>
                    </button>
                </div>
            </div>

            {/* Block Mode Alert Banner */}
            {isBlockMode && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-xs text-rose-800 animate-in fade-in-50">
                    <div className="flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                        <span>กำลังอยู่ในโหมดปิดกั้นช่วงเวลา: คลิกช่องเวลาว่างในหน้าต่างเพื่อระบุเวลาที่ไม่สะดวกให้บริการ</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsBlockMode(false)}
                        className="font-bold underline text-rose-900 hover:text-black text-xs"
                    >
                        ปิดโหมดนี้
                    </button>
                </div>
            )}

            {/* 2. Main Content Views */}
            {viewMode === "calendar" ? (
                <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-start">
                    {/* Calendar Month Grid */}
                    <div className="flex-1 bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs w-full space-y-3.5">
                        {/* Month Navigator Header */}
                        <div className="flex items-center justify-between pb-1">
                            <div>
                                <h2 className="text-base font-bold text-[#3e2723]">
                                    {format(activeMonth, "MMMM yyyy", { locale: th })}
                                </h2>
                                <p className="text-[11px] text-[#8d6e63]">คลิกวันที่เพื่อดูรายละเอียดคิวด้านขวา</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveMonth((p) => subMonths(p, 1))}
                                    className="w-8 h-8 rounded-xl border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                                    title="เดือนก่อนหน้า"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const now = new Date();
                                        setActiveMonth(startOfMonth(now));
                                        setSelectedDate(formatDateKey(now));
                                    }}
                                    className="h-8 px-2.5 rounded-xl border border-[#d7ccc8] text-[11px] font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                                >
                                    วันนี้
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveMonth((p) => addMonths(p, 1))}
                                    className="w-8 h-8 rounded-xl border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                                    title="เดือนถัดไป"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Weekday Labels */}
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#8d6e63] py-1 border-b border-[#e7e0da]">
                            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d, idx) => (
                                <div key={d} className={idx === 0 ? "text-rose-600" : ""}>
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Grid Cells */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map(({ date, dateKey, isCurrentMonth, isToday, appointments: dayApts }) => {
                                const isSelected = selectedDate === dateKey;
                                return (
                                    <button
                                        key={dateKey}
                                        type="button"
                                        onClick={() => setSelectedDate(dateKey)}
                                        className={`h-20 sm:h-22 p-1.5 sm:p-2 rounded-xl text-left border transition-all flex flex-col justify-between relative group ${
                                            isSelected
                                                ? "border-[#5d4037] ring-1 ring-[#5d4037] bg-white z-10 shadow-xs"
                                                : isCurrentMonth
                                                ? "border-[#e7e0da] bg-white text-[#3e2723] hover:border-[#5d4037]/60 hover:bg-[#faf8f5]"
                                                : "border-transparent bg-[#faf8f5]/60 text-stone-400"
                                        } ${isToday && !isSelected ? "bg-[#f5f2ed]/60" : ""}`}
                                    >
                                        <div className="flex items-start justify-between w-full">
                                            <span
                                                className={`text-xs font-bold leading-none w-5 h-5 flex items-center justify-center rounded-full tabular-nums ${
                                                    isToday
                                                        ? "bg-[#5d4037] text-white"
                                                        : isSelected
                                                        ? "text-[#3e2723] font-extrabold"
                                                        : ""
                                                }`}
                                            >
                                                {date.getDate()}
                                            </span>
                                            {dayApts.length > 0 && (
                                                <span
                                                    className={`text-[9px] px-1 py-0.2 rounded-md font-bold leading-none tabular-nums ${
                                                        isSelected
                                                            ? "bg-[#5d4037] text-white"
                                                            : "bg-[#f5f2ed] text-[#5d4037] border border-[#d7ccc8]"
                                                    }`}
                                                >
                                                    {dayApts.length}
                                                </span>
                                            )}
                                        </div>

                                        {dayApts.length > 0 && (
                                            <div className="w-full space-y-1 overflow-hidden mt-0.5">
                                                <div className="flex gap-0.5 h-1 w-full rounded-full overflow-hidden bg-stone-100">
                                                    {dayApts.map((apt, i) => {
                                                        const conf = STATUS_CONFIG[apt.status] || STATUS_CONFIG.cancelled;
                                                        return <div key={i} className={`h-full flex-1 ${conf.dotClass}`} />;
                                                    })}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    {dayApts.slice(0, 1).map((apt, i) => (
                                                        <div key={i} className="flex items-center gap-1">
                                                            <span className="text-[9px] text-[#5d4037] truncate font-medium leading-none">
                                                                {apt.customerInfo?.fullName || apt.customerInfo?.name || "ลูกค้า"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {dayApts.length > 1 && (
                                                        <span className="text-[8px] text-[#8d6e63] font-medium leading-none">
                                                            +{dayApts.length - 1} คิว
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Date Side Panel */}
                    <div className="w-full lg:w-80 bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3 shrink-0">
                        <div className="border-b border-[#e7e0da] pb-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8d6e63]">
                                รายการนัดหมายประจำวัน
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-[#3e2723] mt-0.5">
                                {format(new Date(selectedDate), "EEEEที่ d MMMM yyyy", { locale: th })}
                            </h3>
                            <div className="text-xs text-[#5d4037] font-semibold mt-0.5">
                                รวม {selectedAppointments.length} รายการ
                            </div>
                        </div>

                        {selectedAppointments.length === 0 ? (
                            <div className="text-center py-10 px-4 border border-dashed border-[#d7ccc8] rounded-xl bg-[#faf8f5] space-y-2">
                                <div className="text-2xl">🌿</div>
                                <p className="text-xs font-bold text-[#3e2723]">ไม่มีรายการนัดหมายในวันนี้</p>
                                <p className="text-[11px] text-[#8d6e63]">คลิกปุ่มด้านล่างเพื่อสร้างคิวใหม่</p>
                                <button
                                    type="button"
                                    onClick={() => router.push(`/create-appointment?date=${selectedDate}`)}
                                    className="mt-2 px-3 py-1.5 rounded-lg bg-[#5d4037] hover:bg-[#3e2723] text-white text-xs font-bold transition-colors"
                                >
                                    + จองคิววันนี้
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2.5 max-h-[62vh] overflow-y-auto pr-0.5 scrollbar-thin">
                                {selectedAppointments
                                    .sort((a, b) => ((a.time as string) || "").localeCompare((b.time as string) || ""))
                                    .map((apt) => {
                                        const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.cancelled;
                                        const duration = apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60;
                                        const [h, m] = ((apt.time as string) || "09:00").split(":").map(Number);
                                        const endM = h * 60 + m + duration;
                                        const end = `${Math.floor(endM / 60).toString().padStart(2, "0")}:${(endM % 60).toString().padStart(2, "0")}`;

                                        return (
                                            <div
                                                key={apt.id}
                                                onClick={() => router.push(`/appointments/${apt.id}`)}
                                                className="border border-[#e7e0da] hover:border-[#5d4037] bg-[#faf8f5] hover:bg-white rounded-xl p-3 transition-all cursor-pointer space-y-1.5 group shadow-2xs"
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-bold text-[#3e2723] tabular-nums">
                                                        {apt.time || "--:--"} - {end} น.
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold border ${status.badgeClass}`}>
                                                        {status.label}
                                                    </span>
                                                </div>

                                                <div>
                                                    <div className="text-xs font-bold text-[#3e2723] group-hover:text-[#5d4037] transition-colors truncate">
                                                        {apt.customerInfo?.fullName || apt.customerInfo?.name || "ลูกค้า"}
                                                    </div>
                                                    <div className="text-[11px] text-[#8d6e63] truncate">
                                                        {apt.serviceInfo?.name || "บริการสปา"}
                                                    </div>
                                                </div>

                                                {(apt as any).technicianInfo?.firstName && (
                                                    <div className="text-[10px] text-[#5d4037] pt-1 border-t border-[#e7e0da]/60 font-medium">
                                                        ช่าง: {(apt as any).technicianInfo.firstName} {(apt as any).technicianInfo?.lastName || ""}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Timeline View */
                <div className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs overflow-hidden space-y-3.5">
                    {/* Day Navigator */}
                    <div className="flex items-center justify-between pb-1">
                        <div>
                            <h2 className="text-base font-bold text-[#3e2723]">
                                {format(new Date(selectedDate), "EEEEที่ d MMMM yyyy", { locale: th })}
                            </h2>
                            <p className="text-[11px] text-[#8d6e63]">ตารางเวลาการปฏิบัติงานของช่างแต่ละท่าน</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleDayNav(-1)}
                                className="w-8 h-8 rounded-xl border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedDate(formatDateKey(new Date()))}
                                className="h-8 px-2.5 rounded-xl border border-[#d7ccc8] text-[11px] font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                            >
                                วันนี้
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDayNav(1)}
                                className="w-8 h-8 rounded-xl border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="min-w-max border border-[#e7e0da] rounded-xl overflow-hidden">
                            {/* Column Headers */}
                            <div className="flex border-b border-[#e7e0da] bg-[#f5f2ed]/80">
                                <div className="w-16 shrink-0 border-r border-[#e7e0da] p-2.5 text-xs font-bold text-[#8d6e63] text-center sticky left-0 z-20 bg-[#f5f2ed]">
                                    เวลา
                                </div>
                                {technicians.map((t: any) => (
                                    <div
                                        key={t.id}
                                        className="flex-1 min-w-[200px] border-r border-[#e7e0da] last:border-r-0 p-2.5 text-xs font-bold text-[#3e2723] text-center"
                                    >
                                        {t.name}
                                    </div>
                                ))}
                            </div>

                            {/* Timeline Body */}
                            <div className="relative flex">
                                {/* Time Labels */}
                                <div className="w-16 shrink-0 border-r border-[#e7e0da] sticky left-0 z-20 bg-white">
                                    {timeSlots.map((t) => (
                                        <div
                                            key={t}
                                            className="h-16 border-b border-[#e7e0da]/80 flex items-start justify-end pr-2 pt-1 text-[11px] text-[#8d6e63] font-mono tabular-nums"
                                        >
                                            {t}
                                        </div>
                                    ))}
                                </div>

                                {/* Tech Columns */}
                                {technicians.map((t: any) => (
                                    <div key={t.id} className="flex-1 min-w-[200px] border-r border-[#e7e0da] last:border-r-0 relative">
                                        {timeSlots.map((time) => (
                                            <div
                                                key={time}
                                                className="h-16 border-b border-[#e7e0da]/60 bg-white hover:bg-[#faf8f5] cursor-pointer transition-colors"
                                                onClick={() => handleSlotClick(t.id, time)}
                                                title={`จองคิว ${t.name} เวลา ${time}`}
                                            />
                                        ))}

                                        <div className="absolute inset-0 pointer-events-none">
                                            {appointmentsByTechnician[t.id]?.map((apt: any) => {
                                                const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.cancelled;
                                                const duration = apt.serviceInfo?.duration || apt.appointmentInfo?.duration || 60;
                                                const top = timeToPosition(apt.time || "09:00");
                                                const height = durationToHeight(duration);
                                                const col = apt._column || 0;
                                                const total = apt._totalColumns || 1;
                                                const w = 100 / total;

                                                return (
                                                    <a
                                                        key={apt.id}
                                                        href={`/appointments/${apt.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`absolute rounded-xl border p-2 pointer-events-auto cursor-pointer hover:shadow-md transition-shadow ${status.blockBg}`}
                                                        style={{
                                                            top: `${top}%`,
                                                            height: `${height}%`,
                                                            left: `${col * w}%`,
                                                            width: `${w - 1}%`,
                                                            minHeight: "42px",
                                                            zIndex: 10,
                                                        }}
                                                    >
                                                        <div className="text-[11px] font-bold tabular-nums leading-tight">
                                                            {apt.time || "--:--"} น.
                                                        </div>
                                                        <div className="text-xs truncate font-bold leading-tight">
                                                            {apt.customerInfo?.fullName || "ลูกค้า"}
                                                        </div>
                                                        <div className="text-[10px] text-[#5d4037] truncate mt-0.5">
                                                            {apt.serviceInfo?.name}
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
