"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, db } from '@/app/lib/supabaseDb';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';

interface CustomerHeaderProps {
    showBackButton?: boolean;
    showActionButtons?: boolean;
    title?: string;
    backUrl?: string;
    fixed?: boolean;
}

export default function CustomerHeader({
    showBackButton = false,
    showActionButtons = true,
    title,
    backUrl,
    fixed = false,
}: CustomerHeaderProps) {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const [customerData, setCustomerData] = useState<{ points?: number } | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [enablePointSystem, setEnablePointSystem] = useState<boolean>(true);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => {};

        if (!liffLoading && profile?.userId) {
            const customerRef = doc(db, 'customers', profile.userId);
            unsubscribe = onSnapshot(
                customerRef,
                (snapshot) => {
                    if (snapshot.exists()) {
                        setCustomerData(snapshot.data() as { points?: number });
                        setDbError(null);
                    } else {
                        setCustomerData({ points: 0 });
                    }
                },
                (error) => {
                    console.error('Customer fetch error:', error);
                    setDbError('เชื่อมต่อข้อมูลไม่สำเร็จ');
                }
            );
        }

        return () => unsubscribe();
    }, [profile?.userId, liffLoading]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'points');
                const snap = await getDoc(settingsRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setEnablePointSystem(data.enablePointSystem !== false);
                }
            } catch (e) {
                console.error('Error fetching point settings:', e);
            }
        };
        fetchSettings();
    }, []);

    const headerShellClass = fixed
        ? 'fixed top-0 left-0 right-0 mx-auto w-full max-w-md bg-gradient-to-br from-[#5d4037] via-[#4a3429] to-[#3e2723] px-4.5 pb-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-white shadow-md z-40 rounded-b-3xl'
        : 'sticky top-0 z-40 w-full bg-gradient-to-br from-[#5d4037] via-[#4a3429] to-[#3e2723] px-4.5 pb-3.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-white shadow-md rounded-b-3xl backdrop-blur-md';

    const loadingClass = fixed
        ? 'fixed top-0 left-0 right-0 mx-auto z-40 h-[76px] w-full max-w-md animate-pulse bg-gradient-to-r from-[#5d4037] to-[#3e2723] rounded-b-3xl'
        : 'sticky top-0 z-40 h-[76px] w-full shrink-0 animate-pulse bg-gradient-to-r from-[#5d4037] to-[#3e2723] rounded-b-3xl';

    if (liffLoading) return <div className={loadingClass} />;
    if (liffError) return null;

    return (
        <div
            className={headerShellClass}
            style={{ borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}
        >
            {/* Title Row if provided */}
            {title && (
                <div className="mb-3.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {showBackButton && (
                            <button
                                type="button"
                                onClick={() => (backUrl ? router.push(backUrl) : router.back())}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
                                aria-label="กลับ"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2.2}
                                    stroke="currentColor"
                                    className="h-4.5 w-4.5"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                        )}
                        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
                    </div>
                </div>
            )}

            {/* Main Header Row */}
            <header className="flex min-h-10 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    {!title && showBackButton && (
                        <button
                            type="button"
                            onClick={() => (backUrl ? router.push(backUrl) : router.back())}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 shrink-0"
                            aria-label="กลับ"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.2}
                                stroke="currentColor"
                                className="h-4.5 w-4.5"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}

                    {profile?.pictureUrl ? (
                        <div className="h-10.5 w-10.5 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 bg-[#2a1a10] shadow-xs">
                            <img src={profile.pictureUrl} alt="Profile" className="h-full w-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-10.5 w-10.5 shrink-0 rounded-full bg-white/15 ring-2 ring-white/20 flex items-center justify-center text-white font-bold text-sm">
                            {profile?.displayName?.slice(0, 1) || 'ล'}
                        </div>
                    )}

                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-wider text-amber-200/90 uppercase">
                            ยินดีต้อนรับ
                        </p>
                        <p className="truncate text-sm font-bold leading-snug text-white">
                            {shopProfile?.storeName || profile?.displayName || 'SPA & MASSAGE'}
                        </p>
                        {dbError && (
                            <p className="mt-0.5 rounded bg-rose-500/20 px-1 text-[10px] text-rose-200 font-medium">
                                {dbError}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right Action: Points and Coupons */}
                {enablePointSystem && (
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => router.push('/my-coupons')}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-white/95 shadow-xs transition-all hover:bg-white/20 active:scale-95"
                            aria-label="คูปองของฉัน"
                            title="คูปองของฉัน"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4.5 w-4.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
                                <path d="M13 5v14" strokeDasharray="3 3" />
                                <path d="M8 10h2" />
                                <path d="M8 14h2" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push('/rewards')}
                            className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-amber-600/35 border border-amber-300/30 px-3 text-center shadow-xs transition-all hover:bg-amber-500/35 active:scale-95"
                            title="แลกของรางวัล"
                        >
                            <span className="text-amber-300 text-xs font-bold">✦</span>
                            <span className="text-xs font-bold text-amber-100 font-mono tracking-tight">
                                {customerData?.points ?? 0}
                            </span>
                            <span className="text-[10px] text-amber-200/80 font-medium">แต้ม</span>
                        </button>
                    </div>
                )}
            </header>

            {/* Quick Action Button if requested */}
            {showActionButtons && (
                <div className="mt-4 pt-1">
                    <button
                        type="button"
                        onClick={() => router.push('/appointment')}
                        className="w-full h-11 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.99] border border-white/20 text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-2"
                    >
                        <span>จองคิวนัดหมายใหม่</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
