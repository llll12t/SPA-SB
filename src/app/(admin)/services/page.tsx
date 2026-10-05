"use client";

import { useState, useEffect } from 'react';
import { db, collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from '@/app/lib/supabaseDb';
import Link from 'next/link';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import { Service } from '@/types';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Tag: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
};

// --- SVG Placeholder ---
const ServiceImagePlaceholder = ({ className = '' }: { className?: string }) => (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#f5ede8] to-[#ede0d4] ${className}`}>
        <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-1.5 opacity-60">
            <circle cx="40" cy="30" r="14" stroke="#8D6E63" strokeWidth="2" fill="#fff5f0" />
            <path d="M40 22 C36 22 33 26 33 30 C33 34 36 38 40 38 C44 38 47 34 47 30 C47 26 44 22 40 22Z" fill="#D7B49E" />
            <path d="M38 28 L40 26 L42 28 L42 32 L38 32Z" fill="#8D6E63" />
            <circle cx="40" cy="26" r="2" fill="#5D4037" />
            <ellipse cx="40" cy="56" rx="20" ry="8" fill="#D7B49E" opacity="0.5" />
            <path d="M26 50 C26 44 32 40 40 40 C48 40 54 44 54 50" stroke="#8D6E63" strokeWidth="2" fill="none" />
            <path d="M30 54 Q40 48 50 54" stroke="#A1887F" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        <span className="text-[10px] font-medium text-[#A1887F] tracking-wide">ยังไม่มีรูปภาพ</span>
    </div>
);

// --- Helpers ---
const formatPrice = (v: number | undefined | null) => v == null ? '-' : Number(v).toLocaleString();

const formatServicePrice = (service: Service, currencySymbol: string) => {
    if (service.serviceType === 'option-based') {
        const prices = service.serviceOptions?.map(o => Number(o.price)) || [];
        if (prices.length === 0) return `0 ${currencySymbol}`;
        const min = Math.min(...prices), max = Math.max(...prices);
        return min === max ? `${formatPrice(min)} ${currencySymbol}` : `${formatPrice(min)} - ${formatPrice(max)} ${currencySymbol}`;
    }
    if (service.serviceType === 'area-based-options') {
        const allPrices = service.areaOptions?.flatMap(a => a.options.map(o => Number(o.price))) || [];
        if (allPrices.length === 0) return `0 ${currencySymbol}`;
        const min = Math.min(...allPrices), max = Math.max(...allPrices);
        return min === max ? `${formatPrice(min)} ${currencySymbol}` : `${formatPrice(min)} - ${formatPrice(max)} ${currencySymbol}`;
    }
    return `${formatPrice(service.price)} ${currencySymbol}`;
};

