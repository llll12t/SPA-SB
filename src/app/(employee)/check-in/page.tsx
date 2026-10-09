"use client";

import { useState } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById } from '@/app/actions/employeeActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { useToast } from '@/app/components/Toast';
import { Appointment } from '@/types';
import { useRouter } from 'next/navigation';
import AppointmentCard from './components/AppointmentCard';

export default function CheckInPage() {
    const { liff, loading: liffLoading } = useLiffContext();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const router = useRouter();
    const { showToast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;
        const sanitizedPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');
        setLoading(true);
        setMessage('');
        setAppointments([]);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await findAppointmentsByPhone(sanitizedPhoneNumber, { lineAccessToken });
        if (result.success) {
            if (result.appointments.length > 0) {
                setAppointments(result.appointments);
            } else {
                setMessage('ไม่พบข้อมูลการนัดหมายสำหรับเบอร์โทรนี้');
            }
        } else {
            setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        }
        setLoading(false);
    };

    const handleScan = async () => {
        if (!liff || !liff.isInClient()) {
            showToast('ฟังก์ชันสแกน QR Code รองรับการใช้งานผ่าน LINE เท่านั้น', 'error');
            return;
        }
        try {
            const result = await liff.scanCodeV2();
            if (result && result.value) {
                setLoading(true);
                setMessage('กำลังค้นหาข้อมูลการนัดหมาย...');
                const lineAccessToken = liff?.getAccessToken?.();
                const searchResult = await findAppointmentById(result.value, { lineAccessToken });
                if (searchResult.success) {
                    setAppointments([searchResult.appointment]);
                    setMessage('');
                } else {
                    setMessage(`ไม่พบข้อมูล: ${searchResult.error}`);
                }
                setLoading(false);
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถสแกน QR Code ได้'}`);
        }
    };

    const handleOpenModal = (appointment: Appointment) => {
        router.push(`/check-in/${appointment.id}`);
    };

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <EmployeeHeader />

            <div className="max-w-xl mx-auto px-4 py-5 space-y-4.5">
                {/* Title Banner */}
                <div className="pt-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#5d4037] bg-[#f5ede8] px-2.5 py-0.5 rounded-full border border-[#e8ddd7]">
                            จุดบริการพนักงาน
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3e2723] mt-1">
                        ค้นหาและเช็คอินคิวลูกค้า
                    </h1>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        สแกน QR Code ของลูกค้า หรือค้นหาด้วยเบอร์โทรศัพท์เพื่อเริ่มให้บริการ
                    </p>
                </div>

                {/* Primary Action: QR Scanner */}
                <button
                    onClick={handleScan}
                    disabled={liffLoading || loading}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#5d4037] to-[#3e2723] hover:from-[#4e342e] hover:to-[#2c1b18] text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <span className="tracking-wide">สแกน QR Code ลูกค้า</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-[#e7e0da]" />
                    <span className="text-xs font-semibold text-[#8d6e63]">หรือค้นหาด้วยเบอร์โทรศัพท์</span>
                    <div className="flex-1 h-px bg-[#e7e0da]" />
                </div>

                {/* Search by Phone Card */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e0da] shadow-2xs space-y-3">
                    <form onSubmit={handleSearch} className="space-y-3">
                        <label className="block text-xs font-semibold text-[#3e2723]">
                            เบอร์โทรศัพท์ลูกค้าที่ลงทะเบียน
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8d6e63]">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </span>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="เช่น 0812345678"
                                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#d7ccc8] rounded-xl text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] transition-all font-mono"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !phoneNumber.trim()}
                                className="px-5 h-10.5 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>ค้นหา...</span>
                                    </>
                                ) : (
                                    <span>ค้นหาคิว</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Results Section */}
                <div className="space-y-3 pt-1">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-2">
                            <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin" />
                            <p className="text-xs font-medium text-[#8d6e63]">กำลังค้นหาข้อมูลการนัดหมาย...</p>
                        </div>
                    )}

                    {message && (
                        <div className="p-4 rounded-xl text-xs font-medium text-center bg-[#faf8f5] border border-[#e7e0da] text-[#5d4037]">
                            {message}
                        </div>
                    )}

                    {appointments.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[#5d4037]">
                                    พบคิวนัดหมาย ({appointments.length} รายการ)
                                </h2>
                            </div>
                            {appointments.map((app) => (
                                <AppointmentCard
                                    key={app.id}
                                    appointment={app}
                                    onManage={handleOpenModal}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
