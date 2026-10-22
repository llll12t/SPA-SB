"use client";

import { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from '@/app/lib/supabaseDb';
import Link from 'next/link';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import { Service } from '@/types';

// --- SVG Placeholder ---
const ServiceImagePlaceholder = ({ className = '' }: { className?: string }) => (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#f5f2ed] to-[#ede0d4] ${className}`}>
        <span className="text-2xl mb-1 opacity-70">💆</span>
        <span className="text-[10px] font-semibold text-[#8d6e63] tracking-wide">ยังไม่มีรูปภาพ</span>
    </div>
);

// --- Helpers ---
const formatPrice = (v: number | undefined | null) => (v == null ? '-' : Number(v).toLocaleString());

const formatServicePrice = (service: Service) => {
    if (service.serviceType === 'option-based') {
        const prices = service.serviceOptions?.map(o => Number(o.price)) || [];
        if (prices.length === 0) return '0 บาท';
        const min = Math.min(...prices), max = Math.max(...prices);
        return min === max ? `${formatPrice(min)} บาท` : `${formatPrice(min)} - ${formatPrice(max)} บาท`;
    }
    if (service.serviceType === 'area-based-options') {
        const allPrices = service.areaOptions?.flatMap(a => a.options.map(o => Number(o.price))) || [];
        if (allPrices.length === 0) return '0 บาท';
        const min = Math.min(...allPrices), max = Math.max(...allPrices);
        return min === max ? `${formatPrice(min)} บาท` : `${formatPrice(min)} - ${formatPrice(max)} บาท`;
    }
    return `${formatPrice(service.price)} บาท`;
};

const StatusBadge = ({ status }: { status: string }) => {
    const isAvailable = status === 'available';
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                isAvailable
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>{isAvailable ? 'ให้บริการ' : 'งดให้บริการ'}</span>
        </span>
    );
};

