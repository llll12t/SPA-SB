"use client";

import { useState } from 'react';
import { connectLineToCustomer } from '@/app/actions/customerActions';
import { getPointsByPhone } from '@/app/actions/pointActions';
import { useToast } from '@/app/components/Toast';
import { auth } from '@/app/lib/supabaseAuth';

export default function ConnectLinePage() {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        phoneNumber: '',
        userId: '',
        fullName: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
    const [pointsPreview, setPointsPreview] = useState<any>(null);
    const [checkingPoints, setCheckingPoints] = useState(false);

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast('ไม่พบการยืนยันตัวตน', 'error');
            return null;
        }
        return token;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (message) setMessage('');
    };

    const handleCheckPoints = async () => {
        if (!formData.phoneNumber.trim()) {
            setMessage('กรุณากรอกเบอร์โทรศัพท์');
            setMessageType('error');
            return;
        }

        setCheckingPoints(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setCheckingPoints(false);
                return;
            }
            const result = await getPointsByPhone(formData.phoneNumber.trim(), { adminToken: token });
            if (result.success) {
                setPointsPreview(result);
                if (result.points > 0) {
                    setMessage(`พบคะแนนสะสม ${result.points} คะแนนสำหรับเบอร์นี้`);
                    setMessageType('success');
                } else {
                    setMessage('ไม่พบคะแนนสะสมสำหรับเบอร์นี้');
                    setMessageType('info');
                }
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
                setMessageType('error');
                setPointsPreview(null);
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            setMessageType('error');
            setPointsPreview(null);
        } finally {
            setCheckingPoints(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.phoneNumber.trim() || !formData.userId.trim()) {
            setMessage('กรุณากรอกเบอร์โทรศัพท์และ LINE User ID');
            setMessageType('error');
            return;
        }

        setLoading(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setLoading(false);
                return;
            }
            const result: any = await connectLineToCustomer(
                formData.phoneNumber.trim(),
                formData.userId.trim(),
                {
                    fullName: formData.fullName.trim(),
                    email: formData.email.trim()
                },
                { adminToken: token }
            );

            if (result.success) {
                setMessage(result.message || 'เชื่อมต่อสำเร็จ');
                setMessageType('success');
                showToast('เชื่อมต่อสำเร็จ', 'success');
                setFormData({
                    phoneNumber: '',
                    userId: '',
                    fullName: '',
                    email: ''
                });
                setPointsPreview(null);
            } else {
                setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
                setMessageType('error');
            }
        } catch (error: any) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-3.5 py-2.5 bg-white border border-[#d7ccc8] rounded-xl text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] transition-all shadow-xs";

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Frameless Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5ede8] text-[#5d4037] border border-[#e8ddd7]">
                            <svg className="w-3.5 h-3.5 text-[#06c755]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.97 1.7 5.6 4.3 7.15-.19.68-.69 2.47-.79 2.85-.12.48.17.47.36.35.15-.09 2.06-1.4 2.89-1.96.4.06.81.1 1.24.1 5.52 0 10-3.92 10-8.74C20 5.92 15.52 2 12 2z"/>
                            </svg>
                            LINE Integration
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#3e2723] mt-1">
                        เชื่อมต่อ LINE ID กับลูกค้า
                    </h1>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        จับคู่บัญชีสมาชิกด้วย LINE User ID เพื่อส่งการแจ้งเตือนคิวนัดหมายและรวมแต้มสะสม
                    </p>
                </div>
            </div>

            {/* Main Form Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Input Form (2 cols) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-[#e7e0da] shadow-xs p-5 sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-4.5">
                        {/* Phone Number with check point button */}
                        <div>
                            <label htmlFor="phoneNumber" className="block text-xs font-semibold text-[#3e2723] mb-1.5">
                                เบอร์โทรศัพท์ลูกค้า <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="tel"
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleInputChange}
                                    placeholder="เช่น 0812345678"
                                    className={`${inputClass} flex-1`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={handleCheckPoints}
                                    disabled={checkingPoints || !formData.phoneNumber.trim()}
                                    className="px-4 py-2.5 bg-[#f5ede8] hover:bg-[#ebdcd3] text-[#5d4037] border border-[#e8ddd7] rounded-xl font-medium text-xs transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                >
                                    {checkingPoints ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-[#5d4037]/30 border-t-[#5d4037] rounded-full animate-spin" />
                                            <span>กำลังตรวจ...</span>
                                        </>
                                    ) : (
                                        'ตรวจสอบคะแนน'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* LINE User ID */}
                        <div>
                            <label htmlFor="userId" className="block text-xs font-semibold text-[#3e2723] mb-1.5">
                                LINE User ID <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="userId"
                                name="userId"
                                value={formData.userId}
                                onChange={handleInputChange}
                                placeholder="เช่น U1234567890abcdef..."
                                className={`${inputClass} font-mono text-xs`}
                                required
                            />
                            <p className="text-[11px] text-[#8d6e63] mt-1">
                                LINE User ID ขึ้นต้นด้วยตัวอักษร U (ได้จากการส่งข้อความใน LINE Bot)
                            </p>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label htmlFor="fullName" className="block text-xs font-semibold text-[#3e2723] mb-1.5">
                                ชื่อ-นามสกุล (ถ้ามี)
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                placeholder="กรอกชื่อ-นามสกุลลูกค้า"
                                className={inputClass}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-xs font-semibold text-[#3e2723] mb-1.5">
                                อีเมล (ถ้ามี)
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="name@example.com"
                                className={inputClass}
                            />
                        </div>

                        {/* Status Message Alert */}
                        {message && (
                            <div className={`p-3.5 rounded-xl text-xs border ${
                                messageType === 'error'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : messageType === 'success'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-[#faf8f5] text-[#5d4037] border-[#e7e0da]'
                            }`}>
                                {message}
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 bg-[#5d4037] hover:bg-[#3e2723] text-white font-semibold rounded-xl text-xs shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>กำลังเชื่อมต่อ...</span>
                                    </>
                                ) : (
                                    'เชื่อมต่อ LINE ID กับระบบสมาชิก'
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right: Info & Point Preview (1 col) */}
                <div className="space-y-4">
                    {/* Points Preview Card */}
                    {pointsPreview ? (
                        <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-5 bg-gradient-to-br from-white to-emerald-50/30">
                            <h3 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                ข้อมูลคะแนนสะสมของเบอร์นี้
                            </h3>
                            <div className="space-y-1.5 text-xs text-[#3e2723]">
                                <div className="flex justify-between items-baseline py-1 border-b border-emerald-100">
                                    <span className="text-[#8d6e63]">คะแนนที่จะรวม:</span>
                                    <span className="text-base font-bold text-emerald-600 font-mono">
                                        {pointsPreview.points} แต้ม
                                    </span>
                                </div>
                                {pointsPreview.customerInfo?.lastPointsDate && (
                                    <p className="text-[11px] text-[#8d6e63] pt-1">
                                        อัปเดตแต้มล่าสุด: {new Date(pointsPreview.customerInfo.lastPointsDate.seconds * 1000).toLocaleDateString('th-TH')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-[#e7e0da] shadow-xs p-5 text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#faf8f5] border border-[#e7e0da] mx-auto flex items-center justify-center text-[#8d6e63] mb-2.5">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-xs font-semibold text-[#3e2723]">ระบบตรวจสอบแต้ม</p>
                            <p className="text-[11px] text-[#8d6e63] mt-0.5">
                                กรอกเบอร์โทรศัพท์แล้วกด &quot;ตรวจสอบคะแนน&quot; เพื่อดูแต้มเดิมก่อนผูกบัญชี
                            </p>
                        </div>
                    )}

                    {/* Instructions Card */}
                    <div className="bg-[#faf8f5] rounded-2xl border border-[#e7e0da] p-5 space-y-3">
                        <h3 className="text-xs font-bold text-[#3e2723] flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ขั้นตอนการทำงาน
                        </h3>
                        <ol className="space-y-2 text-xs text-[#5d4037] list-decimal list-inside">
                            <li>กรอกเบอร์โทรศัพท์ของลูกค้าแล้วกดตรวจสอบคะแนน</li>
                            <li>กรอก LINE User ID ที่ได้รับจากระบบ LINE Bot</li>
                            <li>ตรวจสอบหรือเพิ่มข้อมูลชื่อ-นามสกุล</li>
                            <li>กดปุ่ม &quot;เชื่อมต่อ LINE ID&quot;</li>
                            <li>ระบบจะเชื่อมข้อมูลและรวมแต้มสะสมให้อัตโนมัติ</li>
                        </ol>
                        <div className="pt-2 border-t border-[#e7e0da]">
                            <p className="text-[11px] text-[#8d6e63] leading-relaxed">
                                <strong>ประโยชน์:</strong> เมื่อเชื่อมต่อแล้ว ลูกค้าจะได้รับแจ้งเตือนสถานะคิว, ใบเสร็จ, และลิงก์ชำระเงินผ่าน LINE Official โดยตรง
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
