"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, orderBy, onSnapshot } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { useRouter } from 'next/navigation';
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

const Icons = {
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Grid: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
};

function CancelModal({ appointment, onClose, onConfirm }: { appointment: Appointment, onClose: () => void, onConfirm: (id: string, reason: string) => Promise<void> }) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!reason.trim()) { alert('กรุณาระบุเหตุผล'); return; }
        setIsSubmitting(true);
        await onConfirm(appointment.id, reason);
        setIsSubmitting(false);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md border border-gray-300">
                <h2 className="text-base font-bold text-gray-900 mb-2">ยืนยันการยกเลิกนัดหมาย</h2>
                <p className="text-xs text-gray-600 mb-4">
                    ลูกค้า: <span className="font-semibold text-gray-900">{appointment.customerInfo.name || appointment.customerInfo.fullName}</span>
                </p>
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">เหตุผลการยกเลิก *</label>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                        placeholder="ระบุเหตุผลการยกเลิกเพื่อส่งการแจ้งเตือนให้ลูกค้า..."
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-semibold rounded-lg btn-secondary">ปิด</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-gray-400 rounded-lg transition-colors shadow-sm">
                        {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const STATUS_CONFIG: Record<string, { label: string, bg: string, text: string }> = {
    awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-[#fff9e6]', text: 'text-amber-700' },
    confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-[#eafaf1]', text: 'text-emerald-700' },
    in_progress: { label: 'กำลังบริการ', bg: 'bg-[#f3ebfa]', text: 'text-purple-700' },
    completed: { label: 'เสร็จสิ้น', bg: 'bg-gray-100', text: 'text-gray-750' },
    cancelled: { label: 'ยกเลิก', bg: 'bg-rose-50', text: 'text-rose-600' },
    pending: { label: 'จอง', bg: 'bg-gray-150', text: 'text-gray-650' },
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

const StatCard = ({ title, value, subValue, icon, className = '' }: any) => (
    <div className={`bg-white rounded-lg p-4 border border-gray-300 flex items-center justify-between ${className}`}>
        <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold text-gray-900 mt-1 leading-none">{value}</p>
            <p className="text-xs text-gray-400 mt-1.5">{subValue}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-900">
            {icon}
        </div>
    </div>
);

const AppointmentCard = ({ appointment, onCancelClick }: { appointment: Appointment, onCancelClick: (app: Appointment) => void }) => {
    const { profile } = useProfile();
    const router = useRouter();
    const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.cancelled;
    const date = appointment.parsedDate || parseAppointmentDate(appointment.appointmentInfo?.dateTime);
    const duration = (appointment.serviceInfo?.duration || 0) + (appointment.appointmentInfo?.addOns || []).reduce((s, a) => s + (a.duration || 0), 0);

    return (
        <div 
            onClick={() => router.push(`/appointments/${appointment.id}`)} 
            className="group bg-white border border-gray-300 hover:border-black rounded-lg p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between"
        >
            <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {appointment.customerInfo?.pictureUrl ? (
                            <img src={appointment.customerInfo.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-300" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-800 text-xs font-bold flex-shrink-0">
                                {(appointment.customerInfo?.name || appointment.customerInfo?.fullName || 'C').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate leading-snug">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</p>
                            <p className="text-xs text-gray-450 truncate mt-0.5">{appointment.customerInfo?.phone || '-'}</p>
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide flex-shrink-0 ${status.bg} ${status.text}`}>
                        {status.label}
                    </span>
                </div>

                {/* Service Details Box */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-300">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-1 leading-snug">{appointment.serviceInfo?.name}</p>
                    <div className="flex items-center justify-between text-xs text-gray-600 mt-2 font-medium">
                        <span className="flex items-center gap-1">
                            <Icons.Clock />
                            {duration} นาที
                        </span>
                        <span className="text-gray-900 font-bold">{(appointment.paymentInfo?.totalPrice || 0).toLocaleString()} {profile?.currencySymbol || '฿'}</span>
                    </div>
                </div>
            </div>

            {/* Date time footer */}
            <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-200 pt-2.5">
                <span className="flex items-center gap-1 font-medium text-gray-500">
                    <Icons.Calendar />
                    {date ? format(date, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'}
                </span>
                
                {['awaiting_confirmation', 'confirmed', 'pending'].includes(appointment.status) && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCancelClick(appointment);
                        }}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded transition-colors"
                    >
                        ยกเลิก
                    </button>
                )}
            </div>
        </div>
    );
};

export default function DashboardPage() {
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [viewMode, setViewMode] = useState('grid');
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
        const unsub = onSnapshot(q, snap => {
            const apps = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    parsedDate: parseAppointmentDate(data.appointmentInfo?.dateTime)
                } as Appointment;
            });
            setAllAppointments(apps);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const filteredAppointments = useMemo(() => {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));
        const search = filters.search.toLowerCase();
        return allAppointments.filter(app => {
            const date = app.parsedDate;
            if (!date || date < start || date > end) return false;

            const fullName = app.customerInfo?.fullName || app.customerInfo?.name || '';
            const phone = app.customerInfo?.phone || '';

            if (search && !fullName.toLowerCase().includes(search) && !phone.includes(search)) return false;
            return true;
        });
    }, [allAppointments, filters]);

    const stats = useMemo(() => {
        const today = new Date();
        const todayApps = allAppointments.filter(a => {
            const date = a.parsedDate;
            return date ? isSameDay(date, today) : false;
        });
        const pending = allAppointments.filter(a => a.status === 'awaiting_confirmation');
        const revenue = filteredAppointments.reduce((sum, a) => sum + (a.status !== 'cancelled' ? (a.paymentInfo?.totalPrice || 0) : 0), 0);
        return { todayCount: todayApps.length, pendingCount: pending.length, totalRevenue: revenue, totalFiltered: filteredAppointments.length };
    }, [allAppointments, filteredAppointments]);

    const tabAppointments = filteredAppointments.filter(a => {
        if (activeTab === 'all') return true;
        if (activeTab === 'upcoming') return ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status);
        return a.status === activeTab;
    });

    const totalPages = Math.ceil(tabAppointments.length / itemsPerPage);
    const currentItems = tabAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [activeTab, filters]);

    if (loading || profileLoading) return (
        <div className="flex justify-center items-center min-h-[400px]">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-4">
            {appointmentToCancel && (
                <CancelModal 
                    appointment={appointmentToCancel} 
                    onClose={() => setAppointmentToCancel(null)} 
                    onConfirm={async (id, reason) => {
                        const token = await auth.currentUser?.getIdToken();
                        if (!token) return;
                        const res = await cancelAppointmentByAdmin(id, reason, { adminToken: token });
                        if (res.success) {
                            setAppointmentToCancel(null);
                        } else {
                            alert(res.error);
                        }
                    }} 
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">ภาพรวมการนัดหมาย</h1>
                    <p className="text-xs text-gray-500 mt-0.5">แดชบอร์ดและจัดการสถานะการจอง</p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 border border-gray-300 rounded-lg p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:text-black'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-black text-white shadow-sm' : 'text-gray-600 hover:text-black'}`}><Icons.List /></button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard 
                    title="คิวจองวันนี้" 
                    value={`${stats.todayCount} รายการ`} 
                    subValue="เฉพาะจองของวันนี้" 
                    icon={<Icons.Calendar />}
                />
                <StatCard 
                    title="ต้องยืนยัน (Pending)" 
                    value={`${stats.pendingCount} รายการ`} 
                    subValue="รอดำเนินการอนุมัติคิว" 
                    icon={<div className="w-2 h-2 rounded-full bg-amber-400" />}
                />
                <StatCard 
                    title="รายได้ช่วงที่กรอง" 
                    value={`${stats.totalRevenue.toLocaleString()} ${profile?.currencySymbol || '฿'}`} 
                    subValue="ไม่นับคิวที่ยกเลิก" 
                    icon={<span className="text-xs font-bold">$</span>}
                />
                <StatCard 
                    title="จองทั้งหมดช่วงที่เลือก" 
                    value={`${stats.totalFiltered} รายการ`} 
                    subValue="ตามช่วงเวลาตัวกรอง" 
                    icon={<div className="w-2 h-2 rounded-full bg-emerald-400" />}
                />
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Tabs / Filter Status */}
                    <div className="flex flex-wrap gap-1">
                        {TABS.map(tab => {
                            const isTabActive = activeTab === tab.key;
                            const count = tab.key === 'all' 
                                ? filteredAppointments.length 
                                : tab.key === 'upcoming' 
                                    ? filteredAppointments.filter(a => ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'].includes(a.status)).length 
                                    : filteredAppointments.filter(a => a.status === tab.key).length;

                            return (
                                <button 
                                    key={tab.key} 
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors
                                        ${isTabActive 
                                            ? 'btn-primary' 
                                            : 'bg-gray-50 border border-gray-300 text-gray-650 hover:bg-gray-100'
                                        }`}
                                >
                                    {tab.label}
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isTabActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right filters Inputs */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-700 font-medium">
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="bg-transparent outline-none w-28 text-gray-800" />
                            <span className="text-gray-300 px-1">|</span>
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="bg-transparent outline-none w-28 text-gray-800" />
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                name="search" 
                                placeholder="ค้นหาลูกค้า/เบอร์..." 
                                value={filters.search} 
                                onChange={handleFilterChange}
                                className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-sm text-gray-855 focus:outline-none focus:ring-1 focus:ring-black focus:border-black placeholder-gray-400" 
                            />
                            <div className="absolute left-2.5 top-2.5 text-gray-400">
                                <Icons.Search />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List/Grid Content */}
            {currentItems.length > 0 ? (
                <>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {currentItems.map(app => <AppointmentCard key={app.id} appointment={app} onCancelClick={setAppointmentToCancel} />)}
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ลูกค้า</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">บริการ</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">วันที่จอง</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">ราคา</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">สถานะ</th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {currentItems.map(app => {
                                            const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.cancelled;
                                            const date = app.parsedDate;
                                            return (
                                                <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            {app.customerInfo?.pictureUrl ? (
                                                                <img src={app.customerInfo.pictureUrl} alt="Customer" className="w-8 h-8 rounded-full object-cover border border-gray-300" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-800 font-bold text-xs">
                                                                    {(app.customerInfo?.name || app.customerInfo?.fullName || 'C').charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div className="text-sm font-semibold text-gray-800">{app.customerInfo?.fullName || app.customerInfo?.name}</div>
                                                                <div className="text-xs text-gray-400 mt-0.5">{app.customerInfo?.phone || '-'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{app.serviceInfo?.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {date ? format(date, 'd MMM HH:mm น.', { locale: th }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{(app.paymentInfo?.totalPrice || 0).toLocaleString()} {profile?.currencySymbol || '฿'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button onClick={() => router.push(`/appointments/${app.id}`)} className="text-gray-900 hover:underline">ดูรายละเอียด</button>
                                                            {['awaiting_confirmation', 'confirmed', 'pending'].includes(app.status) && (
                                                                <button onClick={() => setAppointmentToCancel(app)} className="text-rose-600 hover:text-rose-800">ยกเลิก</button>
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
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-8">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"><Icons.ChevronLeft /></button>
                            <span className="text-xs font-semibold text-gray-600">หน้า {currentPage} / {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"><Icons.ChevronRight /></button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-16 bg-white border border-gray-300 rounded-lg shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-500 border border-gray-300">
                        <Icons.Search />
                    </div>
                    <p className="text-base font-semibold text-gray-800">ไม่พบรายการนัดหมาย</p>
                    <p className="text-sm text-gray-400 mt-0.5">ลองเปลี่ยนตัวกรองหรือคำค้นหาใหม่</p>
                </div>
            )}
        </div>
    );
}
