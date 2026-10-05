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

export default function CustomerHeader({ showBackButton = false, showActionButtons = true, title, backUrl, fixed = false }: CustomerHeaderProps) {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const [customerData, setCustomerData] = useState<{ points?: number } | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);
    const [enablePointSystem, setEnablePointSystem] = useState<boolean>(true);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => { };

        if (!liffLoading && profile?.userId) {
            const customerRef = doc(db, "customers", profile.userId);
            unsubscribe = onSnapshot(customerRef, (snapshot) => {
                if (snapshot.exists()) {
                    setCustomerData(snapshot.data() as { points?: number });
                    setDbError(null);
                } else {
                    setCustomerData({ points: 0 });
                }
            }, (error) => {
                console.error("Firebase Error:", error);
                setDbError("เชื่อมต่อข้อมูลไม่สำเร็จ");
            });
        }

        return () => unsubscribe();
    }, [profile?.userId, liffLoading]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsRef = doc(db, "settings", "points");
                const snap = await getDoc(settingsRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setEnablePointSystem(data.enablePointSystem !== false);
                }
            } catch (e) {
                console.error("Error fetching point settings:", e);
            }
        };
        fetchSettings();
    }, []);

    const headerShellClass = fixed
        ? "fixed top-0 left-0 right-0 mx-auto w-full max-w-md bg-gradient-to-r from-[#5D4037] via-[#3E2723] to-[#1a0f0a] px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] text-white shadow-sm z-40 rounded-b-3xl"
        : "shrink-0 bg-gradient-to-r from-[#5D4037] via-[#3E2723] to-[#1a0f0a] px-6 pb-6 pt-6 text-white shadow-sm rounded-b-3xl";
    const loadingClass = fixed
        ? "fixed top-0 left-0 right-0 mx-auto z-40 h-[88px] w-full max-w-md animate-pulse bg-gradient-to-r from-[#5D4037] via-[#3E2723] to-[#1a0f0a] rounded-b-3xl"
        : "h-[88px] shrink-0 animate-pulse bg-gradient-to-r from-[#5D4037] via-[#3E2723] to-[#1a0f0a] rounded-b-3xl";

    if (liffLoading) return <div className={loadingClass} />;
    if (liffError) return null;

    return (
        <div className={headerShellClass} style={{ borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', overflow: 'hidden' }}>
            {title && (
                <div className="mb-4 flex items-center gap-2">
                    {showBackButton && (
                        <button
                            type="button"
                            onClick={() => backUrl ? router.push(backUrl) : router.back()}
                            className="-ml-1 p-1 text-white/85 hover:text-white"
                            aria-label="กลับ"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}
                    <h1 className="text-xl font-bold text-white">{title}</h1>
                </div>
            )}

            <header className="flex min-h-10 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    {!title && showBackButton && (
                        <button
                            type="button"
                            onClick={() => backUrl ? router.push(backUrl) : router.back()}
                            className="-ml-2 p-1 text-white/85 hover:text-white"
                            aria-label="กลับ"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                    )}

                    {profile?.pictureUrl ? (
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[#2a1a10] shadow-sm">
                            <img src={profile.pictureUrl} alt="Profile" className="h-full w-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-[#2a1a10] shadow-sm" />
                    )}

                    <div className="min-w-0">
                        <p className="text-xs font-normal leading-4 text-white/70">welcome</p>
                        <p className="truncate text-sm font-medium leading-5 text-white">
                            {shopProfile?.storeName || profile?.displayName || "SPA & MASSAGE"}
                        </p>
                        {dbError && <p className="mt-1 rounded bg-red-50 px-1 text-xs text-red-600">{dbError}</p>}
                    </div>
                </div>

                {enablePointSystem && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => router.push("/my-coupons")}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white shadow-sm transition-colors hover:bg-white/15"
                            aria-label="คูปองของฉัน"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" />
                                <path d="M13 5v14" />
                                <path d="M8 10h2" />
                                <path d="M8 14h2" />
                            </svg>
                        </button>
                        <div className="flex h-10 min-w-[105px] items-center justify-center rounded-full bg-white/10 px-4 text-center shadow-sm">
                            <span className="text-sm font-medium leading-none text-white">
                                {customerData?.points ?? 0} Point
                            </span>
                        </div>
                    </div>
                )}
            </header>

            {showActionButtons && (
                <div className="relative z-10 mt-5">
                    <button
                        type="button"
                        onClick={() => router.push("/appointment")}
                        className="w-full rounded-lg bg-white/10 py-3 text-base font-medium text-white shadow-sm transition-opacity hover:bg-white/15"
                    >
                        จองบริการ
                    </button>
                </div>
            )}
        </div>
    );
}
