"use client";

import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '@/app/lib/supabaseDb';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser, confirmAppointmentByUser } from '@/app/actions/appointmentActions';
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import HistoryCard from './HistoryCard';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useRouter } from 'next/navigation';
import { Appointment } from '@/types';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default function MyAppointmentsPage() {
    const router = useRouter();
    const { profile, loading: liffLoading, error: liffError, liff } = useLiffContext();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [historyBookings, setHistoryBookings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
    const [notification, setNotification] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' | 'warning' }>({ show: false, title: '', message: '', type: 'success' });
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ ...notification, show: false }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading) return;

        if (!profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        setLoading(true);

        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId)
        );

        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

            // กรองข้อมูลนัดหมายปัจจุบัน
            const activeStatus = ['awaiting_confirmation', 'confirmed', 'in_progress', 'pending'];
            const filteredDocs = allDocs
                .filter(doc => activeStatus.includes(doc.status))
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateA.getTime() - dateB.getTime();
                });

            setAppointments(filteredDocs);
            setLoading(false);

            // กรองประวัติย้อนหลัง
            const historyStatus = ["completed", "cancelled"];
            const historyDocs = allDocs
                .filter(doc => historyStatus.includes(doc.status))
                .sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateB.getTime() - dateA.getTime();
                });
            setHistoryBookings(historyDocs);

        }, (error) => {
            console.error("Error fetching appointments:", error);
            setNotification({ show: true, title: 'Error', message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล', type: 'error' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleQrCodeClick = (appointmentId: string) => {
        setSelectedAppointmentId(appointmentId);
        setShowQrModal(true);
    };

    const handleCancelClick = (appointment: Appointment) => {
        setAppointmentToCancel(appointment);
    };

    const confirmCancelAppointment = async () => {
        if (!appointmentToCancel || !profile?.userId || !appointmentToCancel.id) return;
        setIsCancelling(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await cancelAppointmentByUser(appointmentToCancel.id, profile.userId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยกเลิกนัดหมายเรียบร้อยแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: typeof result.error === 'string' ? result.error : 'Unknown error', type: 'error' });
        }
        setIsCancelling(false);
        setAppointmentToCancel(null);
    };

    const handleConfirmClick = async (appointment: Appointment) => {
        if (!profile?.userId || !appointment.id) return;
        setIsConfirming(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await confirmAppointmentByUser(appointment.id, profile.userId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยืนยันการนัดหมายเรียบร้อยแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: typeof result.error === 'string' ? result.error : 'Unknown error', type: 'error' });
        }
        setIsConfirming(false);
    };

    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                <p className="text-xs text-[#8d6e63] mt-3 font-medium">กำลังโหลดข้อมูลนัดหมาย...</p>
            </div>
        );
    }

    if (liffError) {
        return (
            <div className="p-6 text-center text-rose-600 bg-rose-50 rounded-2xl m-4 border border-rose-200">
                <p className="font-bold text-sm">การเชื่อมต่อ LINE ผิดพลาด</p>
                <p className="text-xs mt-1">{liffError}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <CustomerHeader showBackButton={false} showActionButtons={true} title="นัดหมายของฉัน" />
            
            <div className="w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
                <Notification {...notification} />

                <ConfirmationModal
                    show={!!appointmentToCancel}
                    title="ยืนยันการยกเลิกนัดหมาย"
                    message={`คุณต้องการยกเลิกการนัดหมายบริการ "${appointmentToCancel?.serviceInfo.name}" ใช่หรือไม่?`}
                    onConfirm={confirmCancelAppointment}
                    onCancel={() => setAppointmentToCancel(null)}
                    isProcessing={isCancelling}
                />

                <QrCodeModal
                    show={showQrModal}
                    onClose={() => setShowQrModal(false)}
                    appointmentId={selectedAppointmentId}
                />

                {/* Segmented Tab Bar */}
                <div className="bg-[#f0ebe5] p-1 rounded-2xl flex items-center gap-1 border border-[#e7e0da]/80 shadow-xs">
                    <button
                        onClick={() => setActiveTab('upcoming')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'upcoming'
                                ? 'bg-white text-[#5d4037] shadow-sm'
                                : 'text-[#8d6e63] hover:text-[#3e2723]'
                        }`}
                    >
                        <span>นัดหมายปัจจุบัน</span>
                        {appointments.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeTab === 'upcoming' ? 'bg-[#5d4037] text-white' : 'bg-[#e7e0da] text-[#5d4037]'
                            }`}>
                                {appointments.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'history'
                                ? 'bg-white text-[#5d4037] shadow-sm'
                                : 'text-[#8d6e63] hover:text-[#3e2723]'
                        }`}
                    >
                        <span>ประวัติย้อนหลัง</span>
                        {historyBookings.length > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeTab === 'history' ? 'bg-[#5d4037] text-white' : 'bg-[#e7e0da] text-[#5d4037]'
                            }`}>
                                {historyBookings.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab: Upcoming Appointments */}
                {activeTab === 'upcoming' && (
                    <div className="space-y-3.5">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <SpaFlowerIcon className="w-10 h-10 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                                <p className="text-xs text-[#8d6e63] mt-2 font-medium">กำลังโหลดรายการนัดหมาย...</p>
                            </div>
                        ) : !profile?.userId ? (
                            <div className="text-center py-12 px-6 bg-white rounded-3xl border border-[#e7e0da] shadow-sm">
                                <div className="w-14 h-14 bg-[#faf8f5] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#e7e0da]">
                                    <SpaFlowerIcon className="w-7 h-7" color="#8d6e63" />
                                </div>
                                <h3 className="font-bold text-sm text-[#3e2723]">เข้าสู่ระบบเพื่อดูนัดหมาย</h3>
                                <p className="text-xs text-[#8d6e63] mt-1 max-w-xs mx-auto">
                                    กรุณาเข้าสู่ระบบผ่าน LINE เพื่อตรวจสอบรายการนัดหมายและประวัติของคุณ
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                                    {liff?.login && (
                                        <button
                                            onClick={() => liff.login()}
                                            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-bold bg-[#06C755] text-white hover:bg-[#05b34c] shadow-sm transition-all active:scale-95"
                                        >
                                            เข้าสู่ระบบด้วย LINE
                                        </button>
                                    )}
                                    <button
                                        onClick={() => router.push('/appointment')}
                                        className="w-full sm:w-auto px-6 py-2.5 rounded-2xl text-xs font-bold bg-[#5d4037] text-white hover:bg-[#4a3429] shadow-sm transition-all active:scale-95"
                                    >
                                        จองบริการใหม่
                                    </button>
                                </div>
                            </div>
                        ) : appointments.length === 0 ? (
                            <div className="text-center py-12 px-6 bg-white rounded-3xl border border-[#e7e0da] shadow-sm">
                                <div className="w-14 h-14 bg-[#faf8f5] rounded-full flex items-center justify-center mx-auto mb-3 border border-[#e7e0da]">
                                    <SpaFlowerIcon className="w-7 h-7" color="#8d6e63" />
                                </div>
                                <h3 className="font-bold text-sm text-[#3e2723]">ไม่มีรายการนัดหมายปัจจุบัน</h3>
                                <p className="text-xs text-[#8d6e63] mt-1 max-w-xs mx-auto">
                                    คุณสามารถเลือกดูคอร์สบริการสปาและจองเวลานัดหมายที่สะดวกได้ทันที
                                </p>
                                <button
                                    onClick={() => router.push('/appointment')}
                                    className="mt-4 px-6 py-2.5 rounded-2xl text-xs font-bold bg-[#5d4037] text-white hover:bg-[#4a3429] shadow-sm shadow-[#5d4037]/20 transition-all active:scale-95"
                                >
                                    จองบริการใหม่
                                </button>
                            </div>
                        ) : (
                            appointments.map((job) => (
                                <AppointmentCard
                                    key={job.id}
                                    job={job}
                                    onQrCodeClick={() => handleQrCodeClick(job.id!)}
                                    onCancelClick={handleCancelClick}
                                    onConfirmClick={handleConfirmClick}
                                    isConfirming={isConfirming}
                                />
                            ))
                        )}
                    </div>
                )}

                {/* Tab: History */}
                {activeTab === 'history' && (
                    <div className="space-y-3">
                        {historyBookings.length === 0 ? (
                            <div className="text-center py-12 px-6 bg-white rounded-3xl border border-[#e7e0da] shadow-sm">
                                <p className="text-xs text-[#8d6e63]">ยังไม่มีประวัติการใช้บริการที่ผ่านมา</p>
                            </div>
                        ) : (
                            historyBookings.map(job => (
                                <HistoryCard
                                    key={job.id}
                                    appointment={job}
                                    onBookAgain={() => router.push('/appointment')}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
