"use client";

import { useState, useEffect } from 'react';
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

    const handleSelectService = (service: Service) => {
        router.push(`/appointment/service-detail?id=${service.id}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }
    if (errorMsg) return <div className="p-4 text-center text-red-600">{errorMsg}</div>;
    if (!loading && services.length === 0) {
        return (
            <div className="flex flex-col h-screen">
                <CustomerHeader showBackButton={true} showActionButtons={false} />
                <div className="p-6 text-center bg-white rounded-xl m-4 shadow-sm">
                    <p className="mb-4 text-gray-700">ขออภัย ขณะนี้ยังไม่มีบริการให้เลือก</p>
                    <button onClick={fetchServices} className="px-4 py-2 bg-[#5D4037] text-white rounded-2xl font-semibold">ลองอีกครั้ง</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="px-6 py-2 pb-20">
                <div className="grid grid-cols-2 gap-3">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            onClick={() => handleSelectService(service)}
                            className="rounded-2xl overflow-hidden shadow-md cursor-pointer transform hover:scale-105 transition-transform duration-200 bg-white relative group"
                            style={{ aspectRatio: '1/1' }}
                        >
                            <div className="relative w-full h-full">
                                {service.imageUrl ? (
                                    <img
                                        src={service.imageUrl}
                                        alt={service.serviceName}
                                        className="object-cover w-full h-full"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                        No Image
                                    </div>
                                )}
                                {/* overlay gradient + text */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90"></div>
                                <div className="absolute bottom-0 left-0 w-full p-3 text-white">
                                    <div className="font-bold text-sm truncate shadow-sm">
                                        {service.serviceName}
                                    </div>
                                    <div className="text-xs opacity-90 shadow-sm flex items-center gap-1">
                                        <span>⏱ {service.duration || '-'} น.</span>
                                        <span>|</span>
                                        <span>{(service.price || 0).toLocaleString()} {profile?.currencySymbol || '฿'}</span>
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