export default function ServicesListPage() {
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();
    const { profile } = useProfile();

    useEffect(() => {
        const fetchServices = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
                setAllServices(data);
                setFilteredServices(data);
            } catch {
                showToast('ไม่สามารถโหลดข้อมูลบริการได้', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchServices();
    }, [showToast]);

    useEffect(() => {
        const lowerSearch = search.trim().toLowerCase();
        let res = allServices;

        if (statusFilter !== 'all') {
            res = res.filter(s => (s.status || 'available') === statusFilter);
        }

        if (lowerSearch) {
            res = res.filter(
                s =>
                    (s.serviceName || s.name || '').toLowerCase().includes(lowerSearch) ||
                    (s.category || '').toLowerCase().includes(lowerSearch) ||
                    (s.details || s.description || '').toLowerCase().includes(lowerSearch)
            );
        }

        setFilteredServices(res);
    }, [search, statusFilter, allServices]);

    const handleUpdateStatus = async (service: Service) => {
        const newStatus = service.status === 'available' ? 'unavailable' : 'available';
        try {
            if (service.id) {
                await updateDoc(doc(db, 'services', service.id), { status: newStatus });
                setAllServices(prev => prev.map(s => (s.id === service.id ? { ...s, status: newStatus } : s)));
                showToast(`อัปเดตสถานะเป็น "${newStatus === 'available' ? 'ให้บริการ' : 'งดให้บริการ'}" แล้ว`, 'success');
            }
        } catch {
            showToast('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error');
        }
    };

    const confirmDelete = async () => {
        if (!serviceToDelete?.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'services', serviceToDelete.id));
            setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
            showToast('ลบข้อมูลบริการสำเร็จ!', 'success');
        } catch {
            showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
        } finally {
            setIsDeleting(false);
            setServiceToDelete(null);
        }
    };

    if (loading && allServices.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดรายการบริการ...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            <ConfirmationModal
                show={!!serviceToDelete}
                title="ยืนยันการลบบริการ"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบบริการ "${serviceToDelete?.serviceName || serviceToDelete?.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
                onConfirm={confirmDelete}
                onCancel={() => setServiceToDelete(null)}
                isProcessing={isDeleting}
            />

            {/* 1. Frameless Operations Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723] tracking-tight">
                            จัดการบริการ
                        </h1>
                        <span className="text-[11px] font-semibold text-[#5d4037] bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#d7ccc8]/70">
                            {allServices.length} รายการ
                        </span>
                    </div>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        กำหนดรายการบริการนวดและสปา อัตราค่าบริการ ระยะเวลา และการเปิด/ปิดให้บริการ
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* View Switcher */}
                    <div className="inline-flex p-1 bg-white rounded-xl border border-[#d7ccc8] gap-1 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'grid'
                                    ? 'bg-[#5d4037] text-white shadow-2xs'
                                    : 'text-[#5d4037] hover:text-[#3e2723]'
                            }`}
                        >
                            การ์ด
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-[#5d4037] text-white shadow-2xs'
                                    : 'text-[#5d4037] hover:text-[#3e2723]'
                            }`}
                        >
                            ตาราง
                        </button>
                    </div>

                    {/* Add Button */}
                    <Link
                        href="/services/add"
                        className="h-9 px-3.5 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                        <span>+ เพิ่มบริการใหม่</span>
                    </Link>
                </div>
            </div>

            {/* 2. Operational Filter Matrix */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e7e0da] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8d6e63]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อบริการ หรือหมวดหมู่..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-9.5 pl-9 pr-8 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] outline-none text-[#3e2723] placeholder:text-[#a1887f] font-medium"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-2.5 text-[#8d6e63] hover:text-[#3e2723]"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                    {(
                        [
                            { key: 'all', label: 'ทั้งหมด' },
                            { key: 'available', label: 'ให้บริการ' },
                            { key: 'unavailable', label: 'งดให้บริการ' },
                        ] as const
                    ).map(tab => {
                        const isTabActive = statusFilter === tab.key;
                        const count =
                            tab.key === 'all'
                                ? allServices.length
                                : allServices.filter(s => (s.status || 'available') === tab.key).length;

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                                    isTabActive
                                        ? 'bg-[#5d4037] text-white shadow-xs'
                                        : 'bg-[#faf8f5] text-[#5d4037] border border-[#e7e0da] hover:bg-[#f5f2ed]'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold tabular-nums ${
                                        isTabActive ? 'bg-white/20 text-white' : 'bg-[#e7e0da] text-[#5d4037]'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 3. Services Content */}
            {filteredServices.length === 0 ? (
                <div className="text-center py-16 bg-white border border-[#e7e0da] rounded-2xl shadow-2xs space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] flex items-center justify-center mx-auto text-xl shadow-2xs">
                        💆
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#3e2723]">ไม่พบบริการตามเงื่อนไข</h3>
                        <p className="text-xs text-[#8d6e63] mt-0.5">
                            ลองเปลี่ยนคำค้นหา หรือเพิ่มรายการบริการใหม่เข้าสู่ระบบ
                        </p>
                    </div>
                    <Link
                        href="/services/add"
                        className="inline-flex px-4 py-2 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white shadow-xs transition-colors"
                    >
                        + เพิ่มบริการใหม่
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (
                /* Luxury Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredServices.map(service => (
                        <div
                            key={service.id}
                            className="bg-white border border-[#e7e0da] hover:border-[#5d4037] rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                            <div>
                                {/* Image Box */}
                                <div className="relative h-40 w-full bg-[#f5f2ed] overflow-hidden">
                                    {service.imageUrl ? (
                                        <Image
                                            src={service.imageUrl}
                                            alt={service.serviceName || service.name || 'Service'}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            unoptimized
                                        />
                                    ) : (
                                        <ServiceImagePlaceholder />
                                    )}
                                    <div className="absolute top-2.5 right-2.5">
                                        <StatusBadge status={service.status || 'available'} />
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-4 space-y-2">
                                    <h3 className="font-bold text-sm text-[#3e2723] group-hover:text-[#5d4037] transition-colors truncate">
                                        {service.serviceName || service.name}
                                    </h3>
                                    <p className="text-xs text-[#8d6e63] line-clamp-2 min-h-[32px] leading-relaxed">
                                        {service.details || service.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                                    </p>

                                    {/* Price & Duration */}
                                    <div className="pt-2 border-t border-[#e7e0da] flex items-center justify-between">
                                        <span className="text-[11px] text-[#8d6e63] flex items-center gap-1 font-medium">
                                            <svg className="w-3 h-3 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>
                                                {['option-based', 'area-based-options'].includes(service.serviceType || '')
                                                    ? 'ตามตัวเลือก'
                                                    : `${service.duration} นาที`}
                                            </span>
                                        </span>
                                        <span className="text-sm font-extrabold text-[#3e2723] tabular-nums">
                                            {formatServicePrice(service)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Bar */}
                            <div className="p-3 bg-[#faf8f5] border-t border-[#e7e0da] flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(service)}
                                    className={`flex-1 h-8 rounded-xl text-xs font-bold border transition-colors ${
                                        service.status === 'available'
                                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                >
                                    {service.status === 'available' ? 'ปิดบริการ' : 'เปิดบริการ'}
                                </button>
                                <Link
                                    href={`/services/edit/${service.id}`}
                                    className="w-8 h-8 rounded-xl border border-[#d7ccc8] bg-white hover:bg-[#f5f2ed] text-[#5d4037] flex items-center justify-center transition-colors"
                                    title="แก้ไขข้อมูล"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setServiceToDelete(service)}
                                    className="w-8 h-8 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center transition-colors"
                                    title="ลบบริการ"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* High-Density Data Table View */
                <div className="bg-white rounded-2xl border border-[#e7e0da] overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#f5f2ed]/80 text-[#3e2723] font-semibold text-xs border-b border-[#e7e0da]">
                                <tr>
                                    <th className="px-4 py-3 border-r border-[#e7e0da]">บริการ</th>
                                    <th className="px-4 py-3 border-r border-[#e7e0da]">ระยะเวลา</th>
                                    <th className="px-4 py-3 border-r border-[#e7e0da] text-right">ราคา</th>
                                    <th className="px-4 py-3 border-r border-[#e7e0da] text-center">สถานะ</th>
                                    <th className="px-4 py-3 text-right w-40">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e7e0da] text-xs">
                                {filteredServices.map(service => (
                                    <tr key={service.id} className="hover:bg-[#faf8f5] transition-colors">
                                        <td className="px-4 py-3 border-r border-[#e7e0da]">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#f5f2ed] border border-[#d7ccc8] shrink-0">
                                                    {service.imageUrl ? (
                                                        <Image
                                                            src={service.imageUrl}
                                                            alt={service.serviceName || service.name || 'Service'}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <ServiceImagePlaceholder />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-[#3e2723] truncate">
                                                        {service.serviceName || service.name}
                                                    </div>
                                                    <div className="text-[11px] text-[#8d6e63] truncate">
                                                        {service.category || 'สปาและสุขภาพ'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 border-r border-[#e7e0da] text-[#5d4037] font-medium">
                                            {['option-based', 'area-based-options'].includes(service.serviceType || '')
                                                ? 'ตามตัวเลือก'
                                                : `${service.duration} นาที`}
                                        </td>
                                        <td className="px-4 py-3 border-r border-[#e7e0da] text-right font-extrabold text-[#3e2723] tabular-nums">
                                            {formatServicePrice(service)}
                                        </td>
                                        <td className="px-4 py-3 border-r border-[#e7e0da] text-center">
                                            <StatusBadge status={service.status || 'available'} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(service)}
                                                    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-colors ${
                                                        service.status === 'available'
                                                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {service.status === 'available' ? 'ปิด' : 'เปิด'}
                                                </button>
                                                <Link
                                                    href={`/services/edit/${service.id}`}
                                                    className="px-2.5 py-1 text-xs font-bold text-[#5d4037] bg-[#f5f2ed] hover:bg-[#ebdccc] border border-[#d7ccc8] rounded-lg transition-colors"
                                                >
                                                    แก้ไข
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setServiceToDelete(service)}
                                                    className="px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                                >
                                                    ลบ
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
