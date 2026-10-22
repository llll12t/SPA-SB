"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';
import { getServicesForCustomer } from '@/app/actions/serviceActions';
import { Service } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default function AppointmentPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const router = useRouter();
    const { profile } = useProfile();

    const fetchServices = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const result = await getServicesForCustomer();
            if (result.success && result.services) {
                setServices(result.services);
            } else {
                setErrorMsg(result.error || 'ไม่สามารถโหลดข้อมูลบริการได้');
            }
        } catch (e) {
            console.error('Failed fetching services', e);
            setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const categories = useMemo(() => {
        const set = new Set<string>();
        services.forEach((s) => {
            if (s.category && s.category.trim()) {
                set.add(s.category.trim());
            }
        });
        return ['all', ...Array.from(set)];
    }, [services]);

    const filteredServices = useMemo(() => {
        if (activeCategory === 'all') return services;
        return services.filter((s) => s.category?.trim() === activeCategory);
    }, [services, activeCategory]);

    const handleSelectService = (service: Service) => {
        router.push(`/appointment/service-detail?id=${service.id}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-3">
                <SpaFlowerIcon className="w-12 h-12 animate-spin text-[#5d4037]" style={{ animationDuration: '3s' }} />
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดรายการบริการ...</p>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="min-h-screen bg-[#faf8f5]">
                <CustomerHeader showBackButton={true} showActionButtons={false} />
                <div className="p-6 text-center">
                    <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200 text-xs font-semibold">
                        {errorMsg}
                    </div>
                    <button
                        onClick={fetchServices}
                        className="mt-4 px-5 py-2.5 bg-[#5d4037] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#3e2723]"
                    >
                        ลองใหม่อีกครั้ง
                    </button>
                </div>
            </div>
        );
    }

    if (!loading && services.length === 0) {
        return (
            <div className="min-h-screen bg-[#faf8f5]">
                <CustomerHeader showBackButton={true} showActionButtons={false} />
                <div className="p-6 text-center">
                    <div className="bg-white p-6 rounded-3xl border border-[#e7e0da] shadow-2xs space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-[#8d6e63]">
                            <SpaFlowerIcon className="w-7 h-7" />
                        </div>
                        <p className="text-sm font-bold text-[#3e2723]">ขณะนี้ยังไม่มีรายการบริการเปิดใช้งาน</p>
                        <p className="text-xs text-[#8d6e63]">กรุณาลองใหม่อีกครั้งในภายหลัง</p>
                        <button
                            onClick={fetchServices}
                            className="px-5 py-2 bg-[#5d4037] text-white rounded-xl text-xs font-bold"
                        >
                            รีเฟรชข้อมูล
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-24">
            <CustomerHeader showBackButton={true} showActionButtons={false} />

            <div className="px-4.5 py-4 space-y-4">
                {/* Intro Title */}
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#5d4037] bg-[#f5ede8] px-2 py-0.5 rounded-full border border-[#e8ddd7]">
                            รายการบริการ
                        </span>
                    </div>
                    <h1 className="text-lg font-bold text-[#3e2723] tracking-tight mt-1">
                        เลือกบริการที่คุณต้องการ
                    </h1>
                    <p className="text-xs text-[#8d6e63]">
                        กดเลือกบริการเพื่อดูรายละเอียด เลือกระยะเวลา และช่วงเวลาที่สะดวก
                    </p>
                </div>

                {/* Category Filters */}
                {categories.length > 2 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    activeCategory === cat
                                        ? 'bg-[#5d4037] text-white shadow-xs'
                                        : 'bg-white text-[#5d4037] border border-[#e7e0da] hover:bg-[#faf8f5]'
                                }`}
                            >
                                {cat === 'all' ? 'ทั้งหมด' : cat}
                            </button>
                        ))}
                    </div>
                )}

                {/* Service Cards Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                    {filteredServices.map((service) => (
                        <div
                            key={service.id}
                            onClick={() => handleSelectService(service)}
                            className="bg-white rounded-2xl overflow-hidden border border-[#e7e0da] shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col group active:scale-[0.98]"
                        >
                            {/* Service Image */}
                            <div className="relative w-full aspect-4/3 bg-[#f5ede8] overflow-hidden">
                                {service.imageUrl ? (
                                    <img
                                        src={service.imageUrl}
                                        alt={service.serviceName || service.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-[#8d6e63] p-2">
                                        <SpaFlowerIcon className="w-8 h-8 opacity-40 mb-1" />
                                        <span className="text-[10px] font-semibold text-center">ไม่มีรูปภาพ</span>
                                    </div>
                                )}

                                {/* Category Badge */}
                                {service.category && (
                                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold bg-black/55 text-white backdrop-blur-xs">
                                        {service.category}
                                    </span>
                                )}
                            </div>

                            {/* Service Info */}
                            <div className="p-3 flex-1 flex flex-col justify-between">
                                <div>
                                    <h2 className="font-bold text-xs sm:text-sm text-[#3e2723] line-clamp-2 leading-snug group-hover:text-[#5d4037] transition-colors">
                                        {service.serviceName || service.name}
                                    </h2>

                                    {(service.description || service.details) && (
                                        <p className="text-[11px] text-[#8d6e63] line-clamp-1 mt-0.5">
                                            {service.description || service.details}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-[#f0eae4] flex items-baseline justify-between">
                                    <span className="text-[10px] font-medium text-[#8d6e63] flex items-center gap-0.5">
                                        <span>⏱</span>
                                        <span>{service.duration || 60} น.</span>
                                    </span>

                                    <div className="text-right">
                                        <span className="font-extrabold text-xs sm:text-sm text-[#3e2723] font-mono">
                                            {(service.price || 0).toLocaleString()}
                                        </span>
                                        <span className="text-[10px] font-bold text-[#8d6e63] ml-0.5">
                                            {profile?.currencySymbol || '฿'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
