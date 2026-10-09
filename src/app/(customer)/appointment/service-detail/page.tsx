"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, doc, getDoc } from '@/app/lib/supabaseDb';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';
import { Service, AddOnService } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

// --- Add-on Card Component ---
interface AddOnCardProps {
    addOn: AddOnService;
    isSelected: boolean;
    onToggle: (addOn: AddOnService) => void;
}

const AddOnCard: React.FC<AddOnCardProps> = ({ addOn, isSelected, onToggle }) => {
    const { profile } = useProfile();
    return (
        <div
            onClick={() => onToggle(addOn)}
            className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all border text-xs sm:text-sm ${
                isSelected
                    ? 'bg-[#f5ede8] border-[#5d4037] shadow-xs'
                    : 'bg-white border-[#e7e0da] hover:border-[#d7ccc8]'
            }`}
        >
            <div className="flex items-center w-full min-w-0">
                <span className="font-bold text-[#3e2723] flex-1 truncate">{addOn.name}</span>
                <span className="text-xs text-[#8d6e63] ml-2 whitespace-nowrap font-mono">
                    {addOn.duration} น. | {Number(addOn.price || 0).toLocaleString()} {profile.currencySymbol || '฿'}
                </span>
                <div
                    className={`w-5 h-5 rounded-lg flex items-center justify-center ml-2.5 shrink-0 transition-all ${
                        isSelected ? 'bg-[#5d4037] text-white' : 'border border-[#d7ccc8] bg-white'
                    }`}
                >
                    {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};

function ServiceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('id');
    const [service, setService] = useState<Service | null>(null);

    const [selectedAddOns, setSelectedAddOns] = useState<AddOnService[]>([]);

    // Option-Based States
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [selectedTargetAreas, setSelectedTargetAreas] = useState<string[]>([]);

    // Area-Based-Options States
    const [selectedAreaOptions, setSelectedAreaOptions] = useState<Record<string, number>>({});
    const [expandedArea, setExpandedArea] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();

    useEffect(() => {
        if (!serviceId) {
            router.push('/appointment');
            return;
        }
        const fetchService = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() } as Service;
                    setService(data);

                    // Auto select min price option
                    if (data.serviceType === 'option-based' && data.serviceOptions && data.serviceOptions.length > 0) {
                        const minPriceIndex = data.serviceOptions.reduce((minIndex, current, currentIndex, array) => {
                            return current.price < array[minIndex].price ? currentIndex : minIndex;
                        }, 0);
                        setSelectedOptionIndex(minPriceIndex);
                    }
                } else {
                    router.push('/appointment');
                }
            } catch (error) {
                console.error('Error fetching service:', error);
                router.push('/appointment');
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [serviceId, router]);

    const toggleAddOn = (addOn: AddOnService) => {
        setSelectedAddOns((prev) => {
            const isAlreadySelected = prev.some((item) => item.name === addOn.name);
            if (isAlreadySelected) {
                return prev.filter((item) => item.name !== addOn.name);
            } else {
                return [...prev, addOn];
            }
        });
    };

    const toggleTargetArea = (areaName: string) => {
        setSelectedTargetAreas((prev) => {
            if (prev.includes(areaName)) {
                return prev.filter((a) => a !== areaName);
            } else {
                return [...prev, areaName];
            }
        });
    };

    const handleAreaOptionSelect = (areaName: string, optionIndex: number) => {
        setSelectedAreaOptions((prev) => {
            const current = prev[areaName];
            if (current === optionIndex) {
                const newState = { ...prev };
                delete newState[areaName];
                return newState;
            }
            return { ...prev, [areaName]: optionIndex };
        });
    };

    const toggleAreaExpand = (areaName: string) => {
        setExpandedArea((prev) => (prev === areaName ? null : areaName));
    };

    // Calculate Price
    const totalPrice = useMemo(() => {
        let basePrice = 0;

        if (service?.serviceType === 'option-based') {
            if (selectedOptionIndex !== null && service.serviceOptions?.[selectedOptionIndex]) {
                const optionPrice = service.serviceOptions[selectedOptionIndex].price;
                const multiplier = selectedTargetAreas.length > 0 ? selectedTargetAreas.length : 1;
                basePrice = optionPrice * multiplier;
            } else {
                basePrice = service.price || 0;
            }
        } else if (service?.serviceType === 'area-based-options') {
            if (service.areaOptions) {
                Object.entries(selectedAreaOptions).forEach(([areaName, optionIdx]) => {
                    const group = service.areaOptions?.find((g) => g.areaName === areaName);
                    if (group && group.options?.[optionIdx]) {
                        basePrice += group.options[optionIdx].price || 0;
                    }
                });
            }
        } else {
            basePrice = service?.price || 0;
        }

        const addOnsPrice = selectedAddOns.reduce((total, addOn) => total + (addOn.price || 0), 0);
        return basePrice + addOnsPrice;
    }, [service, selectedAddOns, selectedOptionIndex, selectedTargetAreas, selectedAreaOptions]);

    // Calculate Duration
    const totalDuration = useMemo(() => {
        let baseDuration = 0;

        if (service?.serviceType === 'option-based') {
            if (selectedOptionIndex !== null && service.serviceOptions?.[selectedOptionIndex]) {
                const optionDuration = service.serviceOptions[selectedOptionIndex].duration;
                const multiplier = selectedTargetAreas.length > 0 ? selectedTargetAreas.length : 1;
                baseDuration = optionDuration * multiplier;
            } else {
                baseDuration = service.duration || 0;
            }
        } else if (service?.serviceType === 'area-based-options') {
            if (service.areaOptions) {
                Object.entries(selectedAreaOptions).forEach(([areaName, optionIdx]) => {
                    const group = service.areaOptions?.find((g) => g.areaName === areaName);
                    if (group && group.options?.[optionIdx]) {
                        baseDuration += group.options[optionIdx].duration || 0;
                    }
                });
            }
        } else {
            baseDuration = service?.duration || 0;
        }

        const addOnsDuration = selectedAddOns.reduce((total, addOn) => total + (addOn.duration || 0), 0);
        return baseDuration + addOnsDuration;
    }, [service, selectedAddOns, selectedOptionIndex, selectedTargetAreas, selectedAreaOptions]);

    const handleConfirm = () => {
        if (!service) return;

        const params = new URLSearchParams();
        if (service.id) params.set('serviceId', service.id);

        if (service.serviceType === 'option-based') {
            if (selectedTargetAreas.length === 0) {
                alert('กรุณาเลือกตำแหน่งอย่างน้อย 1 จุด');
                return;
            }
            if (selectedOptionIndex === null || !service.serviceOptions) {
                alert('กรุณาเลือกแพ็คเกจ (Option)');
                return;
            }
            const opt = service.serviceOptions[selectedOptionIndex];

            params.set('selectedOptionName', opt.name);
            params.set('selectedOptionPrice', opt.price.toString());
            params.set('selectedOptionDuration', opt.duration.toString());
            params.set('selectedAreas', selectedTargetAreas.join(','));
        } else if (service.serviceType === 'area-based-options') {
            if (Object.keys(selectedAreaOptions).length === 0) {
                alert('กรุณาเลือกตัวเลือกอย่างน้อย 1 รายการ');
                return;
            }
            params.set('selectedAreaOptions', JSON.stringify(selectedAreaOptions));
        }

        if (selectedAddOns.length > 0) {
            params.set('addOns', selectedAddOns.map((a) => a.name).join(','));
        }
        router.push(`/appointment/select-date-time?${params.toString()}`);
    };

    if (loading || profileLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-3">
                <SpaFlowerIcon className="w-12 h-12 animate-spin text-[#5d4037]" style={{ animationDuration: '3s' }} />
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดข้อมูลบริการ...</p>
            </div>
        );
    }
    if (!service) return null;

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-28">
            <CustomerHeader showBackButton={true} showActionButtons={false} backUrl="/appointment" />

            <div className="px-4.5 py-4 space-y-4">
                {/* Hero Service Image Card */}
                <div className="relative w-full aspect-16/9 rounded-3xl overflow-hidden shadow-md bg-[#2a1a10]">
                    {service.imageUrl ? (
                        <img
                            src={service.imageUrl}
                            alt={service.serviceName || service.name}
                            className="object-cover w-full h-full"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#8d6e63] bg-[#f5ede8]">
                            <SpaFlowerIcon className="w-12 h-12 opacity-40 mb-1" />
                            <span className="text-xs font-semibold">ไม่มีรูปภาพ</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                        <div className="flex items-center gap-2 mb-1">
                            {service.category && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 backdrop-blur-xs text-white">
                                    {service.category}
                                </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#5d4037]/80 backdrop-blur-xs text-white">
                                ⏱ {service.duration || 60} นาที
                            </span>
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold leading-tight drop-shadow-sm">
                            {service.serviceName || service.name}
                        </h1>
                    </div>
                </div>

                {/* Option-Based UI */}
                {service.serviceType === 'option-based' && (
                    <div className="bg-white p-4.5 rounded-3xl border border-[#e7e0da] shadow-2xs space-y-4">
                        {/* 1. Select Target Areas */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <h2 className="text-xs font-bold text-[#3e2723] uppercase tracking-wider">
                                    1. เลือกตำแหน่งที่ต้องการดูแล
                                </h2>
                                {selectedTargetAreas.length > 0 && (
                                    <span className="text-[11px] font-bold text-[#5d4037] bg-[#f5ede8] px-2.5 py-0.5 rounded-full border border-[#e8ddd7]">
                                        เลือก {selectedTargetAreas.length} จุด
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {service.selectableAreas?.map((areaName, idx) => {
                                    const isSelected = selectedTargetAreas.includes(areaName);
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleTargetArea(areaName)}
                                            className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-xs h-18 text-center border ${
                                                isSelected
                                                    ? 'bg-[#f5ede8] border-[#5d4037] text-[#3e2723] font-bold shadow-xs'
                                                    : 'bg-white border-[#e7e0da] text-[#5d4037] hover:bg-[#faf8f5]'
                                            }`}
                                        >
                                            <div
                                                className={`w-3.5 h-3.5 rounded-md flex items-center justify-center shrink-0 border ${
                                                    isSelected ? 'bg-[#5d4037] border-[#5d4037] text-white' : 'border-[#d7ccc8] bg-white'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="leading-tight truncate max-w-full">{areaName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Select Package (Radio) */}
                        {selectedTargetAreas.length > 0 && (
                            <div className="pt-2 border-t border-[#f0eae4] space-y-2.5">
                                <h2 className="text-xs font-bold text-[#3e2723] uppercase tracking-wider">
                                    2. เลือกแพ็คเกจบริการ (ราคาต่อจุด)
                                </h2>
                                <div className="space-y-2">
                                    {service.serviceOptions?.map((opt, idx) => {
                                        const isSelected = selectedOptionIndex === idx;
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedOptionIndex(idx)}
                                                className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all border text-xs sm:text-sm ${
                                                    isSelected
                                                        ? 'bg-[#f5ede8] border-[#5d4037] shadow-xs'
                                                        : 'bg-white border-[#e7e0da] hover:bg-[#faf8f5]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 w-full">
                                                    <div
                                                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'border-[#5d4037]' : 'border-[#d7ccc8]'
                                                        }`}
                                                    >
                                                        {isSelected && <div className="w-2 h-2 rounded-full bg-[#5d4037]" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-[#3e2723]">{opt.name}</div>
                                                        <div className="text-[11px] text-[#8d6e63]">{opt.duration} นาที/จุด</div>
                                                    </div>
                                                    <div className="font-extrabold text-sm text-[#3e2723] font-mono">
                                                        {Number(opt.price).toLocaleString()} {profile.currencySymbol || '฿'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Area-Based-Options UI */}
                {service.serviceType === 'area-based-options' && (
                    <div className="bg-white p-4.5 rounded-3xl border border-[#e7e0da] shadow-2xs space-y-3">
                        <h2 className="text-xs font-bold text-[#3e2723] uppercase tracking-wider">
                            เลือกบริเวณและตัวเลือกการดูแล
                        </h2>
                        {service.areaOptions?.map((areaGroup, areaIdx) => {
                            const isExpanded = expandedArea === areaGroup.areaName;
                            const selectedOptIdx = selectedAreaOptions[areaGroup.areaName];
                            const selectedOpt = selectedOptIdx !== undefined ? areaGroup.options[selectedOptIdx] : null;

                            return (
                                <div
                                    key={areaIdx}
                                    className={`rounded-2xl overflow-hidden transition-all border ${
                                        selectedOpt ? 'border-[#5d4037] bg-[#faf8f5]' : 'border-[#e7e0da] bg-white'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleAreaExpand(areaGroup.areaName)}
                                        className="w-full p-3.5 flex items-center justify-between text-left"
                                    >
                                        <div>
                                            <span className="text-xs sm:text-sm font-bold text-[#3e2723]">
                                                {areaGroup.areaName}
                                            </span>
                                            {selectedOpt && (
                                                <p className="text-[11px] text-[#5d4037] font-semibold mt-0.5 font-mono">
                                                    ✓ {selectedOpt.name} ({Number(selectedOpt.price).toLocaleString()} {profile.currencySymbol || '฿'})
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-[#8d6e63]">
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </button>

                                    {isExpanded && (
                                        <div className="p-2.5 bg-white border-t border-[#f0eae4] space-y-2">
                                            {areaGroup.options?.map((opt, optIdx) => {
                                                const isSelected = selectedOptIdx === optIdx;
                                                return (
                                                    <div
                                                        key={optIdx}
                                                        onClick={() => handleAreaOptionSelect(areaGroup.areaName, optIdx)}
                                                        className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer border text-xs ${
                                                            isSelected
                                                                ? 'bg-[#f5ede8] border-[#5d4037] font-semibold'
                                                                : 'bg-[#faf8f5] border-[#e7e0da] hover:bg-white'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#5d4037]' : 'border-[#d7ccc8]'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#5d4037]" />}
                                                            </div>
                                                            <div>
                                                                <span className="text-[#3e2723]">{opt.name}</span>
                                                                <span className="text-[10px] text-[#8d6e63] ml-1">({opt.duration} น.)</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-bold text-[#3e2723] font-mono">
                                                            {Number(opt.price).toLocaleString()} {profile.currencySymbol || '฿'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add-ons Section */}
                {service.addOnServices && service.addOnServices.length > 0 && (
                    <div className="bg-white p-4.5 rounded-3xl border border-[#e7e0da] shadow-2xs space-y-2.5">
                        <h2 className="text-xs font-bold text-[#3e2723] uppercase tracking-wider">
                            บริการเสริมเพิ่มเติม (Add-ons)
                        </h2>
                        <div className="space-y-2">
                            {service.addOnServices.map((addOn, idx) => (
                                <AddOnCard
                                    key={idx}
                                    addOn={addOn}
                                    isSelected={selectedAddOns.some((item) => item.name === addOn.name)}
                                    onToggle={toggleAddOn}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Details Section */}
                {(service.details || service.description) && (
                    <div className="bg-white p-4.5 rounded-3xl border border-[#e7e0da] shadow-2xs space-y-2">
                        <h2 className="text-xs font-bold text-[#3e2723] uppercase tracking-wider">
                            รายละเอียดการให้บริการ
                        </h2>
                        <p className="text-xs text-[#5d4037] leading-relaxed whitespace-pre-line">
                            {service.details || service.description}
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Luxury Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#e7e0da] shadow-xl py-3 px-4 z-50">
                <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8d6e63]">
                            <span>ระยะเวลารวม:</span>
                            <span className="font-bold text-[#3e2723]">{totalDuration} นาที</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-xs text-[#8d6e63] font-medium">รวม</span>
                            <span className="text-xl font-extrabold text-[#3e2723] font-mono leading-none">
                                {totalPrice.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-[#8d6e63]">
                                {profile.currencySymbol || '฿'}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={
                            (service.serviceType === 'option-based' &&
                                (selectedTargetAreas.length === 0 || selectedOptionIndex === null)) ||
                            (service.serviceType === 'area-based-options' &&
                                Object.keys(selectedAreaOptions).length === 0)
                        }
                        className="px-6 h-12 rounded-2xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2 shrink-0"
                    >
                        <span>เลือกวันและเวลา</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ServiceDetailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                    <SpaFlowerIcon className="w-12 h-12 animate-spin text-[#5d4037]" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <ServiceDetailContent />
        </Suspense>
    );
}
