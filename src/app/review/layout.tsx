"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { ReactNode } from 'react';

function ReviewHeader() {
    const { profile, loading, error } = useLiffContext();

    if (loading) {
        return (
            <div className="p-4">
                <div className="bg-white rounded-2xl border border-[#e7e0da] p-3.5 flex items-center gap-3.5 shadow-2xs">
                    <div className="w-10 h-10 rounded-full bg-[#f5f2ed] animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-[#f5f2ed] rounded w-1/4 animate-pulse" />
                        <div className="h-4 bg-[#f5f2ed] rounded w-1/2 animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                        <span>⚠️ การเชื่อมต่อ LINE ไม่สมบูรณ์</span>
                    </div>
                    <p className="text-amber-700">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 pb-2">
            <header className="bg-white rounded-2xl border border-[#e7e0da] p-3.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                    {profile?.pictureUrl ? (
                        <Image
                            src={profile.pictureUrl}
                            width={40}
                            height={40}
                            alt="Profile"
                            className="w-10 h-10 rounded-full border border-[#d7ccc8] object-cover shrink-0"
                            unoptimized
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-[#f5f2ed] text-[#5d4037] font-bold flex items-center justify-center shrink-0 text-sm border border-[#d7ccc8]/70">
                            {(profile?.displayName || 'ลูกค้า').charAt(0)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[#8d6e63]">แบบประเมินความพึงพอใจ</div>
                        <h2 className="font-bold text-sm text-[#3e2723] truncate">คุณ{profile?.displayName || 'ลูกค้า'}</h2>
                    </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border bg-[#f5f2ed] text-[#5d4037] border-[#d7ccc8] shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5d4037]" />
                    <span>รีวิวบริการ</span>
                </span>
            </header>
        </div>
    );
}

export default function ReviewLayout({ children }: { children: ReactNode }) {
    const reviewLiffId = process.env.NEXT_PUBLIC_LIFF_ID;

    return (
        <LiffProvider liffId={reviewLiffId}>
            <div className="max-w-md mx-auto bg-[#faf8f5] min-h-screen">
                <ReviewHeader />
                <main className="p-4 pt-2">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}
