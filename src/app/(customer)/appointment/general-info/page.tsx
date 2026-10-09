"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db, collection, doc, getDoc, query, where, getDocs } from '@/app/lib/supabaseDb';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { getNewBookingFlexJson } from '@/app/actions/liffMessageActions';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/Toast';
import { AddOnService, Service, ServiceOption, AreaOption, MultiArea, TechnicianInfo } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

interface Coupon {
    id: string;
    name: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    used?: boolean;
}

function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading, liff } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const router = useRouter();
    const { showToast } = useToast();

    // --- Params ---
    const serviceId = searchParams.get('serviceId');
    const addOnsParam = searchParams.get('addOns');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const technicianId = searchParams.get('technicianId');

    // Legacy Params (Multi-Area)
    const areaIndexParam = searchParams.get('areaIndex');
    const packageIndexParam = searchParams.get('packageIndex');
    const areaIndex = areaIndexParam ? parseInt(areaIndexParam) : null;
    const packageIndex = packageIndexParam ? parseInt(packageIndexParam) : null;

    // New Params (Option-Based)
    const selectedOptionName = searchParams.get('selectedOptionName');
    const selectedOptionPriceParam = searchParams.get('selectedOptionPrice');
    const selectedOptionDurationParam = searchParams.get('selectedOptionDuration');
    const selectedOptionPrice = selectedOptionPriceParam ? parseFloat(selectedOptionPriceParam) : 0;
    const selectedOptionDuration = selectedOptionDurationParam ? parseInt(selectedOptionDurationParam) : 0;

    const selectedAreasParam = searchParams.get('selectedAreas');
    const selectedAreas = selectedAreasParam ? selectedAreasParam.split(',') : [];

    // New Params (Area-Based-Options)
    const selectedAreaOptionsParam = searchParams.get('selectedAreaOptions');
    const selectedAreaOptions = selectedAreaOptionsParam ? JSON.parse(selectedAreaOptionsParam) : {};

    const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", note: "" });
    const [service, setService] = useState<Service | null>(null);
    const [technician, setTechnician] = useState<TechnicianInfo & { id: string } | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [selectedCouponId, setSelectedCouponId] = useState('');
    const [showCoupon, setShowCoupon] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedAddOns = addOnsParam ? addOnsParam.split(',') : [];

    useEffect(() => {
        const fetchAllData = async () => {
            if (liffLoading || !profile?.userId || !serviceId) return;
            try {
                const promises: any[] = [
                    getDoc(doc(db, "customers", profile.userId)),
                    getDoc(doc(db, 'services', serviceId)),
                    getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                ];

                if (technicianId && technicianId !== 'auto-assign') {
                    promises.push(getDoc(doc(db, 'technicians', technicianId)));
                }

                const results = await Promise.all(promises);
                const customerSnap = results[0];
                const serviceSnap = results[1];
                const couponsSnapshot = results[2];
                const technicianSnap = results.length > 3 ? results[3] : null;

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.fullName || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap.exists()) setService({ id: serviceSnap.id, ...serviceSnap.data() } as Service);

                if (technicianId === 'auto-assign') {
                    setTechnician({ firstName: 'ระบบจัดให้อัตโนมัติ', lastName: '', id: 'auto-assign' });
                } else if (technicianSnap && technicianSnap.exists()) {
                    setTechnician({ id: technicianSnap.id, ...technicianSnap.data() } as TechnicianInfo & { id: string });
                }

                setAvailableCoupons(couponsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [liffLoading, profile?.userId, serviceId, technicianId]);

    const { basePrice, addOnsTotal, totalPrice, finalPrice, discount, selectedArea, selectedPackage, totalDuration } = useMemo(() => {
        if (!service) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, finalPrice: 0, discount: 0, selectedArea: null, selectedPackage: null, totalDuration: 0 };

        let base = service.price || 0;
        let duration = service.duration || 0;
        let selectedAreaData: MultiArea | null = null;
        let selectedPackageData: ServiceOption | null = null;

        // 1. Multi-Area Logic
        if (service.serviceType === 'multi-area' && service.areas && service.areas.length > 0) {
            if (areaIndex !== null && service.areas[areaIndex]) {
                selectedAreaData = service.areas[areaIndex];
                base = selectedAreaData.price || 0;
                duration = selectedAreaData.duration || 0;

                if (packageIndex !== null && selectedAreaData.packages && selectedAreaData.packages[packageIndex]) {
                    selectedPackageData = selectedAreaData.packages[packageIndex];
                    base = selectedPackageData.price || 0;
                    duration = selectedPackageData.duration || 0;
                }
            }
        }
        // 2. Option-Based Logic
        else if (service.serviceType === 'option-based') {
            let unitPrice = selectedOptionPrice;
            let unitDuration = selectedOptionDuration;

            if (selectedOptionName && service.serviceOptions) {
                const option = service.serviceOptions.find(o => o.name === selectedOptionName);
                if (option) {
                    unitPrice = option.price;
                    unitDuration = option.duration;
                }
            }

            const areaCount = Math.max(1, selectedAreas.length);
            base = unitPrice * areaCount;
            duration = unitDuration * areaCount;
        }
        // 3. Area-Based-Options Logic
        else if (service.serviceType === 'area-based-options') {
            base = 0;
            duration = 0;
            Object.entries(selectedAreaOptions).forEach(([areaName, optIdx]) => {
                const optIndex = optIdx as number;
                const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                if (areaGroup && areaGroup.options[optIndex]) {
                    base += Number(areaGroup.options[optIndex].price) || 0;
                    duration += Number(areaGroup.options[optIndex].duration) || 0;
                }
            });
        }

        const addOnsPrice = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.price || 0), 0);
        const addOnsDuration = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0);
        const total = base + addOnsPrice;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);

        let discountAmount = 0;
        if (selectedCoupon) {
            discountAmount = selectedCoupon.discountType === 'percentage' ? Math.round(total * (selectedCoupon.discountValue / 100)) : selectedCoupon.discountValue;
            discountAmount = Math.min(discountAmount, total);
        }

        return {
            basePrice: base,
            addOnsTotal: addOnsPrice,
            totalPrice: total,
            finalPrice: Math.max(0, total - discountAmount),
            discount: discountAmount,
            selectedArea: selectedAreaData,
            selectedPackage: selectedPackageData,
            totalDuration: duration + addOnsDuration
        };
    }, [service, selectedAddOns, selectedCouponId, availableCoupons, areaIndex, packageIndex, selectedOptionName, selectedOptionPrice, selectedOptionDuration, selectedAreas, selectedAreaOptions]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const fullNameInput = document.querySelector('input[name="fullName"]') as HTMLInputElement;
        const phoneInput = document.querySelector('input[name="phone"]') as HTMLInputElement;

        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์", "warning");
            if (!formData.fullName && fullNameInput) fullNameInput.focus();
            else if (!formData.phone && phoneInput) phoneInput.focus();
            return;
        }

        if (liffLoading || !profile?.userId) {
            showToast('กรุณาเข้าสู่ระบบก่อนทำการจอง', "warning");
            return;
        }

        if (!service) return;

        setIsSubmitting(true);
        try {
            const appointmentData = {
                userId: profile.userId,
                userInfo: { displayName: profile.displayName || '', pictureUrl: profile.pictureUrl || '' },
                status: 'awaiting_confirmation',
                customerInfo: {
                    ...formData,
                    pictureUrl: profile.pictureUrl || ''
                },
                serviceInfo: {
                    id: serviceId,
                    name: service.serviceName,
                    imageUrl: service.imageUrl || '',
                    serviceType: service.serviceType,
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                    selectedAreaOptions: Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                        const optIndex = optIdx as number;
                        const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                        const opt = areaGroup?.options[optIndex];
                        return {
                            areaName,
                            optionName: opt?.name,
                            price: opt?.price,
                            duration: opt?.duration
                        };
                    })
                },
                date: date,
                time: time,
                serviceId: serviceId,
                technicianId: technicianId,
                appointmentInfo: {
                    technicianId: technicianId,
                    employeeId: technicianId,
                    technicianInfo: { firstName: technician?.firstName, lastName: technician?.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)),
                    duration: totalDuration,
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                    selectedAreaOptions: Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                        const optIndex = optIdx as number;
                        const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                        const opt = areaGroup?.options[optIndex];
                        return {
                            areaName,
                            optionName: opt?.name,
                            price: opt?.price,
                            duration: opt?.duration
                        };
                    })
                },
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: finalPrice,
                    discount: discount,
                    couponId: selectedCouponId || null,
                    couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                    paymentStatus: 'unpaid',
                },
            };

            const lineAccessToken = liff?.getAccessToken?.();
            const result = await createAppointmentWithSlotCheck(appointmentData, { lineAccessToken });

            if (!result.success) {
                showToast(typeof result.error === 'string' ? result.error : "เกิดข้อผิดพลาด", "error");
                setIsSubmitting(false);
                return;
            }

            // Send Flex Message via liff.sendMessages()
            if (liff && typeof liff.sendMessages === 'function') {
                try {
                    const { flexMessage } = await getNewBookingFlexJson({
                        appointmentId: result.id!,
                        serviceName: service.serviceName || service.id || 'บริการ',
                        date: date!,
                        time: time!,
                        customerName: formData.fullName,
                        totalPrice: finalPrice,
                        addOns: (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).map(a => ({ name: a.name, price: a.price || 0 })),
                        couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                        discount: discount,
                    });
                    await liff.sendMessages([flexMessage]);
                } catch (flexErr) {
                    console.warn('liff.sendMessages failed (non-critical):', flexErr);
                }
            }

            showToast('จองสำเร็จ! กำลังพาไปหน้านัดหมาย', "success");
            router.push('/my-appointments');

        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                <p className="text-xs text-[#8d6e63] mt-3 font-medium">กำลังเตรียมข้อมูลการจอง...</p>
            </div>
        );
    }

    const currency = shopProfile?.currencySymbol || '฿';

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <CustomerHeader showBackButton={true} showActionButtons={false} backUrl="/appointment/select-date-time" />
            
            <div className="w-full max-w-md mx-auto px-4 py-4 pb-36 space-y-4">
                
                {/* Step indicator */}
                <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold text-[#5d4037] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#5d4037] text-white flex items-center justify-center text-[11px] font-bold">3</span>
                        ตรวจสอบข้อมูลและยืนยัน
                    </span>
                    <span className="text-[#8d6e63]">ขั้นตอน 3 จาก 3</span>
                </div>

                {/* Booking Summary Card */}
                <div className="bg-white rounded-3xl p-5 border border-[#e7e0da] shadow-sm space-y-3.5">
                    
                    {/* Date, Time & Provider */}
                    <div className="bg-[#faf8f5] p-3.5 rounded-2xl border border-[#e7e0da]/70 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-[#e7e0da] flex items-center justify-center text-[#5d4037] shadow-xs">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-[#3e2723]">
                                    {date ? format(new Date(date), 'd MMMM yyyy', { locale: th }) : '-'}
                                </div>
                                <div className="text-xs text-[#8d6e63] font-medium mt-0.5">
                                    รอบเวลา {time} น. • รวม {totalDuration} นาที
                                </div>
                            </div>
                        </div>

                        {technician && (
                            <div className="text-right">
                                <div className="text-[10px] text-[#8d6e63]">ผู้ให้บริการ</div>
                                <div className="text-xs font-semibold text-[#5d4037]">
                                    {technician.firstName}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Service Details */}
                    <div className="pt-1 space-y-2">
                        <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                                <div className="text-sm font-bold text-[#3e2723]">{service?.serviceName}</div>

                                {/* Multi-Area Display */}
                                {selectedArea && (
                                    <span className="inline-block text-[11px] bg-[#f5f0eb] text-[#5d4037] px-2 py-0.5 rounded-md font-medium mt-1 mr-1">
                                        {selectedArea.name}
                                    </span>
                                )}
                                {selectedPackage && (
                                    <span className="inline-block text-[11px] bg-[#f5f0eb] text-[#5d4037] px-2 py-0.5 rounded-md font-medium mt-1">
                                        {selectedPackage.name}
                                    </span>
                                )}

                                {/* Option-Based Display */}
                                {service?.serviceType === 'option-based' && (
                                    <div className="mt-1 text-xs text-[#5d4037]">
                                        <span className="font-semibold">{selectedOptionName}</span>
                                        <span className="text-[#8d6e63] ml-1">x {selectedAreas.length} จุด</span>
                                        {selectedAreas.length > 0 && (
                                            <div className="text-[11px] text-[#8d6e63] mt-0.5">
                                                ({selectedAreas.join(', ')})
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Area-Based-Options Display */}
                                {service?.serviceType === 'area-based-options' && Object.keys(selectedAreaOptions).length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                        {Object.entries(selectedAreaOptions).map(([areaName, optIdx]) => {
                                            const optIndex = optIdx as number;
                                            const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                                            const opt = areaGroup?.options[optIndex];
                                            if (!opt) return null;
                                            return (
                                                <div key={areaName} className="text-[11px] text-[#5d4037] flex justify-between">
                                                    <span>• {areaName} ({opt.name})</span>
                                                    <span className="text-[#8d6e63]">{Number(opt.price).toLocaleString()} {currency}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-bold text-[#3e2723] flex-shrink-0">
                                {basePrice.toLocaleString()} {currency}
                            </span>
                        </div>

                        {/* Add-ons List */}
                        {selectedAddOns.length > 0 && (
                            <div className="pt-2 border-t border-[#e7e0da]/60">
                                <div className="text-xs font-semibold text-[#8d6e63] mb-1">บริการเสริมที่เลือก:</div>
                                {(service?.addOnServices || [])
                                    .filter(a => selectedAddOns.includes(a.name))
                                    .map((addon, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs py-0.5 text-[#5d4037]">
                                            <span>+ {addon.name} ({addon.duration} นาที)</span>
                                            <span className="font-medium">{addon.price?.toLocaleString()} {currency}</span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Coupon Section */}
                    {availableCoupons.length > 0 && (
                        <div className="pt-2 border-t border-[#e7e0da]/60">
                            <button
                                type="button"
                                onClick={() => setShowCoupon(!showCoupon)}
                                className="flex items-center justify-between w-full text-xs font-bold text-[#5d4037] py-1 hover:text-[#4a3429]"
                            >
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                    </svg>
                                    ใช้คูปองส่วนลด ({availableCoupons.length} ใบที่ใช้ได้)
                                </span>
                                <span className="text-xs font-medium text-[#8d6e63] flex items-center gap-1">
                                    {selectedCouponId ? 'เลือกแล้ว 1 ใบ' : 'เลือกคูปอง'}
                                    <svg className={`w-3.5 h-3.5 transform transition-transform ${showCoupon ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </span>
                            </button>

                            {showCoupon && (
                                <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-[#e7e0da]">
                                    <label className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                                        selectedCouponId === ''
                                            ? 'bg-[#5d4037]/5 border-[#5d4037] text-[#3e2723] font-semibold'
                                            : 'bg-white border-[#e7e0da] text-gray-600 hover:bg-[#faf8f5]'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="coupon"
                                                value=""
                                                checked={selectedCouponId === ''}
                                                onChange={(e) => setSelectedCouponId(e.target.value)}
                                                className="text-[#5d4037] focus:ring-[#5d4037]"
                                            />
                                            <span>ไม่ใช้คูปอง</span>
                                        </div>
                                    </label>

                                    {availableCoupons.map(coupon => (
                                        <label
                                            key={coupon.id}
                                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                                                selectedCouponId === coupon.id
                                                    ? 'bg-amber-50/70 border-amber-500/60 text-[#3e2723] font-semibold ring-1 ring-amber-500/30'
                                                    : 'bg-white border-[#e7e0da] text-gray-700 hover:bg-[#faf8f5]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="coupon"
                                                    value={coupon.id}
                                                    checked={selectedCouponId === coupon.id}
                                                    onChange={(e) => setSelectedCouponId(e.target.value)}
                                                    className="text-[#5d4037] focus:ring-[#5d4037]"
                                                />
                                                <span>{coupon.name}</span>
                                            </div>
                                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                                ลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} ${currency}`}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price Breakdown Footer */}
                    <div className="pt-3 border-t border-[#e7e0da] space-y-1.5 text-xs">
                        <div className="flex justify-between text-[#8d6e63]">
                            <span>ค่าบริการหลัก</span>
                            <span>{basePrice.toLocaleString()} {currency}</span>
                        </div>
                        {addOnsTotal > 0 && (
                            <div className="flex justify-between text-[#8d6e63]">
                                <span>บริการเสริม</span>
                                <span>+{addOnsTotal.toLocaleString()} {currency}</span>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="flex justify-between text-emerald-700 font-medium">
                                <span>ส่วนลดคูปอง</span>
                                <span>-{discount.toLocaleString()} {currency}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline pt-2 border-t border-[#e7e0da]/60">
                            <span className="font-bold text-sm text-[#3e2723]">ยอดชำระสุทธิ</span>
                            <span className="font-black text-xl text-[#5d4037]">
                                {finalPrice.toLocaleString()} {currency}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Customer Information Form Card */}
                <div className="bg-white rounded-3xl p-5 border border-[#e7e0da] shadow-sm">
                    <h2 className="text-sm font-bold text-[#3e2723] pb-3 border-b border-[#e7e0da] flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        ข้อมูลผู้รับบริการ
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-3.5 mt-3.5">
                        <div>
                            <label className="block text-xs font-semibold text-[#4a3429] mb-1.5">
                                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e7e0da] text-xs font-medium focus:outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#5d4037]/20 bg-[#faf8f5]/50 transition-all text-[#3e2723]"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#4a3429] mb-1.5">
                                เบอร์โทรศัพท์ติดต่อ <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e7e0da] text-xs font-medium focus:outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#5d4037]/20 bg-[#faf8f5]/50 transition-all text-[#3e2723]"
                                placeholder="เช่น 0812345678"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#4a3429] mb-1.5">
                                อีเมล <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e7e0da] text-xs font-medium focus:outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#5d4037]/20 bg-[#faf8f5]/50 transition-all text-[#3e2723]"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#4a3429] mb-1.5">
                                ข้อความหรือคำขอพิเศษ <span className="text-gray-400 font-normal">(ถ้ามี)</span>
                            </label>
                            <textarea
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e7e0da] text-xs font-medium focus:outline-none focus:border-[#5d4037] focus:ring-2 focus:ring-[#5d4037]/20 bg-[#faf8f5]/50 resize-none transition-all text-[#3e2723]"
                                placeholder="เช่น แจ้งอาการแพ้ ระดับน้ำหนักนวดที่ชอบ หรือข้อจำกัดร่างกาย"
                            />
                        </div>
                    </form>
                </div>
            </div>

            {/* Sticky Floating Bottom Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#e7e0da] pb-[env(safe-area-inset-bottom,16px)] pt-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                <div className="max-w-md mx-auto px-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[#8d6e63] font-medium">ยอดชำระสุทธิ</div>
                        <div className="text-xl font-black text-[#5d4037] tracking-tight">
                            {finalPrice.toLocaleString()} {currency}
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-[#5d4037] hover:bg-[#4a3429] active:scale-[0.98] text-white px-7 py-3 rounded-2xl font-bold text-sm shadow-md shadow-[#5d4037]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                    >
                        {isSubmitting ? (
                            <>
                                <SpaFlowerIcon className="w-4 h-4 animate-spin" color="#ffffff" />
                                <span>กำลังจอง...</span>
                            </>
                        ) : (
                            <>
                                <span>ยืนยันการนัดหมาย</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GeneralInfoPage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                    <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                </div>
            }
        >
            <GeneralInfoContent />
        </Suspense>
    );
}
