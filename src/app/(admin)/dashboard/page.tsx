"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, collection, query, orderBy, onSnapshot } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { cancelAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { format, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

interface Appointment {
    id: string;
    status: string;
    customerInfo: {
        pictureUrl?: string;
        fullName?: string;
        name?: string;
        phone?: string;
    };
    appointmentInfo: {
        dateTime: any;
        addOns?: { duration: number }[];
    };
    serviceInfo: {
        name: string;
        duration: number;
    };
    paymentInfo: {
        totalPrice: number;
    };
    parsedDate?: Date;
}

const parseAppointmentDate = (dateInfo: any): Date | null => {
    if (!dateInfo) return null;
    if (typeof dateInfo.toDate === 'function') return dateInfo.toDate();
    if (dateInfo instanceof Date) return dateInfo;
    if (typeof dateInfo === 'string') return new Date(dateInfo);
    if (dateInfo.seconds) return new Date(dateInfo.seconds * 1000);
    return null;
};

// --- Standardized Status Config ---
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

const TABS = [
    { key: 'upcoming', label: 'กำลังดำเนินการ' },
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { key: 'confirmed', label: 'ยืนยันแล้ว' },
    { key: 'in_progress', label: 'กำลังบริการ' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

// --- Cancel Modal Component ---
function CancelModal({
    appointment,
    onClose,
    onConfirm
}: {
    appointment: Appointment;
    onClose: () => void;
    onConfirm: (id: string, reason: string) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('กรุณาระบุเหตุผลในการยกเลิก');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await onConfirm(appointment.id, reason);
            onClose();
        } catch (err: any) {
            setError(err?.message || 'เกิดข้อผิดพลาดในการยกเลิก');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in-50">
            <div className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md border border-[#d7ccc8]/70 shadow-2xl space-y-5">
                <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#3e2723]">ยืนยันการยกเลิกนัดหมาย</h2>
                        <p className="text-xs text-[#8d6e63] mt-0.5">การกระทำนี้จะส่งการแจ้งเตือนยกเลิกไปยังลูกค้าผ่านระบบ LINE</p>
                    </div>
                </div>

                <div className="bg-[#faf8f5] rounded-xl p-3.5 border border-[#e7e0da] space-y-1.5 text-xs">
                    <div className="flex justify-between">
                        <span className="text-[#8d6e63]">ลูกค้า:</span>
                        <span className="font-semibold text-[#3e2723]">{appointment.customerInfo?.fullName || appointment.customerInfo?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#8d6e63]">บริการ:</span>
                        <span className="font-semibold text-[#3e2723]">{appointment.serviceInfo?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-[#8d6e63]">รหัสอ้างอิง:</span>
                        <span className="font-mono text-[#5d4037]">{appointment.id}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#3e2723] uppercase tracking-wide">
                            เหตุผลการยกเลิก <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            rows={3}
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                if (error) setError('');
                            }}
                            className="w-full p-3 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] outline-none text-[#3e2723] resize-none font-medium placeholder:text-[#a1887f]"
                            placeholder="ระบุเหตุผล เช่น ช่างไม่สะดวกกะทันหัน, ลูกค้าแจ้งขอเลื่อน..."
                        />
                        {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 h-9.5 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 h-9.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>กำลังยกเลิก...</span>
                                </>
                            ) : (
                                <span>ยืนยันยกเลิกนัดหมาย</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const { profile, loading: profileLoading } = useProfile();
    const router = useRouter();

    const [filters, setFilters] = useState({
        startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
        endDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), 'yyyy-MM-dd'),
        search: '',
    });

    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('appointmentInfo.dateTime', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const apps = snap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    parsedDate: parseAppointmentDate(
                        data.appointmentInfo?.dateTime ||
                        (data.date && data.time ? `${data.date}T${data.time}` : data.date) ||
                        data.createdAt
                    ),
                } as Appointment;
            });
            setAllAppointments(apps);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleResetFilters = () => {
        setFilters({
            startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'),
            endDate: format(new Date(new Date().setDate(new Date().getDate() + 30)), 'yyyy-MM-dd'),
            search: '',
        });
        setActiveTab('upcoming');
    };

    const filteredAppointments = useMemo(() => {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));
        const search = filters.search.trim().toLowerCase();

        return allAppointments.filter((app) => {
            const date = app.parsedDate;
            if (!date || date < start || date > end) return false;

            if (search) {
                const fullName = (app.customerInfo?.fullName || app.customerInfo?.name || '').toLowerCase();
                const phone = (app.customerInfo?.phone || '').toLowerCase();
                const service = (app.serviceInfo?.name || '').toLowerCase();
                const id = app.id.toLowerCase();
                if (!fullName.includes(search) && !phone.includes(search) && !service.includes(search) && !id.includes(search)) {
                    return false;
                }
            }
            return true;
        });
    }, [allAppointments, filters]);

    const stats = useMemo(() => {
        const today = new Date();
        const todayApps = allAppointments.filter((a) => {
            const date = a.parsedDate;
            return date ? isSameDay(date, today) : false;
        });
        const pending = allAppointments.filter((a) => a.status === 'awaiting_confirmation' || a.status === 'pending');
        const revenue = filteredAppointments.reduce(
            (sum, a) => sum + (a.status !== 'cancelled' ? (a.paymentInfo?.totalPrice || 0) : 0),
            0
        );
        return {
            todayCount: todayApps.length,
            pendingCount: pending.length,
            totalRevenue: revenue,
            totalFiltered: filteredAppointments.length,
        };
    }, [allAppointments, filteredAppointments]);

    const tabAppointments = useMemo(() => {
        return filteredAppointments.filter((a) => {
            if (activeTab === 'all') return true;
            if (activeTab === 'upcoming') {
                return ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status);
            }
            if (activeTab === 'awaiting_confirmation') {
                return a.status === 'awaiting_confirmation' || a.status === 'pending';
            }
            return a.status === activeTab;
        });
    }, [filteredAppointments, activeTab]);

    const totalPages = Math.ceil(tabAppointments.length / itemsPerPage);
    const currentItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return tabAppointments.slice(start, start + itemsPerPage);
    }, [tabAppointments, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, filters]);

    if (loading || profileLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลแดชบอร์ด...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Cancellation Modal */}
            {appointmentToCancel && (
                <CancelModal
                    appointment={appointmentToCancel}
                    onClose={() => setAppointmentToCancel(null)}
                    onConfirm={async (id, reason) => {
                        const token = await auth.currentUser?.getIdToken();
                        if (!token) return;
                        const res = await cancelAppointmentByAdmin(id, reason, { adminToken: token });
                        if (!res.success) {
                            throw new Error(res.error || 'ไม่สามารถยกเลิกรายการได้');
                        }
                        setAppointmentToCancel(null);
                    }}
                />
            )}

            {/* 1. Frameless Clean Operations Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723] tracking-tight">
                            ภาพรวมการนัดหมาย
                        </h1>
                        <span className="text-[11px] font-semibold text-[#5d4037] bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#d7ccc8]/70">
                            {storeNameFallback(profile?.storeName)}
                        </span>
                    </div>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        ศูนย์ติดตามสถานะคิวบริการ อนุมัติการจอง และจัดการคิวลูกค้าแบบเรียลไทม์
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* View Switcher */}
                    <div className="inline-flex p-1 bg-white rounded-xl border border-[#d7ccc8] gap-1 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-[#5d4037] text-white shadow-2xs'
                                    : 'text-[#5d4037] hover:text-[#3e2723]'
                            }`}
                            title="มุมมองตาราง"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span>ตาราง</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-[#5d4037] text-white shadow-2xs'
                                    : 'text-[#5d4037] hover:text-[#3e2723]'
                            }`}
                            title="มุมมองการ์ด"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span>การ์ด</span>
                        </button>
                    </div>

                    {/* Create Button */}
                    <Link
                        href="/create-appointment"
                        className="h-9 px-3.5 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                        <span>+ นัดหมายใหม่</span>
                    </Link>
                </div>
            </div>

            {/* 2. Zero-Noise Unified Metric Bar */}
            <div className="bg-white rounded-2xl border border-[#e7e0da] shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-[#e7e0da] grid grid-cols-2 lg:grid-cols-4">
                {/* Metric 1: Today */}
                <div className="px-5 py-3.5 sm:py-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
                        <span>คิวบริการวันนี้</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
                        {stats.todayCount}{' '}
                        <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
                    </div>
                </div>

                {/* Metric 2: Pending */}
                <div className="px-5 py-3.5 sm:py-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
                        <span>รอยืนยันอนุมัติ</span>
                        {stats.pendingCount > 0 ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">ด่วน</span>
                        ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                        )}
                    </div>
                    <div className={`mt-2 text-2xl font-extrabold tabular-nums tracking-tight ${stats.pendingCount > 0 ? 'text-amber-800' : 'text-[#3e2723]'}`}>
                        {stats.pendingCount}{' '}
                        <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
                    </div>
                </div>

                {/* Metric 3: Revenue */}
                <div className="px-5 py-3.5 sm:py-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
                        <span>ยอดรวมช่วงนี้</span>
                        <span className="text-[10px] font-mono text-[#5d4037] font-bold">THB</span>
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight truncate">
                        {stats.totalRevenue.toLocaleString()}{' '}
                        <span className="text-xs font-bold text-[#5d4037]">บาท</span>
                    </div>
                </div>

                {/* Metric 4: Total */}
                <div className="px-5 py-3.5 sm:py-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
                        <span>คิวทั้งหมด</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5d4037]" />
                    </div>
                    <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
                        {stats.totalFiltered}{' '}
                        <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
                    </div>
                </div>
            </div>

            {/* 3. Operational Filter Matrix */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                {/* Status Tabs Row */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                    <div className="flex items-center gap-1.5 shrink-0">
                        {TABS.map((tab) => {
                            const isTabActive = activeTab === tab.key;
                            const count =
                                tab.key === 'all'
                                    ? filteredAppointments.length
                                    : tab.key === 'upcoming'
                                    ? filteredAppointments.filter((a) =>
                                          ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status)
                                      ).length
                                    : filteredAppointments.filter((a) => a.status === tab.key).length;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                        isTabActive
                                            ? 'bg-[#5d4037] text-white shadow-xs'
                                            : 'bg-[#faf8f5] text-[#5d4037] border border-[#e7e0da] hover:bg-[#f5f2ed]'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold tabular-nums ${
                                            isTabActive
                                                ? 'bg-white/20 text-white'
                                                : 'bg-[#e7e0da] text-[#5d4037]'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Date range & Search Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2.5 border-t border-[#e7e0da]">
                    {/* Search */}
                    <div className="md:col-span-5 relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8d6e63]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="ค้นหาลูกค้า, เบอร์โทร, ชื่อบริการ หรือรหัสคิว..."
                            className="w-full h-10 pl-9.5 pr-3.5 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] outline-none text-[#3e2723] placeholder:text-[#a1887f] font-medium"
                        />
                    </div>

                    {/* Date Pickers */}
                    <div className="md:col-span-5 flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="date"
                                name="startDate"
                                value={filters.startDate}
                                onChange={handleFilterChange}
                                className="w-full h-10 px-3 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] font-medium"
                            />
                        </div>
                        <span className="text-[#8d6e63] text-xs font-bold">ถึง</span>
                        <div className="flex-1 relative">
                            <input
                                type="date"
                                name="endDate"
                                value={filters.endDate}
                                onChange={handleFilterChange}
                                className="w-full h-10 px-3 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] font-medium"
                            />
                        </div>
                    </div>

                    {/* Clear Button */}
                    <div className="md:col-span-2 flex items-center">
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="w-full h-10 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors flex items-center justify-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>ล้างตัวกรอง</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Appointments Content */}
            {currentItems.length > 0 ? (
                <>
                    {viewMode === 'table' ? (
                        /* High-Density Data Table View */
                        <div className="bg-white rounded-2xl border border-[#e7e0da] overflow-hidden shadow-2xs">
                            <div className="p-4 border-b border-[#e7e0da] bg-[#faf8f5] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-[#3e2723] uppercase tracking-wide">
                                        ตารางรายการนัดหมาย
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f5f2ed] text-[#5d4037] border border-[#d7ccc8]">
                                        {tabAppointments.length} รายการ
                                    </span>
                                </div>
                                <span className="text-[11px] text-[#8d6e63]">
                                    แสดงหน้า {currentPage} จาก {totalPages || 1}
                                </span>
                            </div>

                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#f5f2ed]/80 text-[#3e2723] font-semibold text-xs border-b border-[#e7e0da]">
                                        <tr>
                                            <th className="px-3.5 py-3 border-r border-[#e7e0da] w-12 text-center">#</th>
                                            <th className="px-4 py-3 border-r border-[#e7e0da]">ลูกค้า</th>
                                            <th className="px-4 py-3 border-r border-[#e7e0da]">บริการ & ระยะเวลา</th>
                                            <th className="px-4 py-3 border-r border-[#e7e0da]">วันและเวลาที่นัด</th>
                                            <th className="px-4 py-3 border-r border-[#e7e0da] text-right">ยอดรวม</th>
                                            <th className="px-4 py-3 border-r border-[#e7e0da] text-center">สถานะ</th>
                                            <th className="px-4 py-3 text-right w-32">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e7e0da] text-xs">
                                        {currentItems.map((app, index) => {
                                            const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.cancelled;
                                            const date = app.parsedDate;
                                            const duration =
                                                (app.serviceInfo?.duration || 0) +
                                                (app.appointmentInfo?.addOns || []).reduce(
                                                    (sum, a) => sum + (a.duration || 0),
                                                    0
                                                );

                                            return (
                                                <tr
                                                    key={app.id}
                                                    onClick={() => router.push(`/appointments/${app.id}`)}
                                                    className="hover:bg-[#faf8f5] transition-colors cursor-pointer group"
                                                >
                                                    {/* Row Index */}
                                                    <td className="px-3.5 py-3 border-r border-[#e7e0da] text-center text-[#8d6e63] font-mono tabular-nums">
                                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                                    </td>

                                                    {/* Customer Profile */}
                                                    <td className="px-4 py-3 border-r border-[#e7e0da]">
                                                        <div className="flex items-center gap-2.5">
                                                            {app.customerInfo?.pictureUrl ? (
                                                                <img
                                                                    src={app.customerInfo.pictureUrl}
                                                                    alt=""
                                                                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#d7ccc8]"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-[#f5f2ed] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-bold text-xs shrink-0">
                                                                    {(
                                                                        app.customerInfo?.fullName ||
                                                                        app.customerInfo?.name ||
                                                                        'C'
                                                                    )
                                                                        .charAt(0)
                                                                        .toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-[#3e2723] group-hover:text-[#5d4037] transition-colors truncate">
                                                                    {app.customerInfo?.fullName ||
                                                                        app.customerInfo?.name ||
                                                                        'ลูกค้าไม่ระบุชื่อ'}
                                                                </div>
                                                                <div className="text-[11px] text-[#8d6e63] font-mono">
                                                                    {app.customerInfo?.phone || '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Service & Duration */}
                                                    <td className="px-4 py-3 border-r border-[#e7e0da]">
                                                        <div className="font-semibold text-[#3e2723] truncate">
                                                            {app.serviceInfo?.name || '-'}
                                                        </div>
                                                        <div className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-[#8d6e63]">
                                                            <svg className="w-3 h-3 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            <span>{duration} นาที</span>
                                                        </div>
                                                    </td>

                                                    {/* Date & Time */}
                                                    <td className="px-4 py-3 border-r border-[#e7e0da] tabular-nums">
                                                        <div className="font-semibold text-[#3e2723]">
                                                            {date ? format(date, 'd MMM yyyy', { locale: th }) : '-'}
                                                        </div>
                                                        <div className="text-[11px] text-[#5d4037] font-medium">
                                                            {date ? format(date, 'HH:mm น.', { locale: th }) : '-'}
                                                        </div>
                                                    </td>

                                                    {/* Total Price */}
                                                    <td className="px-4 py-3 border-r border-[#e7e0da] text-right tabular-nums">
                                                        <span className="font-extrabold text-[#3e2723]">
                                                            {(app.paymentInfo?.totalPrice || 0).toLocaleString()}
                                                        </span>{' '}
                                                        <span className="text-[11px] font-semibold text-[#5d4037]">บาท</span>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-4 py-3 border-r border-[#e7e0da] text-center">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${status.badgeClass}`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                                                            <span>{status.label}</span>
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    router.push(`/appointments/${app.id}`);
                                                                }}
                                                                className="px-2.5 py-1 text-xs font-bold text-[#5d4037] bg-[#f5f2ed] hover:bg-[#ebdccc] border border-[#d7ccc8] rounded-lg transition-colors"
                                                            >
                                                                ดูข้อมูล
                                                            </button>
                                                            {['awaiting_confirmation', 'confirmed', 'pending'].includes(
                                                                app.status
                                                            ) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAppointmentToCancel(app);
                                                                    }}
                                                                    className="px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                                                >
                                                                    ยกเลิก
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* Luxury Card Grid View */
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {currentItems.map((app) => {
                                const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.cancelled;
                                const date = app.parsedDate;
                                const duration =
                                    (app.serviceInfo?.duration || 0) +
                                    (app.appointmentInfo?.addOns || []).reduce((sum, a) => sum + (a.duration || 0), 0);

                                return (
                                    <div
                                        key={app.id}
                                        onClick={() => router.push(`/appointments/${app.id}`)}
                                        className="bg-white rounded-2xl p-4 border border-[#e7e0da] hover:border-[#5d4037] shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                                    >
                                        <div className="space-y-3">
                                            {/* Card Top: Customer & Status */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {app.customerInfo?.pictureUrl ? (
                                                        <img
                                                            src={app.customerInfo.pictureUrl}
                                                            alt=""
                                                            className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#d7ccc8]"
                                                        />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-[#f5f2ed] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-bold text-xs shrink-0">
                                                            {(
                                                                app.customerInfo?.fullName ||
                                                                app.customerInfo?.name ||
                                                                'C'
                                                            )
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-xs sm:text-sm font-bold text-[#3e2723] group-hover:text-[#5d4037] transition-colors truncate leading-tight">
                                                            {app.customerInfo?.fullName ||
                                                                app.customerInfo?.name ||
                                                                'ลูกค้าไม่ระบุชื่อ'}
                                                        </p>
                                                        <p className="text-[11px] text-[#8d6e63] font-mono mt-0.5 truncate">
                                                            {app.customerInfo?.phone || '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${status.badgeClass}`}
                                                >
                                                    <span className={`w-1 h-1 rounded-full ${status.dotClass}`} />
                                                    <span>{status.label}</span>
                                                </span>
                                            </div>

                                            {/* Service Details Sub-box */}
                                            <div className="bg-[#faf8f5] rounded-xl p-3 border border-[#e7e0da] space-y-2">
                                                <div className="font-semibold text-xs text-[#3e2723] line-clamp-1">
                                                    {app.serviceInfo?.name || '-'}
                                                </div>
                                                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e7e0da]/60">
                                                    <span className="text-[11px] text-[#8d6e63] flex items-center gap-1">
                                                        <svg className="w-3 h-3 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>{duration} นาที</span>
                                                    </span>
                                                    <span className="font-extrabold text-[#3e2723] tabular-nums">
                                                        {(app.paymentInfo?.totalPrice || 0).toLocaleString()}{' '}
                                                        <span className="text-[10px] font-bold text-[#5d4037]">บาท</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Footer: Date & Cancel Action */}
                                        <div className="pt-2 border-t border-[#e7e0da] flex items-center justify-between text-xs">
                                            <span className="text-[11px] text-[#5d4037] font-medium tabular-nums flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5 text-[#8d6e63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span>
                                                    {date ? format(date, 'd MMM, HH:mm น.', { locale: th }) : '-'}
                                                </span>
                                            </span>

                                            {['awaiting_confirmation', 'confirmed', 'pending'].includes(app.status) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAppointmentToCancel(app);
                                                    }}
                                                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 transition-colors"
                                                >
                                                    ยกเลิก
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-9 px-3.5 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] bg-white hover:bg-[#f5f2ed] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                ← ก่อนหน้า
                            </button>
                            <span className="text-xs font-semibold text-[#5d4037] tabular-nums">
                                หน้า {currentPage} จาก {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-9 px-3.5 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] bg-white hover:bg-[#f5f2ed] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                ถัดไป →
                            </button>
                        </div>
                    )}
                </>
            ) : (
                /* Clean Empty State */
                <div className="text-center py-16 bg-white border border-[#e7e0da] rounded-2xl shadow-2xs space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] flex items-center justify-center mx-auto text-xl shadow-2xs">
                        📋
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#3e2723]">ไม่พบรายการนัดหมายตามเงื่อนไข</h3>
                        <p className="text-xs text-[#8d6e63] mt-0.5">
                            ลองปรับช่วงเวลาตัวกรอง หรือค้นหาด้วยคำสำคัญใหม่อีกครั้ง
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white shadow-xs transition-colors"
                    >
                        รีเซ็ตตัวกรองทั้งหมด
                    </button>
                </div>
            )}
        </div>
    );
}

function storeNameFallback(name?: string) {
    return name && name.trim().length > 0 ? name : 'SPA & WELLNESS';
}
