"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot, db } from '@/app/lib/supabaseDb';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import CustomerHeader from '@/app/components/CustomerHeader';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

interface Coupon {
    id: string;
    name: string;
    description?: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    redeemedAt?: any;
    used?: boolean;
    usedAt?: any;
    appointmentId?: string;
}

const CouponCard = ({ coupon }: { coupon: Coupon }) => {
    const { profile } = useProfile();
    const currency = profile?.currencySymbol || '฿';
    const isUsed = coupon.used;
    const redeemedDate = coupon.redeemedAt && typeof coupon.redeemedAt.toDate === 'function'
        ? coupon.redeemedAt.toDate()
        : new Date();

    return (
        <div className={`relative overflow-hidden rounded-3xl p-4 transition-all border ${
            isUsed
                ? 'bg-white/80 border-[#e7e0da] opacity-65'
                : 'bg-gradient-to-r from-[#5d4037] via-[#4a3429] to-[#3e2723] text-white border-[#5d4037] shadow-sm hover:shadow-md'
        }`}>
            {/* Cutout notches for ticket look */}
            <div className="absolute -left-3 top-1/2 w-6 h-6 rounded-full bg-[#faf8f5] border-r border-[#e7e0da] transform -translate-y-1/2 z-20"></div>
            <div className="absolute -right-3 top-1/2 w-6 h-6 rounded-full bg-[#faf8f5] border-l border-[#e7e0da] transform -translate-y-1/2 z-20"></div>

            {/* Background flower watermark */}
            {!isUsed && (
                <div className="absolute top-[-25px] right-[-15px] opacity-10 pointer-events-none">
                    <SpaFlowerIcon className="w-28 h-28" color="#ffffff" />
                </div>
            )}

            <div className="relative z-10 px-2">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                    <h3 className={`font-bold text-sm ${isUsed ? 'text-[#3e2723]' : 'text-white'}`}>
                        {coupon.name}
                    </h3>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        isUsed
                            ? 'bg-gray-100 text-gray-500 border border-gray-200'
                            : 'bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-xs'
                    }`}>
                        {isUsed ? 'ใช้แล้ว' : 'พร้อมใช้งาน'}
                    </span>
                </div>

                {coupon.description && (
                    <p className={`text-xs leading-relaxed ${isUsed ? 'text-[#8d6e63]' : 'text-[#d7ccc8]'}`}>
                        {coupon.description}
                    </p>
                )}

                {/* Perforation line */}
                <div className={`border-t border-dashed my-3 ${isUsed ? 'border-gray-300' : 'border-white/20'}`}></div>

                <div className="flex justify-between items-center text-xs">
                    <span className={isUsed ? 'text-gray-400' : 'text-[#faf8f5]/80'}>
                        แลกเมื่อ: {redeemedDate ? format(redeemedDate, 'd MMM yyyy', { locale: th }) : '-'}
                    </span>
                    {!isUsed && (
                        <span className="font-extrabold text-amber-300 text-sm">
                            ส่วนลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue} ${currency}`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function MyCouponsPage() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!liffLoading && profile?.userId) {
            const couponsRef = collection(db, 'customers', profile.userId, 'coupons');
            const q = query(couponsRef, orderBy('redeemedAt', 'desc'));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
                setCoupons(couponsData);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching coupons:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } else if (!liffLoading) {
            setLoading(false);
        }
    }, [profile, liffLoading]);

    const availableCoupons = coupons.filter(c => !c.used);
    const usedCoupons = coupons.filter(c => c.used).slice(0, 10);

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <CustomerHeader showBackButton={true} title="คูปองส่วนลดของฉัน" backUrl="/appointment" />
            
            <div className="w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
                
                {/* Top Action Bar */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-sm font-bold text-[#3e2723]">คูปองทั้งหมด</h2>
                        <p className="text-xs text-[#8d6e63]">ใช้เป็นส่วนลดในการจองบริการ</p>
                    </div>

                    <button
                        onClick={() => router.push('/rewards')}
                        className="bg-[#5d4037] hover:bg-[#4a3429] active:scale-95 text-white font-bold py-2 px-3.5 rounded-2xl shadow-sm text-xs transition-all flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        <span>แลกคูปองเพิ่ม</span>
                    </button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <SpaFlowerIcon className="w-10 h-10 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                            <p className="text-xs text-[#8d6e63] mt-2 font-medium">กำลังโหลดคูปอง...</p>
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-white rounded-3xl border border-[#e7e0da] shadow-sm">
                            <div className="w-14 h-14 bg-[#faf8f5] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#e7e0da]">
                                <svg className="w-7 h-7 text-[#8d6e63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-sm text-[#3e2723]">ยังไม่มีคูปองส่วนลด</h3>
                            <p className="text-xs text-[#8d6e63] mt-1 max-w-xs mx-auto">
                                สะสมคะแนนจากการเข้ารับบริการ แล้วนำคะแนนมาแลกรับคูปองส่วนลดสุดคุ้มได้ที่นี่
                            </p>
                            <button
                                onClick={() => router.push('/rewards')}
                                className="mt-4 px-6 py-2.5 rounded-2xl text-xs font-bold bg-[#5d4037] text-white hover:bg-[#4a3429] shadow-sm shadow-[#5d4037]/20 transition-all active:scale-95"
                            >
                                ไปยังหน้าแลกรางวัล
                            </button>
                        </div>
                    ) : (
                        <>
                            {availableCoupons.length > 0 && (
                                <div className="space-y-2.5">
                                    <div className="text-xs font-bold text-[#3e2723] flex items-center gap-1.5 px-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <span>คูปองที่ใช้ได้ ({availableCoupons.length} ใบ)</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        {availableCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                    </div>
                                </div>
                            )}

                            {usedCoupons.length > 0 && (
                                <div className="space-y-2.5 pt-4">
                                    <div className="text-xs font-bold text-[#8d6e63] flex items-center gap-1.5 px-1">
                                        <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                                        <span>ประวัติคูปองที่ใช้แล้ว ({usedCoupons.length} ใบ)</span>
                                    </div>
                                    <div className="space-y-2">
                                        {usedCoupons.map(coupon => <CouponCard key={coupon.id} coupon={coupon} />)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