const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        available: { label: 'ให้บริการ', bg: 'bg-green-100', text: 'text-green-800' },
        unavailable: { label: 'งดให้บริการ', bg: 'bg-red-100', text: 'text-red-800' },
    };
    const current = config[status] || { label: 'ไม่ระบุ', bg: 'bg-gray-100', text: 'text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

export default function ServicesListPage() {
    const [allServices, setAllServices] = useState<Service[]>([]);
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
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
            } catch { showToast("ไม่สามารถโหลดข้อมูลบริการได้", "error"); }
            finally { setLoading(false); }
        };
        fetchServices();
    }, [showToast]);

    useEffect(() => {
        const lowerSearch = search.toLowerCase();
        setFilteredServices(allServices.filter(s =>
            (s.serviceName || s.name || '').toLowerCase().includes(lowerSearch) ||
            (s.category || '').toLowerCase().includes(lowerSearch)
        ));
    }, [search, allServices]);

    const handleUpdateStatus = async (service: Service) => {
        const newStatus = service.status === 'available' ? 'unavailable' : 'available';
        try {
            if (service.id) {
                await updateDoc(doc(db, 'services', service.id), { status: newStatus });
                setAllServices(prev => prev.map(s => s.id === service.id ? { ...s, status: newStatus } : s));
                showToast(`อัพเดทสถานะเป็น "${newStatus === 'available' ? 'ให้บริการ' : 'งดให้บริการ'}" แล้ว`, 'success');
            }
        } catch { showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error'); }
    };

    const confirmDelete = async () => {
        if (!serviceToDelete?.id) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'services', serviceToDelete.id));
            setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
            showToast('ลบข้อมูลบริการสำเร็จ!', 'success');
        } catch { showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error'); }
        finally { setIsDeleting(false); setServiceToDelete(null); }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!serviceToDelete} title="ยืนยันการลบ" message={`คุณแน่ใจหรือไม่ว่าต้องการลบบริการ "${serviceToDelete?.serviceName || serviceToDelete?.name}"?`} onConfirm={confirmDelete} onCancel={() => setServiceToDelete(null)} isProcessing={isDeleting} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">จัดการบริการ</h1>
                    <p className="text-sm text-gray-500">ตั้งค่าและจัดการรายการบริการทั้งหมด</p>
                </div>
                <Link href="/services/add" className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors btn-primary">
                    <Icons.Plus /> เพิ่มบริการใหม่
                </Link>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                    <input type="text" placeholder="ค้นหาชื่อบริการ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-1 bg-white border rounded-md p-1">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                </div>
            </div>

            {/* Content */}
            {filteredServices.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Tag /></div>
                    <p className="text-gray-600 font-medium">ไม่พบข้อมูลบริการ</p>
                    <p className="text-sm text-gray-400 mt-1">ลองค้นหาใหม่หรือเพิ่มบริการใหม่</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredServices.map(service => (
                        <div key={service.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            <div className="relative h-40 w-full bg-[#f5ede8] overflow-hidden">
                                {service.imageUrl ? (
                                    <Image src={service.imageUrl} alt={service.serviceName || service.name || 'Service'} fill className="object-cover" unoptimized />
                                ) : (
                                    <ServiceImagePlaceholder />
                                )}
                                <div className="absolute top-2 right-2"><StatusBadge status={service.status || 'available'} /></div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-medium text-gray-900 mb-1">{service.serviceName || service.name}</h3>
                                <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{service.details || service.description || 'ไม่มีรายละเอียด'}</p>
                                <div className="flex items-center justify-between text-sm mb-3">
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <Icons.Clock />
                                        <span>{['option-based', 'area-based-options'].includes(service.serviceType || '') ? 'ตามตัวเลือก' : `${service.duration} นาที`}</span>
                                    </div>
                                    <span className="font-medium text-gray-900">{formatServicePrice(service, profile?.currencySymbol || '฿')}</span>
                                </div>
                                <div className="flex items-center gap-2 pt-3 border-t">
                                    <button onClick={() => handleUpdateStatus(service)} className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${service.status === 'available' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                                        {service.status === 'available' ? 'ปิดบริการ' : 'เปิดบริการ'}
                                    </button>
                                    <Link href={`/services/edit/${service.id}`} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border"><Icons.Edit /></Link>
                                    <button onClick={() => setServiceToDelete(service)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border"><Icons.Trash /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">บริการ</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ราคา</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระยะเวลา</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredServices.map(service => (
                                <tr key={service.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-md overflow-hidden bg-[#f5ede8] flex-shrink-0">
                                                {service.imageUrl ? (
                                                    <Image src={service.imageUrl} alt={service.serviceName || service.name || 'Service'} fill className="object-cover" unoptimized />
                                                ) : (
                                                    <ServiceImagePlaceholder />
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{service.serviceName || service.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatServicePrice(service, profile?.currencySymbol || '฿')}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{['option-based', 'area-based-options'].includes(service.serviceType || '') ? 'ตามตัวเลือก' : `${service.duration} นาที`}</td>
                                    <td className="px-6 py-4"><StatusBadge status={service.status || 'available'} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/services/edit/${service.id}`} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</Link>
                                        <button onClick={() => setServiceToDelete(service)} className="text-red-600 hover:underline text-sm">ลบ</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
