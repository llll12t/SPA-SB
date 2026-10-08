"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, limit, startAfter, where, DocumentData, QueryDocumentSnapshot } from '@/app/lib/supabaseDb';

const ITEMS_PER_PAGE = 20;

// --- Icons ---
const Icons = {
    Star: ({ filled, className = "w-4 h-4" }: { filled: boolean; className?: string }) => (
        <svg className={`${className} ${filled ? 'text-amber-400 fill-amber-400' : 'text-stone-200 fill-stone-200'}`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.363 2.44a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.362-2.44a1 1 0 00-1.176 0l-3.362-2.44c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.39c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69L9.049 2.927z" />
        </svg>
    ),
    Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Message: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    Loader: () => <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
    Sparkles: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    Quote: () => <svg className="w-3.5 h-3.5 text-stone-300" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>,
};

// --- Star Rating Component ---
const StarRating = ({ rating, size = "w-3.5 h-3.5" }: { rating: number; size?: string }) => (
    <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
            <Icons.Star key={star} filled={rating >= star} className={size} />
        ))}
    </div>
);

// --- Review Summary Component ---
const ReviewSummary = ({ stats }: { stats: any }) => {
    if (!stats || stats.total === 0) return null;
    return (
        <div className="bg-white border border-[#e7e0da] rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Overall Score */}
                <div className="flex flex-col items-center justify-center min-w-[140px] text-center border-b md:border-b-0 md:border-r border-[#f0eae4] pb-4 md:pb-0 md:pr-6">
                    <div className="text-4xl font-extrabold text-[#3e2723] font-mono tabular-nums tracking-tight">
                        {stats.average}
                    </div>
                    <div className="flex my-2">
                        <StarRating rating={Math.round(Number(stats.average))} size="w-4 h-4" />
                    </div>
                    <div className="text-xs text-stone-500 font-medium">
                        จากทั้งหมด <span className="font-semibold text-[#5d4037] tabular-nums">{stats.total}</span> รีวิว
                    </div>
                </div>

                {/* Rating Distribution Bars */}
                <div className="flex-1 w-full space-y-2">
                    {stats.distribution.map((item: any) => (
                        <div key={item.star} className="flex items-center gap-3 text-xs">
                            <div className="w-10 font-semibold text-stone-600 flex items-center gap-1 font-mono tabular-nums">
                                {item.star} <span className="text-amber-400">★</span>
                            </div>
                            <div className="flex-1 h-2.5 bg-[#f0eae4] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                                    style={{ width: `${item.percentage}%` }}
                                ></div>
                            </div>
                            <div className="w-12 text-right text-stone-500 font-mono tabular-nums text-[11px]">
                                {item.count} ครั้ง
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [ratingFilter, setRatingFilter] = useState<string | number>('all');
    const [search, setSearch] = useState('');

    // Fetch summary stats once
    const fetchStats = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, 'reviews'));
            const allReviews = snap.docs.map(d => d.data());
            const total = allReviews.length;
            const average = total > 0 ? (allReviews.reduce((acc, r: any) => acc + (r.rating || 0), 0) / total).toFixed(1) : '5.0';
            const distribution = [5, 4, 3, 2, 1].map(star => {
                const count = allReviews.filter((r: any) => r.rating === star).length;
                return { star, count, percentage: total > 0 ? (count / total) * 100 : 0 };
            });
            setStats({ total, average, distribution });
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }, []);

    // Fetch reviews with pagination
    const fetchReviews = useCallback(async (isLoadMore = false) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            let q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));

            if (ratingFilter !== 'all') {
                q = query(collection(db, 'reviews'), where('rating', '==', Number(ratingFilter)), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
            }

            if (isLoadMore && lastDoc) {
                if (ratingFilter !== 'all') {
                    q = query(collection(db, 'reviews'), where('rating', '==', Number(ratingFilter)), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(ITEMS_PER_PAGE));
                } else {
                    q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(ITEMS_PER_PAGE));
                }
            }

            const snap = await getDocs(q);
            const newReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (isLoadMore) {
                setReviews(prev => [...prev, ...newReviews]);
            } else {
                setReviews(newReviews);
            }

            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === ITEMS_PER_PAGE);
        } catch (err) {
            console.error("Error fetching reviews:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [ratingFilter, lastDoc]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        setLastDoc(null);
        setHasMore(true);
        fetchReviews(false);
    }, [ratingFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    // Client-side search filter
    const filteredReviews = useMemo(() => {
        if (!search.trim()) return reviews;
        const q = search.trim().toLowerCase();
        return reviews.filter(r =>
            (r.customerName || '').toLowerCase().includes(q) ||
            (r.comment || '').toLowerCase().includes(q) ||
            (r.serviceName || '').toLowerCase().includes(q) ||
            (r.technicianName || '').toLowerCase().includes(q)
        );
    }, [reviews, search]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) fetchReviews(true);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* 1. Frameless Operations Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>ความพึงพอใจลูกค้า</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">รีวิวและความคิดเห็น</h1>
                        {stats && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#efebe9] text-[#5d4037] tabular-nums">
                                {stats.total} รีวิว
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Review Summary Card */}
            <ReviewSummary stats={stats} />

            {/* 3. Search & Filter Matrix */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-[#e7e0da] shadow-sm">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                        <Icons.Search />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อลูกค้า, ข้อความรีวิว หรือชื่อบริการ..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-[#faf8f5] border border-[#e7e0da] rounded-lg text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#5d4037] transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Rating Filter Pills */}
                <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-lg border border-[#f0eae4] overflow-x-auto">
                    <button
                        onClick={() => setRatingFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                            ratingFilter === 'all'
                                ? 'bg-[#5d4037] text-white shadow-xs'
                                : 'text-stone-600 hover:text-[#3e2723] hover:bg-white/60'
                        }`}
                    >
                        ทั้งหมด
                    </button>
                    {[5, 4, 3, 2, 1].map(star => (
                        <button
                            key={star}
                            onClick={() => setRatingFilter(star)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                                ratingFilter === star
                                    ? 'bg-[#5d4037] text-white shadow-xs'
                                    : 'text-stone-600 hover:text-[#3e2723] hover:bg-white/60'
                            }`}
                        >
                            <span>{star}</span>
                            <span className="text-amber-400">★</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                    <p className="text-xs text-stone-500 mt-3 font-medium">กำลังโหลดข้อมูลรีวิว...</p>
                </div>
            ) : filteredReviews.length > 0 ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {filteredReviews.map(review => (
                            <div
                                key={review.id}
                                className="group bg-white border border-[#e7e0da] hover:border-[#5d4037]/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-full bg-[#faf6f0] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-bold text-xs flex-shrink-0">
                                                {review.customerName ? review.customerName.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#3e2723] text-sm group-hover:text-[#5d4037] transition-colors">
                                                    {review.customerName || 'ลูกค้าไม่ระบุชื่อ'}
                                                </p>
                                                <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                                                    {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-[#faf6f0] px-2 py-0.5 rounded-md border border-[#e7e0da]">
                                            <StarRating rating={review.rating} />
                                        </div>
                                    </div>

                                    {/* Comment */}
                                    <div className="mb-3 pl-2 border-l-2 border-[#d7ccc8] min-h-[40px]">
                                        <p className="text-stone-700 text-xs leading-relaxed italic">
                                            "{review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}"
                                        </p>
                                    </div>
                                </div>

                                {/* Service and Technician Chips */}
                                <div className="border-t border-[#f0eae4] pt-2.5 mt-auto space-y-1 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-stone-400">บริการ:</span>
                                        <span className="font-semibold text-[#3e2723] text-[11px] truncate max-w-[170px]">
                                            {review.serviceName || '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-stone-400">ช่าง:</span>
                                        <span className="font-medium text-[#5d4037] text-[11px] truncate max-w-[170px]">
                                            {review.technicianName || '-'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {hasMore && !search && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-[#5d4037] bg-white border border-[#d7ccc8] hover:bg-[#efebe9] transition-colors shadow-2xs disabled:opacity-50"
                            >
                                {loadingMore ? (
                                    <>
                                        <Icons.Loader />
                                        <span>กำลังโหลด...</span>
                                    </>
                                ) : (
                                    `โหลดรีวิวเพิ่มเติม (+${ITEMS_PER_PAGE} รายการ)`
                                )}
                            </button>
                        </div>
                    )}

                    <div className="text-center text-xs text-stone-400 mt-2 font-mono tabular-nums">
                        แสดง {filteredReviews.length} รายการ {stats?.total ? `จากทั้งหมด ${stats.total} รีวิว` : ''}
                    </div>
                </>
            ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-14 h-14 rounded-full bg-[#faf8f5] text-[#8d6e63] flex items-center justify-center mx-auto mb-3 border border-[#f0eae4]">
                        <Icons.Message />
                    </div>
                    <h3 className="text-sm font-semibold text-[#3e2723]">ไม่พบข้อมูลรีวิว</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        {search ? `ไม่พบรีวิวที่ตรงกับ "${search}" ลองค้นหาด้วยคำอื่น` : 'ยังไม่มีรีวิวตามระดับดาวที่เลือก'}
                    </p>
                </div>
            )}
        </div>
    );
}
