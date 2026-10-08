"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { submitReview } from '@/app/actions/reviewActions';
import { createReviewThankYouFlexTemplate } from '@/app/actions/flexTemplateActions';
import { db, doc, getDoc } from '@/app/lib/supabaseDb';

// Star Rating Component
const StarRating = ({ rating, setRating }: { rating: number, setRating: (val: number) => void }) => {
    return (
        <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`w-10 h-10 sm:w-12 sm:h-12 transition-colors ${rating >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-200'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0L7.07 7.56l-5.056.367c-.83.06-1.171 1.106-.536 
                        1.651l3.847 3.292-1.148 4.873c-.19.806.676 
                        1.44 1.374.995L10 15.347l4.45 2.39c.698.445 
                        1.563-.189 1.374-.995l-1.149-4.873 
                        3.847-3.292c.635-.545.294-1.591-.536-1.651L12.93 
                        7.56l-2.062-4.676z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>
            ))}
        </div>
    );
};

function ReviewContent() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [appointment, setAppointment] = useState<any | null>(null);

    const params = useParams();
    const searchParams = useSearchParams();
    const appointmentId = params?.appointmentId as string;

    useEffect(() => {
        // Try to get appointmentId from all possible sources
        let id = appointmentId;
        if (!id) {
            // Try searchParams (query string)
            id = searchParams.get('appointmentId') as string;
        }
        if (!id) {
            // Try liff.state (for LIFF deep link)
            const liffState = searchParams.get('liff.state');
            if (liffState) {
                const parts = liffState.split('/');
                if (parts.length > 2 && parts[1] === 'review') {
                    id = parts[2];
                }
            }
        }
        if (!id && typeof window !== 'undefined') {
            // Try to parse from window.location.pathname (for edge cases)
            const pathParts = window.location.pathname.split('/');
            const idx = pathParts.findIndex(p => p === 'review');
            if (idx !== -1 && pathParts.length > idx + 1) {
                id = pathParts[idx + 1];
            }
        }

        if (id) {
            const fetchAppointment = async () => {
                try {
                    const appointmentRef = doc(db, 'appointments', id);
                    const appointmentSnap = await getDoc(appointmentRef);
                    if (appointmentSnap.exists()) {
                        setAppointment({ id, ...appointmentSnap.data() });
                    } else {
                        setError('ไม่พบข้อมูลการนัดหมาย');
                    }
                } catch (err) {
                    console.error('Error fetching appointment:', err);
                    setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
                }
            };
            fetchAppointment();
        } else if (!liffLoading) {
            setError('ไม่พบ Appointment ID');
        }
    }, [appointmentId, searchParams, liffLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            setError('กรุณาให้คะแนนอย่างน้อย 1 ดาว');
            return;
        }

        if (!profile?.userId || !appointment) {
            setError('ไม่สามารถระบุตัวตนหรือข้อมูลการนัดหมายได้');
            return;
        }

        if (!liff) {
            setError('ไม่สามารถเชื่อมต่อ LINE ได้');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const reviewData = {
                appointmentId: appointment.id,
                userId: profile.userId,
                userName: profile.displayName,
                userPicture: profile.pictureUrl,
                rating,
                comment: comment.trim(),
                serviceId: appointment.serviceId,
                technicianId: appointment.technicianId,
                createdAt: new Date().toISOString()
            };

            const lineAccessToken = liff?.getAccessToken?.();
            const result = await submitReview(reviewData, { lineAccessToken });

            if (result.success) {
                setSuccess(true);

                // ส่งข้อความกลับ LINE OA
                if (liff.isInClient()) {
                    try {
                        // สร้าง Flex Message สำหรับขอบคุณหลังรีวิว
                        const reviewThankYouFlex = await createReviewThankYouFlexTemplate({
                            rating,
                            comment: comment.trim(),
                            appointmentId: appointment.id,
                            customerName: profile.displayName
                        });

                        await liff.sendMessages([reviewThankYouFlex]);
                    } catch (msgError) {
                        console.warn('ไม่สามารถส่งข้อความได้:', msgError);
                    }
                }

                // ปิด LIFF หลังจากสำเร็จ
                setTimeout(() => {
                    if (liff && liff.closeWindow) {
                        liff.closeWindow();
                    }
                }, 3000);
            } else {
                throw new Error(result.error || 'ไม่สามารถส่งรีวิวได้');
            }
        } catch (err: any) {
            console.error('Error submitting review:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการส่งรีวิว');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (liff && liff.closeWindow) {
            liff.closeWindow();
        }
    };

    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#d7ccc8] border-t-[#5d4037] mx-auto"></div>
                <p className="text-[#8d6e63] text-xs font-medium">กำลังโหลดข้อมูลการรีวิว...</p>
            </div>
        );
    }

    if (error && !appointment) {
        return (
            <div className="py-6">
                <div className="bg-white rounded-3xl border border-rose-200 p-6 text-center shadow-md space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto text-xl font-bold">
                        !
                    </div>
                    <h3 className="text-base font-bold text-[#3e2723]">เกิดข้อผิดพลาด</h3>
                    <p className="text-xs text-[#8d6e63]">{error}</p>
                    <button
                        onClick={handleCancel}
                        className="w-full h-10 bg-[#f5f2ed] hover:bg-[#ebdccc] text-[#5d4037] border border-[#d7ccc8] rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="py-6">
                <div className="bg-white rounded-3xl border border-[#e7e0da] shadow-md p-7 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] flex items-center justify-center mx-auto text-3xl shadow-2xs">
                        🎉
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-[#3e2723]">ขอบคุณสำหรับรีวิว!</h2>
                        <p className="text-xs text-[#8d6e63]">
                            ความคิดเห็นของคุณมีค่าและช่วยให้เราพัฒนาบริการให้ดียิ่งขึ้น
                        </p>
                    </div>

                    <div className="inline-flex items-center gap-1 bg-[#f5f2ed] px-3.5 py-1.5 rounded-full border border-[#d7ccc8] text-amber-500 text-lg">
                        {'★'.repeat(rating)}
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleCancel}
                            className="w-full h-10 bg-[#5d4037] hover:bg-[#3e2723] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
                        >
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-1 py-1">
                <h1 className="text-lg font-bold text-[#3e2723]">ประเมินความพึงพอใจการบริการ</h1>
                <p className="text-xs text-[#8d6e63]">ความคิดเห็นของคุณช่วยให้เราปรับปรุงคุณภาพบริการให้ดียิ่งขึ้น</p>
            </div>

            {/* Appointment Info Sub-card */}
            {appointment && (
                <div className="bg-white rounded-2xl border border-[#e7e0da] shadow-2xs p-4 space-y-2.5">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#e7e0da]">
                        <div className="w-6 h-6 rounded-lg bg-[#f5f2ed] text-[#5d4037] flex items-center justify-center text-xs font-bold border border-[#d7ccc8]/60">
                            📋
                        </div>
                        <h3 className="font-bold text-xs uppercase tracking-wide text-[#3e2723]">
                            รายละเอียดการรับบริการ
                        </h3>
                    </div>

                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-[#8d6e63]">บริการ</span>
                            <span className="text-[#3e2723] font-semibold text-right">
                                {appointment.serviceInfo?.name || '-'}
                            </span>
                        </div>
                        {appointment.appointmentInfo?.technicianInfo?.firstName && (
                            <div className="flex justify-between items-center gap-2">
                                <span className="text-[#8d6e63]">ผู้ให้บริการ</span>
                                <span className="text-[#3e2723] font-medium">
                                    {appointment.appointmentInfo?.technicianInfo?.firstName} {appointment.appointmentInfo?.technicianInfo?.lastName || ''}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-[#8d6e63]">วันเวลาที่นัดหมาย</span>
                            <span className="text-[#3e2723] font-medium tabular-nums">
                                {appointment.date ? new Date(appointment.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} • {appointment.time || '-'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Form Card */}
            <div className="bg-white rounded-3xl border border-[#e7e0da] shadow-md p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Star Rating */}
                    <div className="text-center space-y-3">
                        <label className="block text-xs font-bold text-[#3e2723] uppercase tracking-wide">
                            คุณพึงพอใจกับการบริการระดับใด?
                        </label>
                        <StarRating rating={rating} setRating={setRating} />
                        <div className="h-6 flex items-center justify-center">
                            {rating > 0 ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#f5f2ed] text-[#5d4037] border-[#d7ccc8] animate-in fade-in-50">
                                    <span>
                                        {rating === 5 ? 'ดีเยี่ยม! 🤩' : rating === 4 ? 'ดีมาก 😊' : rating === 3 ? 'ปานกลาง 🙂' : rating === 2 ? 'พอใช้ 😐' : 'ควรปรับปรุง 🙁'}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-xs text-[#a1887f]">แตะดาวเพื่อให้คะแนน</span>
                            )}
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#3e2723] uppercase tracking-wide">
                            ความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full p-3.5 bg-[#faf8f5] border border-[#d7ccc8] rounded-xl focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] text-xs sm:text-sm text-[#3e2723] placeholder:text-[#a1887f] outline-none transition-all resize-none font-medium"
                            rows={4}
                            placeholder="เช่น ช่างบริการดีมาก สุภาพ ผ่อนคลาย สถานที่สะอาด..."
                            maxLength={500}
                        />
                        <div className="text-right">
                            <span className="text-[11px] text-[#8d6e63] tabular-nums">
                                {comment.length} / 500
                            </span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-medium animate-in fade-in-50">
                            <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2.5 pt-1">
                        <button
                            type="submit"
                            disabled={isSubmitting || rating === 0}
                            className="w-full h-11 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                    <span>กำลังส่งรีวิว...</span>
                                </>
                            ) : (
                                <span>ส่งรีวิวการบริการ</span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="w-full h-10 rounded-xl border border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed] font-semibold text-xs transition-all active:scale-95"
                        >
                            ยกเลิก
                        </button>
                    </div>
                </form>
            </div>

            {/* Note badge */}
            <div className="rounded-xl p-3 bg-[#f5f2ed] border border-[#d7ccc8] text-center">
                <p className="text-xs text-[#5d4037] font-medium">
                    ✨ ทุกความคิดเห็นจะถูกนำไปพัฒนาคุณภาพและมาตรฐานการบริการให้ดียิ่งขึ้น
                </p>
            </div>
        </div>
    );
}

export default function ReviewPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#d7ccc8] border-t-[#5d4037] mx-auto"></div>
                <p className="text-[#8d6e63] text-xs font-medium">กำลังโหลด...</p>
            </div>
        }>
            <ReviewContent />
        </Suspense>
    );
}
