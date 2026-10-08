"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy } from '@/app/lib/supabaseDb';
import {
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subDays, differenceInDays, isSameDay } from 'date-fns';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
    TrendingUp: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TrendingDown: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    Calendar: () => <svg className="w-4 h-4 text-[#8d6e63]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Download: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Dollar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    CheckCircle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Star: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Gift: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>,
};

// --- Custom Recharts Tooltip ---
const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl border border-[#e7e0da] shadow-lg text-xs space-y-1.5">
                <p className="font-bold text-[#3e2723] border-b border-[#f0eae4] pb-1">{label}</p>
                {payload.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-stone-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                            {item.name}:
                        </span>
                        <span className="font-bold text-[#3e2723] font-mono tabular-nums">
                            {Number(item.value).toLocaleString()} บาท
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function AnalyticsPage() {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [reviews, setReviews] = useState<any[]>([]);
    const [rewards, setRewards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [appSnap, revSnap, rewSnap] = await Promise.all([
                    getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc'))),
                    getDocs(query(collection(db, 'reviews'))),
                    getDocs(query(collection(db, 'rewards')))
                ]);
                setAppointments(appSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setReviews(revSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setRewards(rewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching analytics data: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analytics = useMemo(() => {
        if (loading) return null;

        const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
        const prevStart = subDays(dateRange.start, daysDiff);
        const prevEnd = subDays(dateRange.end, daysDiff);

        const filterByDate = (data: any[], start: Date, end: Date) => data.filter(item => {
            const d = item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt));
            return d >= start && d <= end;
        });

        const currentApps = filterByDate(appointments, dateRange.start, dateRange.end);
        const prevApps = filterByDate(appointments, prevStart, prevEnd);

        const calcRevenue = (apps: any[]) => apps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || Number(a.paymentInfo?.amountPaid) || 0), 0);

        const currentRevenue = calcRevenue(currentApps);
        const prevRevenue = calcRevenue(prevApps);
        const revenueGrowth = prevRevenue ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const currentCompleted = currentApps.filter(a => a.status === 'completed').length;
        const prevCompleted = prevApps.filter(a => a.status === 'completed').length;
        const completedGrowth = prevCompleted ? ((currentCompleted - prevCompleted) / prevCompleted) * 100 : 0;

        const dailyData = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(day => {
            const dayApps = currentApps.filter(a => isSameDay(a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)), day));
            const revenue = dayApps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || Number(a.paymentInfo?.amountPaid) || 0), 0);
            const discount = dayApps.filter(a => a.status === 'completed').reduce((sum, a) => sum + (Number(a.paymentInfo?.discount) || 0), 0);
            return { date: format(day, 'dd/MM'), revenue, discount, completed: dayApps.filter(a => a.status === 'completed').length };
        });

        const serviceStats: any = {};
        currentApps.filter(a => a.status === 'completed').forEach(a => {
            const name = a.serviceInfo?.name || a.serviceName || 'ไม่ระบุชื่อบริการ';
            if (!serviceStats[name]) serviceStats[name] = { count: 0, revenue: 0 };
            serviceStats[name].count++;
            serviceStats[name].revenue += (Number(a.paymentInfo?.totalPrice) || 0);
        });
        const topServices = Object.entries(serviceStats).map(([name, stats]: [string, any]) => ({ name, ...stats })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

        const techStats: any = {};
        currentApps.filter(a => a.status === 'completed').forEach(a => {
            let name = 'ไม่ระบุช่าง';
            if (a.technicianId && a.technicianId !== 'auto-assign') {
                name = a.technicianInfo?.firstName ? `${a.technicianInfo.firstName} ${a.technicianInfo.lastName || ''}`.trim() : 'ไม่ระบุช่าง';
            }
            if (!techStats[name]) techStats[name] = 0;
            techStats[name]++;
        });
        const topTechnicians = Object.entries(techStats).map(([name, count]: [string, any]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

        const currentReviews = filterByDate(reviews, dateRange.start, dateRange.end);
        const avgRating = currentReviews.length ? (currentReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / currentReviews.length).toFixed(1) : '5.0';

        const totalRedeemed = rewards.reduce((sum, r) => sum + (r.redeemedCount || 0), 0);
        const rewardDiscountStats: any = {};
        currentApps.forEach(app => {
            if (app.status === 'completed' && app.paymentInfo?.couponName && app.paymentInfo?.discount) {
                const name = app.paymentInfo.couponName;
                if (!rewardDiscountStats[name]) rewardDiscountStats[name] = 0;
                rewardDiscountStats[name] += (Number(app.paymentInfo.discount) || 0);
            }
        });
        const topRewards = rewards.map(r => ({ ...r, count: r.redeemedCount || 0, totalDiscounted: rewardDiscountStats[r.name] || 0 })).sort((a, b) => b.count - a.count).slice(0, 5);

        return {
            totalRevenue: currentRevenue,
            revenueGrowth: Math.round(revenueGrowth),
            totalAppointments: currentApps.length,
            completedAppointments: currentCompleted,
            completedGrowth: Math.round(completedGrowth),
            avgRating,
            reviewCount: currentReviews.length,
            dailyData,
            topServices,
            topTechnicians,
            totalRedeemed,
            topRewards
        };
    }, [loading, appointments, reviews, rewards, dateRange]);

    const exportToCSV = () => {
        if (!analytics) return;
        const headers = ['Date', 'Service', 'Customer', 'Technician', 'Price', 'Status'];
        const rows = appointments.filter(a => {
            const d = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt));
            return d >= dateRange.start && d <= dateRange.end;
        }).map(a => [
            format(a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt)), 'yyyy-MM-dd HH:mm'),
            `"${a.serviceInfo?.name || a.serviceName || ''}"`,
            `"${a.customerInfo?.fullName || a.customerInfo?.name || ''}"`,
            `"${a.technicianInfo?.firstName || ''} ${a.technicianInfo?.lastName || ''}"`,
            a.paymentInfo?.totalPrice || 0,
            a.status
        ].join(','));
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `spa_analytics_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        link.click();
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (value) setDateRange(prev => ({ ...prev, [name]: parseISO(value) }));
    };

    if (loading || profileLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลวิเคราะห์สถิติ...</p>
            </div>
        );
    }

    if (!analytics) return null;

    const PIE_COLORS = ['#5d4037', '#795548', '#8d6e63', '#a1887f', '#bcaaa4'];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* 1. Frameless Operations Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>รายงานและวิเคราะห์</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">รายงานสถิติและผลประกอบการ</h1>
                </div>

                {/* Date Controls & Export */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-[#d7ccc8] rounded-xl px-3 py-1.5 shadow-2xs">
                        <Icons.Calendar />
                        <input
                            type="date"
                            name="start"
                            value={format(dateRange.start, 'yyyy-MM-dd')}
                            onChange={handleDateChange}
                            className="text-xs bg-transparent border-none text-[#3e2723] font-mono focus:outline-none"
                        />
                        <span className="text-stone-400 text-xs">-</span>
                        <input
                            type="date"
                            name="end"
                            value={format(dateRange.end, 'yyyy-MM-dd')}
                            onChange={handleDateChange}
                            className="text-xs bg-transparent border-none text-[#3e2723] font-mono focus:outline-none"
                        />
                    </div>

                    <button
                        onClick={exportToCSV}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all"
                    >
                        <Icons.Download />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* 2. Zero-Noise Unified Metric Bar (UI_DESIGN_SYSTEM Rule 5.1.1) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-white border border-[#e7e0da] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#f0eae4] shadow-sm">
                {/* Metric 1: Revenue */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">รายได้รวม</div>
                    <div className="my-1">
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums">
                            {analytics.totalRevenue.toLocaleString()} <span className="text-xs font-normal text-stone-500">บาท</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                        <span className={`inline-flex items-center font-semibold ${analytics.revenueGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {analytics.revenueGrowth >= 0 ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                            <span className="ml-0.5 tabular-nums">{Math.abs(analytics.revenueGrowth)}%</span>
                        </span>
                        <span className="text-stone-400">vs รอบก่อน</span>
                    </div>
                </div>

                {/* Metric 2: Completed Bookings */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">บริการที่สำเร็จ</div>
                    <div className="my-1">
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
                            {analytics.completedAppointments.toLocaleString()} <span className="text-xs font-normal text-stone-500">งาน</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                        <span className={`inline-flex items-center font-semibold ${analytics.completedGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {analytics.completedGrowth >= 0 ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                            <span className="ml-0.5 tabular-nums">{Math.abs(analytics.completedGrowth)}%</span>
                        </span>
                        <span className="text-stone-400">vs รอบก่อน</span>
                    </div>
                </div>

                {/* Metric 3: Total Bookings */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">นัดหมายทั้งหมด</div>
                    <div className="my-1">
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums">
                            {analytics.totalAppointments.toLocaleString()} <span className="text-xs font-normal text-stone-500">คิว</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-stone-400">รวมทุกสถานะบริการ</div>
                </div>

                {/* Metric 4: Satisfaction */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ความพึงพอใจ</div>
                    <div className="my-1 flex items-baseline gap-1.5">
                        <div className="text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">
                            {analytics.avgRating}
                        </div>
                        <span className="text-xs font-medium text-amber-600">/ 5.0</span>
                    </div>
                    <div className="text-[11px] text-stone-400 tabular-nums">{analytics.reviewCount} รีวิวจากลูกค้า</div>
                </div>

                {/* Metric 5: Rewards Redeemed */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">แลกคูปองสะสม</div>
                    <div className="my-1">
                        <div className="text-xl sm:text-2xl font-bold text-[#5d4037] tabular-nums">
                            {(analytics.totalRedeemed || 0).toLocaleString()} <span className="text-xs font-normal text-stone-500">ครั้ง</span>
                        </div>
                    </div>
                    <div className="text-[11px] text-stone-400">สิทธิพิเศษที่นำไปใช้</div>
                </div>
            </div>

            {/* 3. Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Line Chart */}
                <div className="lg:col-span-2 bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-[#3e2723]">แนวโน้มรายได้และส่วนลดโปรโมชั่น</h3>
                            <p className="text-xs text-stone-500 mt-0.5">เปรียบเทียบยอดขายสุทธิและส่วนลดที่ให้ลูกค้าในแต่ละวัน</p>
                        </div>
                    </div>
                    <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0eae4" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8d6e63', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8d6e63', fontSize: 11 }} />
                                <RechartsTooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                                <Line type="monotone" dataKey="revenue" name="รายได้สุทธิ" stroke="#5d4037" strokeWidth={2.5} dot={{ r: 2.5, fill: '#5d4037' }} activeDot={{ r: 5 }} />
                                <Line type="monotone" dataKey="discount" name="ส่วนลดโปรโมชั่น" stroke="#c27848" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart: Service Distribution */}
                <div className="bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-[#3e2723]">สัดส่วนยอดขายตามบริการ</h3>
                        <p className="text-xs text-stone-500 mt-0.5">5 รายการบริการที่ทำรายได้สูงสุด</p>
                    </div>

                    <div className="w-full h-[220px] my-auto">
                        {analytics.topServices.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.topServices}
                                        dataKey="revenue"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={75}
                                        paddingAngle={3}
                                    >
                                        {analytics.topServices.map((_: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-xs text-stone-400">
                                ไม่มีข้อมูลบริการในช่วงเวลานี้
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#f0eae4]">
                        {analytics.topServices.slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 text-stone-600 truncate max-w-[140px]">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i] }}></span>
                                    {item.name}
                                </span>
                                <span className="font-semibold text-[#3e2723] font-mono tabular-nums">
                                    {Number(item.revenue).toLocaleString()} บาท
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Detailed Ranking Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Technicians */}
                <div className="bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-3">ช่างผู้ให้บริการยอดนิยม</h3>
                    <div className="space-y-2">
                        {analytics.topTechnicians.map((tech: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-[#faf8f5] rounded-lg border border-[#f0eae4]">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-md bg-[#efebe9] text-[#5d4037] flex items-center justify-center font-bold text-xs">
                                        {idx + 1}
                                    </div>
                                    <span className="text-xs font-semibold text-[#3e2723] truncate max-w-[150px]">{tech.name}</span>
                                </div>
                                <span className="font-mono text-xs font-semibold text-[#5d4037] tabular-nums">
                                    {tech.count} งาน
                                </span>
                            </div>
                        ))}
                        {analytics.topTechnicians.length === 0 && (
                            <p className="text-stone-400 text-center py-6 text-xs">ไม่มีข้อมูลช่าง</p>
                        )}
                    </div>
                </div>

                {/* Top Rewards */}
                <div className="bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-3">ของรางวัลที่ถูกแลกสูงสุด</h3>
                    <div className="space-y-2">
                        {analytics.topRewards.map((reward: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-[#faf8f5] rounded-lg border border-[#f0eae4]">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-6 h-6 rounded-md bg-[#efebe9] text-[#5d4037] flex items-center justify-center font-bold text-xs">
                                            {idx + 1}
                                        </div>
                                        <span className="text-xs font-semibold text-[#3e2723] truncate max-w-[140px]">{reward.name}</span>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-[#5d4037] tabular-nums">
                                        {reward.count} ครั้ง
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pl-8 text-[11px] text-stone-500">
                                    <span>มูลค่าส่วนลดรวม</span>
                                    <span className="font-medium text-[#5d4037] font-mono tabular-nums">
                                        {Number(reward.totalDiscounted).toLocaleString()} บาท
                                    </span>
                                </div>
                            </div>
                        ))}
                        {analytics.topRewards.every(r => r.count === 0) && (
                            <p className="text-stone-400 text-center py-6 text-xs">ยังไม่มีการแลกของรางวัล</p>
                        )}
                    </div>
                </div>

                {/* Service Performance Table */}
                <div className="bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-3">สรุปผลงานตามบริการ</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-[#e7e0da] text-stone-500 font-semibold uppercase text-[11px]">
                                    <th className="pb-2">บริการ</th>
                                    <th className="pb-2 text-center">จำนวน</th>
                                    <th className="pb-2 text-right">รายได้</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0eae4]">
                                {analytics.topServices.map((service: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-[#fbf9f7]">
                                        <td className="py-2.5 font-medium text-[#3e2723] truncate max-w-[120px]">{service.name}</td>
                                        <td className="py-2.5 text-stone-600 text-center font-mono tabular-nums">{service.count}</td>
                                        <td className="py-2.5 font-bold text-[#5d4037] text-right font-mono tabular-nums">
                                            {Number(service.revenue).toLocaleString()} บาท
                                        </td>
                                    </tr>
                                ))}
                                {analytics.topServices.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="py-6 text-center text-stone-400 text-xs">ไม่มีรายการ</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
