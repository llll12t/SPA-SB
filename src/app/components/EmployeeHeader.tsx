"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function EmployeeHeader({ showBackButton = false }: { showBackButton?: boolean }) {
    const { profile, loading, error } = useLiffContext();
    const router = useRouter();

    if (loading) {
        return (
            <header className="bg-white/90 backdrop-blur-md border-b border-[#e7e0da] sticky top-0 z-40">
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[#f0eae4]" />
                    <div className="flex-1 space-y-1">
                        <div className="h-3 bg-[#f0eae4] rounded w-16" />
                        <div className="h-4 bg-[#f0eae4] rounded w-28" />
                    </div>
                </div>
            </header>
        );
    }

    if (error) {
        return (
            <header className="bg-rose-50 border-b border-rose-100 sticky top-0 z-40">
                <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
                    <p className="text-rose-700 text-xs font-semibold">
                        <strong>ข้อผิดพลาด:</strong> {error}
                    </p>
                </div>
            </header>
        );
    }

    return (
        <header className="bg-white/95 backdrop-blur-md border-b border-[#e7e0da] sticky top-0 z-40 shadow-xs transition-colors">
            <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {showBackButton && (
                        <button
                            onClick={() => router.back()}
                            className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-[#5d4037] hover:bg-[#f5f2ed] border border-[#e7e0da] transition-all active:scale-95 shrink-0"
                            aria-label="ย้อนกลับ"
                        >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    {profile?.pictureUrl ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#d7ccc8] shrink-0 bg-[#faf8f5]">
                            <Image
                                src={profile.pictureUrl}
                                width={40}
                                height={40}
                                alt="Profile"
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-[#f5f2ed] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-bold text-sm shrink-0">
                            {profile?.displayName?.slice(0, 1) || 'พ'}
                        </div>
                    )}

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5d4037] bg-[#f5f2ed] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                                พนักงานบริการ
                            </span>
                        </div>
                        <p className="font-bold text-sm text-[#3e2723] truncate mt-0.5">
                            {profile?.displayName || 'ผู้ใช้งาน LINE'}
                        </p>
                    </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>ออนไลน์</span>
                </div>
            </div>
        </header>
    );
}
