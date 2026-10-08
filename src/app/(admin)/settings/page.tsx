"use client";

import { useState, useEffect } from 'react';
import { db, doc, getDoc } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import {
    saveProfileSettings, saveNotificationSettings, saveBookingSettings,
    savePointSettings, savePaymentSettings, saveCalendarSettings
} from '@/app/actions/settingsActions';
import { sendDailyNotificationsNow } from '@/app/actions/dailyNotificationActions';
import { testAllIndexes, IndexStatus } from '@/app/actions/indexActions';
import { useToast } from '@/app/components/Toast';

// ============ UI COMPONENTS ============
const SettingCard = ({ title, description, children }: { title: string, description?: string, children: React.ReactNode }) => (
    <div className="bg-white border border-[#e7e0da] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#f0eae4] bg-[#faf8f5]">
            <h2 className="text-sm font-bold text-[#3e2723]">{title}</h2>
            {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
        </div>
        <div className="p-5 space-y-4">{children}</div>
    </div>
);

const Toggle = ({ label, description, checked, onChange, disabled }: { label: string, description?: string, checked?: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div>
            {label && <span className="text-xs font-semibold text-[#3e2723] block">{label}</span>}
            {description && <span className="text-[11px] text-stone-500 block">{description}</span>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
            <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" disabled={disabled} />
            <div className="w-10 h-5.5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4.5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all after:shadow-xs peer-checked:bg-[#5d4037]"></div>
        </label>
    </div>
);

const Input = ({ label, hint, ...props }: any) => (
    <div className="space-y-1">
        {label && <label className="block text-xs font-semibold text-[#3e2723]">{label}</label>}
        <input
            {...props}
            className="w-full px-3 py-2 border border-[#d7ccc8] rounded-lg text-xs sm:text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] bg-white transition-colors"
        />
        {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
    </div>
);

const TextArea = ({ label, hint, ...props }: any) => (
    <div className="space-y-1">
        {label && <label className="block text-xs font-semibold text-[#3e2723]">{label}</label>}
        <textarea
            {...props}
            className="w-full px-3 py-2 border border-[#d7ccc8] rounded-lg text-xs sm:text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] bg-white transition-colors"
        />
        {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
    </div>
);

const Radio = ({ label, description, value, selected, onChange }: { label: string, description?: string, value: string, selected: boolean, onChange: (v: string) => void }) => (
    <label className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${selected ? 'border-[#5d4037] bg-[#faf6f0] shadow-xs' : 'border-[#e7e0da] bg-white hover:bg-[#faf8f5]'}`}>
        <div className={`w-4 h-4 rounded-full border mt-0.5 mr-3 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#5d4037]' : 'border-stone-300'}`}>
            {selected && <div className="w-2 h-2 rounded-full bg-[#5d4037]"></div>}
        </div>
        <div>
            <span className="text-xs font-bold text-[#3e2723] block">{label}</span>
            {description && <span className="text-[11px] text-stone-500 block mt-0.5">{description}</span>}
        </div>
        <input type="radio" checked={selected} onChange={() => onChange(value)} className="sr-only" />
    </label>
);

// Navigation Tabs
const SETTING_TABS = [
    { key: 'profile', label: 'ข้อมูลร้าน' },
    { key: 'booking', label: 'กฎการจอง & เวลา' },
    { key: 'payment', label: 'การชำระเงิน' },
    { key: 'points', label: 'ระบบแต้มสะสม' },
    { key: 'notifications', label: 'แจ้งเตือน LINE' },
    { key: 'system', label: 'ระบบ & เชื่อมต่อ' },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [settings, setSettings] = useState<any>({
        allNotifications: { enabled: true },
        adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true, customerConfirmed: true },
        customerNotifications: { enabled: true, newBooking: true, appointmentConfirmed: true, serviceCompleted: true, appointmentCancelled: true, appointmentReminder: true, reviewRequest: true, paymentInvoice: true, dailyAppointmentNotification: true },
    });
    const [bookingSettings, setBookingSettings] = useState<any>({
        useTechnician: false,
        totalTechnicians: 1,
        bufferMinutes: 0,
        timeQueues: [],
        weeklySchedule: {},
        holidayDates: [],
        _queueTime: '',
        _queueCount: '',
        _newHolidayDate: '',
        _newHolidayReason: ''
    });
    const [pointSettings, setPointSettings] = useState<any>({
        reviewPoints: 5,
        pointsPerCurrency: 100,
        pointsPerVisit: 1,
        enableReviewPoints: true,
        enablePurchasePoints: false,
        enableVisitPoints: false
    });
    const [paymentSettings, setPaymentSettings] = useState<any>({
        method: 'promptpay',
        promptPayAccount: '',
        qrCodeImageUrl: '',
        bankInfoText: ''
    });
    const [calendarSettings, setCalendarSettings] = useState<any>({ enabled: false, calendarId: '' });
    const [profileSettings, setProfileSettings] = useState<any>({
        storeName: '',
        contactPhone: '',
        address: '',
        description: '',
        currency: '฿',
        currencySymbol: 'บาท'
    });
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [indexResults, setIndexResults] = useState<IndexStatus | null>(null);
    const [isCheckingIndexes, setIsCheckingIndexes] = useState(false);
    const { showToast } = useToast();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตนของผู้ดูแลระบบ", "error");
            return null;
        }
        return token;
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const docs = ['notifications', 'booking', 'points', 'payment', 'calendar', 'profile'];
                const snaps = await Promise.all(docs.map(id => getDoc(doc(db, 'settings', id))));
                if (snaps[0].exists()) {
                    const data = snaps[0].data() as any;
                    setSettings((prev: any) => ({ ...prev, ...data, customerNotifications: { ...prev.customerNotifications, ...data.customerNotifications } }));
                }
                if (snaps[1].exists()) {
                    const data = snaps[1].data() as any;
                    setBookingSettings((prev: any) => ({
                        ...prev,
                        ...data,
                        useTechnician: data.useTechnician ?? data.useBeautician ?? false,
                        totalTechnicians: data.totalTechnicians ?? data.totalBeauticians ?? 1,
                    }));
                }
                if (snaps[2].exists()) setPointSettings((prev: any) => ({ ...prev, ...snaps[2].data() as any }));
                if (snaps[3].exists()) setPaymentSettings((prev: any) => ({ ...prev, ...snaps[3].data() as any }));
                if (snaps[4].exists()) setCalendarSettings((prev: any) => ({ ...prev, ...snaps[4].data() as any }));
                if (snaps[5].exists()) setProfileSettings((prev: any) => ({ ...prev, ...snaps[5].data() as any }));
            } catch {
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลการตั้งค่า', 'error');
            }
            setLoading(false);
        };
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleNotifChange = (group: string, key: string, value: boolean) => {
        setSettings((prev: any) => {
            const newSettings = { ...prev, [group]: { ...prev[group], [key]: value } };
            if (group === 'allNotifications' && key === 'enabled' && !value) {
                newSettings.adminNotifications.enabled = false;
                newSettings.customerNotifications.enabled = false;
            }
            return newSettings;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsSaving(false);
                return;
            }
            const { updatedAt: _p, ...cleanProfile } = profileSettings;
            const { updatedAt: _n, ...cleanNotif } = settings;
            const { updatedAt: _b, ...cleanBooking } = bookingSettings;
            const normalizedBooking = {
                ...cleanBooking,
                useTechnician: cleanBooking.useTechnician ?? cleanBooking.useBeautician ?? false,
                totalTechnicians: cleanBooking.totalTechnicians ?? cleanBooking.totalBeauticians ?? 1,
            };
            const { updatedAt: _pt, ...cleanPoints } = pointSettings;
            const { updatedAt: _pm, ...cleanPayment } = paymentSettings;
            const { updatedAt: _c, ...cleanCalendar } = calendarSettings;

            const results = await Promise.all([
                saveProfileSettings(cleanProfile, { adminToken: token }),
                saveNotificationSettings(cleanNotif, { adminToken: token }),
                saveBookingSettings(normalizedBooking, { adminToken: token }),
                savePointSettings(cleanPoints, { adminToken: token }),
                savePaymentSettings(cleanPayment, { adminToken: token }),
                saveCalendarSettings(cleanCalendar, { adminToken: token })
            ]);

            if (results.every(r => r.success)) {
                showToast('บันทึกการตั้งค่าทั้งหมดเรียบร้อยแล้ว', 'success');
            } else {
                throw new Error('บันทึกบางส่วนไม่สำเร็จ');
            }
        } catch {
            showToast('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', 'error');
        }
        setIsSaving(false);
    };

    const handleSendNow = async (isMock: boolean) => {
        setIsSending(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsSending(false);
                return;
            }
            const result = await sendDailyNotificationsNow(isMock, { adminToken: token });
            if (result.success) showToast(isMock ? 'ทดสอบการส่งสำเร็จ' : 'ส่งแจ้งเตือนจริงสำเร็จ', 'success');
            else throw new Error(result.error);
        } catch (e: any) {
            showToast('เกิดข้อผิดพลาด: ' + (e?.message || ''), 'error');
        }
        setIsSending(false);
    };

    const handleCheckIndexes = async () => {
        setIsCheckingIndexes(true);
        try {
            const token = await getAdminToken();
            if (!token) {
                setIsCheckingIndexes(false);
                return;
            }
            const result = await testAllIndexes({ adminToken: token });
            setIndexResults(result);
            showToast(result.missingCount === 0 ? 'Indexes ทั้งหมดพร้อมใช้งาน' : `พบ ${result.missingCount} Indexes ที่ต้องสร้างเพิ่ม`, result.missingCount === 0 ? 'success' : 'warning');
        } catch {
            showToast('เกิดข้อผิดพลาดในการตรวจสอบ Indexes', 'error');
        }
        setIsCheckingIndexes(false);
    };

    const addTimeQueue = () => {
        if (!bookingSettings._queueTime || !bookingSettings._queueCount) return;
        setBookingSettings((prev: any) => ({
            ...prev,
            timeQueues: [...(prev.timeQueues || []), { time: prev._queueTime, count: parseInt(prev._queueCount) }].sort((a: any, b: any) => a.time.localeCompare(b.time)),
            _queueTime: '',
            _queueCount: ''
        }));
    };

    const addHoliday = () => {
        if (!bookingSettings._newHolidayDate) return;
        setBookingSettings((prev: any) => ({
            ...prev,
            holidayDates: [...(prev.holidayDates || []), { date: prev._newHolidayDate, reason: prev._newHolidayReason }].sort((a: any, b: any) => a.date.localeCompare(b.date)),
            _newHolidayDate: '',
            _newHolidayReason: ''
        }));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[420px] space-y-3">
                <div className="w-10 h-10 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-[#8d6e63]">กำลังโหลดการตั้งค่าระบบ...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* 1. Frameless Operations Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>กำหนดค่าระบบ</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">ตั้งค่าระบบและการทำงาน</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                        <span>{isSaving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่าทั้งหมด'}</span>
                    </button>
                </div>
            </div>

            {/* 2. Settings Category Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#e7e0da]">
                {SETTING_TABS.map(tab => {
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                                active
                                    ? 'bg-[#5d4037] text-white shadow-2xs'
                                    : 'text-[#8d6e63] hover:text-[#3e2723] hover:bg-[#efebe9]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* 3. Tab Contents */}
            <div className="space-y-4">
                {/* TAB 1: ข้อมูลร้าน */}
                {activeTab === 'profile' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingCard title="ข้อมูลทั่วไปของร้าน" description="ข้อมูลติดต่อที่จะแสดงให้ลูกค้าเห็นในใบเสร็จและการจอง">
                            <Input
                                label="ชื่อร้าน / ธุรกิจ"
                                value={profileSettings.storeName}
                                onChange={(e: any) => setProfileSettings({ ...profileSettings, storeName: e.target.value })}
                                placeholder="เช่น The Oasis Spa & Wellness"
                            />
                            <Input
                                label="เบอร์โทรศัพท์ติดต่อร้าน"
                                type="tel"
                                value={profileSettings.contactPhone}
                                onChange={(e: any) => setProfileSettings({ ...profileSettings, contactPhone: e.target.value })}
                                placeholder="02-xxx-xxxx หรือ 08x-xxx-xxxx"
                            />
                            <TextArea
                                label="ที่อยู่ร้าน / สาขา"
                                rows={3}
                                value={profileSettings.address}
                                onChange={(e: any) => setProfileSettings({ ...profileSettings, address: e.target.value })}
                                placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                            />
                        </SettingCard>

                        <SettingCard title="สกุลเงินและรูปแบบราคา" description="กำหนดสัญลักษณ์ทางการเงินสำหรับระบบ">
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="หน่วยเงิน (สัญลักษณ์)"
                                    value={profileSettings.currency}
                                    onChange={(e: any) => setProfileSettings({ ...profileSettings, currency: e.target.value })}
                                    placeholder="฿"
                                />
                                <Input
                                    label="ชื่อหน่วยเงิน (ข้อความ)"
                                    value={profileSettings.currencySymbol}
                                    onChange={(e: any) => setProfileSettings({ ...profileSettings, currencySymbol: e.target.value })}
                                    placeholder="บาท"
                                />
                            </div>
                            <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4] text-xs text-stone-600 mt-2">
                                <span className="font-semibold text-[#3e2723]">ตัวอย่างการแสดงผล:</span> 1,200 {profileSettings.currencySymbol || 'บาท'} ({profileSettings.currency || '฿'})
                            </div>
                        </SettingCard>
                    </div>
                )}

                {/* TAB 2: กฎการจอง & เวลา */}
                {activeTab === 'booking' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingCard title="โหมดการจองและการรับคิว" description="กำหนดเงื่อนไขว่าลูกค้าสามารถเลือกช่างได้หรือไม่">
                            <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4] mb-3">
                                <Toggle
                                    label="โหมดระบุช่างผู้ให้บริการ (Technician Mode)"
                                    description="เมื่อเปิดใช้งาน ลูกค้าจะสามารถเลือกช่างเฉพาะได้"
                                    checked={bookingSettings.useTechnician}
                                    onChange={v => setBookingSettings((p: any) => ({ ...p, useTechnician: v }))}
                                />
                            </div>

                            <Input
                                label={bookingSettings.useTechnician ? 'จำนวนช่างทั้งหมดในระบบ' : 'จำนวนคิวพร้อมกันสูงสุด'}
                                type="number"
                                min="1"
                                value={bookingSettings.totalTechnicians}
                                onChange={(e: any) => setBookingSettings((p: any) => ({ ...p, totalTechnicians: parseInt(e.target.value) || 1 }))}
                            />

                            <Input
                                label="เวลาพักเบรก (Buffer) ระหว่างคิว (นาที)"
                                type="number"
                                min="0"
                                value={bookingSettings.bufferMinutes}
                                onChange={(e: any) => setBookingSettings((p: any) => ({ ...p, bufferMinutes: Number(e.target.value) }))}
                                hint="เวลาเตรียมห้องหรืออุปกรณ์ก่อนเริ่มคิวถัดไป"
                            />

                            <div className="pt-3 border-t border-[#f0eae4]">
                                <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">กำหนดจำนวนคิวเฉพาะตามช่วงเวลา</label>
                                <div className="flex gap-2">
                                    <input
                                        type="time"
                                        value={bookingSettings._queueTime}
                                        onChange={e => setBookingSettings((p: any) => ({ ...p, _queueTime: e.target.value }))}
                                        className="flex-1 px-3 py-1.5 border border-[#d7ccc8] rounded-lg text-xs"
                                    />
                                    <input
                                        type="number"
                                        placeholder="จำนวน"
                                        value={bookingSettings._queueCount}
                                        onChange={e => setBookingSettings((p: any) => ({ ...p, _queueCount: e.target.value }))}
                                        className="w-20 px-3 py-1.5 border border-[#d7ccc8] rounded-lg text-xs font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={addTimeQueue}
                                        disabled={!bookingSettings._queueTime || !bookingSettings._queueCount}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#5d4037] hover:bg-[#3e2723] rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(bookingSettings.timeQueues || []).map((q: any) => (
                                        <span key={q.time} className="inline-flex items-center gap-1.5 bg-[#faf6f0] border border-[#e7e0da] px-2 py-0.5 rounded-lg text-xs text-[#5d4037] font-mono">
                                            {q.time} ({q.count} คิว)
                                            <button
                                                type="button"
                                                onClick={() => setBookingSettings((p: any) => ({ ...p, timeQueues: p.timeQueues.filter((x: any) => x.time !== q.time) }))}
                                                className="text-stone-400 hover:text-rose-600 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </SettingCard>

                        <div className="space-y-4">
                            <SettingCard title="เวลาทำการประจำสัปดาห์" description="เปิด/ปิดการรับคิวในแต่ละวันและกำหนดเวลาเปิด-ปิด">
                                {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((name, idx) => {
                                    const day = bookingSettings.weeklySchedule?.[idx] || { isOpen: false, openTime: '09:00', closeTime: '18:00' };
                                    return (
                                        <div key={idx} className="flex items-center justify-between py-1.5 border-b border-[#f0eae4] last:border-b-0 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Toggle
                                                    label=""
                                                    checked={day.isOpen}
                                                    onChange={v => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, isOpen: v } } }))}
                                                />
                                                <span className={`font-bold w-16 ${day.isOpen ? 'text-[#3e2723]' : 'text-stone-400'}`}>{name}</span>
                                            </div>
                                            {day.isOpen ? (
                                                <div className="flex items-center gap-1 font-mono">
                                                    <input
                                                        type="time"
                                                        value={day.openTime}
                                                        onChange={e => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, openTime: e.target.value } } }))}
                                                        className="px-2 py-1 border border-[#d7ccc8] rounded-md text-xs"
                                                    />
                                                    <span className="text-stone-400">-</span>
                                                    <input
                                                        type="time"
                                                        value={day.closeTime}
                                                        onChange={e => setBookingSettings((p: any) => ({ ...p, weeklySchedule: { ...p.weeklySchedule, [idx]: { ...day, closeTime: e.target.value } } }))}
                                                        className="px-2 py-1 border border-[#d7ccc8] rounded-md text-xs"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-stone-400 text-xs">ปิดทำการ</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </SettingCard>

                            <SettingCard title="วันหยุดพิเศษและวันหยุดนักขัตฤกษ์" description="ปิดรับคิวในวันที่กำหนดเป็นกรณีพิเศษ">
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={bookingSettings._newHolidayDate}
                                        onChange={e => setBookingSettings((p: any) => ({ ...p, _newHolidayDate: e.target.value }))}
                                        className="px-3 py-1.5 border border-[#d7ccc8] rounded-lg text-xs"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                    <input
                                        type="text"
                                        placeholder="สาเหตุ (เช่น วันสงกรานต์)"
                                        value={bookingSettings._newHolidayReason || ''}
                                        onChange={e => setBookingSettings((p: any) => ({ ...p, _newHolidayReason: e.target.value }))}
                                        className="flex-1 px-3 py-1.5 border border-[#d7ccc8] rounded-lg text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={addHoliday}
                                        disabled={!bookingSettings._newHolidayDate}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#5d4037] hover:bg-[#3e2723] rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        + เพิ่มวันหยุด
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(bookingSettings.holidayDates || []).map((h: any) => (
                                        <span key={h.date} className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg text-xs">
                                            <span className="font-mono">{h.date}</span> {h.reason && `(${h.reason})`}
                                            <button
                                                type="button"
                                                onClick={() => setBookingSettings((p: any) => ({ ...p, holidayDates: p.holidayDates.filter((x: any) => x.date !== h.date) }))}
                                                className="text-rose-400 hover:text-rose-700 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </SettingCard>
                        </div>
                    </div>
                )}

                {/* TAB 3: การชำระเงิน */}
                {activeTab === 'payment' && (
                    <div className="max-w-2xl">
                        <SettingCard title="ช่องทางการรับชำระเงิน" description="ตั้งค่าวิธีการรับโอนหรือสแกนจ่ายเงินของลูกค้า">
                            <div className="space-y-2">
                                <Radio
                                    label="พร้อมเพย์ (PromptPay QR)"
                                    description="สร้าง QR Code อัตโนมัติด้วยเบอร์โทรหรือเลขบัตรประจำตัว"
                                    value="promptpay"
                                    selected={paymentSettings.method === 'promptpay'}
                                    onChange={v => setPaymentSettings({ ...paymentSettings, method: v })}
                                />
                                <Radio
                                    label="รูปภาพ QR Code สแตนบาย"
                                    description="อัปโหลดภาพ QR Code ธนาคารหรือสแกนรับเงินที่มีอยู่แล้ว"
                                    value="image"
                                    selected={paymentSettings.method === 'image'}
                                    onChange={v => setPaymentSettings({ ...paymentSettings, method: v })}
                                />
                                <Radio
                                    label="ข้อมูลเลขที่บัญชีธนาคาร"
                                    description="แสดงเลขบัญชีและชื่อธนาคารเพื่อให้ลูกค้าโอนเงิน"
                                    value="bankinfo"
                                    selected={paymentSettings.method === 'bankinfo'}
                                    onChange={v => setPaymentSettings({ ...paymentSettings, method: v })}
                                />
                            </div>

                            <div className="pt-3 border-t border-[#f0eae4] mt-3">
                                {paymentSettings.method === 'promptpay' && (
                                    <Input
                                        label="หมายเลขพร้อมเพย์ (เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก)"
                                        value={paymentSettings.promptPayAccount}
                                        onChange={(e: any) => setPaymentSettings({ ...paymentSettings, promptPayAccount: e.target.value })}
                                        placeholder="0812345678"
                                    />
                                )}

                                {paymentSettings.method === 'image' && (
                                    <div className="space-y-3">
                                        <Input
                                            label="URL ลิงก์รูปภาพ QR Code"
                                            value={paymentSettings.qrCodeImageUrl}
                                            onChange={(e: any) => setPaymentSettings({ ...paymentSettings, qrCodeImageUrl: e.target.value })}
                                            placeholder="https://example.com/qr.png"
                                        />
                                        {paymentSettings.qrCodeImageUrl && (
                                            <div className="p-2 border border-[#d7ccc8] rounded-xl bg-[#faf8f5] w-fit">
                                                <img src={paymentSettings.qrCodeImageUrl} alt="QR Code Preview" className="w-28 h-28 object-contain rounded" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentSettings.method === 'bankinfo' && (
                                    <TextArea
                                        label="รายละเอียดบัญชีธนาคาร"
                                        rows={4}
                                        value={paymentSettings.bankInfoText}
                                        onChange={(e: any) => setPaymentSettings({ ...paymentSettings, bankInfoText: e.target.value })}
                                        placeholder="ธนาคารกสิกรไทย&#10;เลขที่บัญชี: 123-4-56789-0&#10;ชื่อบัญชี: บจก. สปา แอนด์ เวลเนส"
                                    />
                                )}
                            </div>
                        </SettingCard>
                    </div>
                )}

                {/* TAB 4: ระบบแต้มสะสม */}
                {activeTab === 'points' && (
                    <div className="max-w-2xl">
                        <SettingCard title="ระบบสะสมแต้มสมาชิก (Loyalty Points)" description="ตั้งค่าเงื่อนไขการแจกแต้มเพื่อให้ลูกค้านำไปแลกของรางวัล">
                            <div className="space-y-3">
                                <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4]">
                                    <Toggle
                                        label="ให้แต้มเมื่อลูกค้าเขียนรีวิว"
                                        description="มอบแต้มสะสมให้ลูกค้าทันทีหลังส่งรีวิวความพึงพอใจ"
                                        checked={pointSettings.enableReviewPoints}
                                        onChange={v => setPointSettings((p: any) => ({ ...p, enableReviewPoints: v }))}
                                    />
                                    {pointSettings.enableReviewPoints && (
                                        <div className="mt-2 pt-2 border-t border-[#e7e0da]">
                                            <Input
                                                label="จำนวนแต้มที่มอบให้ต่อการรีวิว 1 ครั้ง"
                                                type="number"
                                                value={pointSettings.reviewPoints}
                                                onChange={(e: any) => setPointSettings((p: any) => ({ ...p, reviewPoints: parseInt(e.target.value) || 5 }))}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4]">
                                    <Toggle
                                        label="ให้แต้มตามยอดชำระเงิน"
                                        description="คำนวณแต้มสะสมตามจำนวนเงินที่ลูกค้าชำระจริง"
                                        checked={pointSettings.enablePurchasePoints}
                                        onChange={v => setPointSettings((p: any) => ({ ...p, enablePurchasePoints: v }))}
                                    />
                                    {pointSettings.enablePurchasePoints && (
                                        <div className="mt-2 pt-2 border-t border-[#e7e0da]">
                                            <Input
                                                label={`ยอดใช้จ่ายกี่ ${profileSettings.currencySymbol || 'บาท'} ต่อ 1 แต้ม`}
                                                type="number"
                                                value={pointSettings.pointsPerCurrency}
                                                onChange={(e: any) => setPointSettings((p: any) => ({ ...p, pointsPerCurrency: parseInt(e.target.value) || 100 }))}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4]">
                                    <Toggle
                                        label="ให้แต้มต่อการเข้ารับบริการแต่ละครั้ง"
                                        description="แจกแต้มตายตัวทุกครั้งที่มาใช้บริการโดยไม่คำนึงถึงยอดเงิน"
                                        checked={pointSettings.enableVisitPoints}
                                        onChange={v => setPointSettings((p: any) => ({ ...p, enableVisitPoints: v }))}
                                    />
                                    {pointSettings.enableVisitPoints && (
                                        <div className="mt-2 pt-2 border-t border-[#e7e0da]">
                                            <Input
                                                label="จำนวนแต้มที่ได้รับต่อการมาเยือน 1 ครั้ง"
                                                type="number"
                                                value={pointSettings.pointsPerVisit}
                                                onChange={(e: any) => setPointSettings((p: any) => ({ ...p, pointsPerVisit: parseInt(e.target.value) || 1 }))}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingCard>
                    </div>
                )}

                {/* TAB 5: แจ้งเตือน LINE */}
                {activeTab === 'notifications' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SettingCard title="แจ้งเตือน LINE สำหรับผู้ดูแล (Admin)" description="ส่งข้อความแจ้งเตือนเข้าห้องแชตผู้ดูแล">
                            <div className="p-3 bg-[#faf6f0] rounded-xl border border-[#e7e0da] mb-3">
                                <Toggle
                                    label="ระบบแจ้งเตือนหลักทั้งหมด"
                                    description="สวิตช์เปิด/ปิดการส่งข้อความแจ้งเตือนทั้งหมดของระบบ"
                                    checked={settings.allNotifications.enabled}
                                    onChange={v => handleNotifChange('allNotifications', 'enabled', v)}
                                />
                            </div>

                            <Toggle
                                label="เปิดใช้งานแจ้งเตือน Admin"
                                checked={settings.adminNotifications.enabled}
                                onChange={v => handleNotifChange('adminNotifications', 'enabled', v)}
                                disabled={!settings.allNotifications.enabled}
                            />

                            {settings.adminNotifications.enabled && (
                                <div className="pl-3 border-l-2 border-[#d7ccc8] space-y-2 mt-2">
                                    <Toggle label="เมื่อมีรายการจองใหม่เข้ามา" checked={settings.adminNotifications.newBooking} onChange={v => handleNotifChange('adminNotifications', 'newBooking', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="เมื่อลูกค้ายืนยันคิวแล้ว" checked={settings.adminNotifications.customerConfirmed} onChange={v => handleNotifChange('adminNotifications', 'customerConfirmed', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="เมื่อมีการยกเลิกการนัดหมาย" checked={settings.adminNotifications.bookingCancelled} onChange={v => handleNotifChange('adminNotifications', 'bookingCancelled', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="เมื่อมีการชำระเงินสำเร็จ" checked={settings.adminNotifications.paymentReceived} onChange={v => handleNotifChange('adminNotifications', 'paymentReceived', v)} disabled={!settings.allNotifications.enabled} />
                                </div>
                            )}
                        </SettingCard>

                        <SettingCard title="แจ้งเตือน LINE สำหรับลูกค้า" description="ส่งข้อความอัตโนมัติหาลูกค้าผ่าน LINE Official Account">
                            <Toggle
                                label="เปิดใช้งานแจ้งเตือนลูกค้า"
                                checked={settings.customerNotifications.enabled}
                                onChange={v => handleNotifChange('customerNotifications', 'enabled', v)}
                                disabled={!settings.allNotifications.enabled}
                            />

                            {settings.customerNotifications.enabled && (
                                <div className="pl-3 border-l-2 border-[#d7ccc8] space-y-2 mt-2">
                                    <Toggle label="ส่งข้อความตอบรับเมื่อจองสำเร็จ" checked={settings.customerNotifications.newBooking} onChange={v => handleNotifChange('customerNotifications', 'newBooking', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="แจ้งเตือนเมื่อแอดมินอนุมัติคิว" checked={settings.customerNotifications.appointmentConfirmed} onChange={v => handleNotifChange('customerNotifications', 'appointmentConfirmed', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="แจ้งเตือนเมื่อบริการเสร็จสิ้น" checked={settings.customerNotifications.serviceCompleted} onChange={v => handleNotifChange('customerNotifications', 'serviceCompleted', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="แจ้งเตือนเมื่อคิวถูกยกเลิก" checked={settings.customerNotifications.appointmentCancelled} onChange={v => handleNotifChange('customerNotifications', 'appointmentCancelled', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="แจ้งเตือนล่วงหน้า 1 ชั่วโมงก่อนถึงเวลา" checked={settings.customerNotifications.appointmentReminder} onChange={v => handleNotifChange('customerNotifications', 'appointmentReminder', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="แจ้งเตือนสรุปคิวประจำวัน" checked={settings.customerNotifications.dailyAppointmentNotification} onChange={v => handleNotifChange('customerNotifications', 'dailyAppointmentNotification', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="ส่งใบเสร็จรับเงิน/หลักฐานชำระ" checked={settings.customerNotifications.paymentInvoice} onChange={v => handleNotifChange('customerNotifications', 'paymentInvoice', v)} disabled={!settings.allNotifications.enabled} />
                                    <Toggle label="ขอความคิดเห็น/รีวิวหลังรับบริการ" checked={settings.customerNotifications.reviewRequest} onChange={v => handleNotifChange('customerNotifications', 'reviewRequest', v)} disabled={!settings.allNotifications.enabled} />
                                </div>
                            )}
                        </SettingCard>
                    </div>
                )}

                {/* TAB 6: ระบบ & เชื่อมต่อ */}
                {activeTab === 'system' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SettingCard title="Google Calendar" description="ซิงค์ตารางนัดหมายอัตโนมัติกับ Google Calendar">
                            <Toggle
                                label="เปิดการเชื่อมต่อ Google Calendar"
                                checked={calendarSettings.enabled}
                                onChange={v => setCalendarSettings((p: any) => ({ ...p, enabled: v }))}
                            />
                            {calendarSettings.enabled && (
                                <div className="mt-3 space-y-2">
                                    <Input
                                        label="Google Calendar ID"
                                        value={calendarSettings.calendarId}
                                        onChange={(e: any) => setCalendarSettings((p: any) => ({ ...p, calendarId: e.target.value }))}
                                        placeholder="xxx@group.calendar.google.com"
                                        hint="อย่าลืมแชร์สิทธิ์ Manage Changes ให้กับ Service Account Email"
                                    />
                                </div>
                            )}
                        </SettingCard>

                        <SettingCard title="ทดสอบการส่งแจ้งเตือน" description="ส่งแจ้งเตือนประจำวัน (Manual Trigger)">
                            <p className="text-xs text-stone-500 mb-3">ทดสอบจำลองหรือสั่งส่งข้อความคิวงานประจำวันทันที</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSendNow(true)}
                                    disabled={isSending}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold text-[#5d4037] bg-[#faf8f5] hover:bg-[#efebe9] border border-[#d7ccc8] transition-colors disabled:opacity-50"
                                >
                                    {isSending ? '...' : '🎭 จำลองส่ง (Mock)'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSendNow(false)}
                                    disabled={isSending}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#5d4037] hover:bg-[#3e2723] transition-colors shadow-2xs disabled:opacity-50"
                                >
                                    {isSending ? '...' : '🚀 ยืนยันส่งจริง'}
                                </button>
                            </div>
                        </SettingCard>

                        <SettingCard title="ตรวจสอบ Indexes ฐานข้อมูล" description="ตรวจเช็กดัชนี Composite เพื่อประสิทธิภาพการค้นหา">
                            <button
                                type="button"
                                onClick={handleCheckIndexes}
                                disabled={isCheckingIndexes}
                                className="w-full px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#5d4037] hover:bg-[#3e2723] transition-colors shadow-2xs disabled:opacity-50"
                            >
                                {isCheckingIndexes ? 'กำลังตรวจสอบ...' : '🔍 ตรวจสอบ Indexes'}
                            </button>

                            {indexResults && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex gap-2 text-xs">
                                        <div className="flex-1 bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-center">
                                            <div className="font-bold text-emerald-800 text-base">{indexResults.okCount}</div>
                                            <div className="text-[11px] text-emerald-700">พร้อมใช้งาน</div>
                                        </div>
                                        <div className="flex-1 bg-rose-50 p-2 rounded-lg border border-rose-200 text-center">
                                            <div className="font-bold text-rose-800 text-base">{indexResults.missingCount}</div>
                                            <div className="text-[11px] text-rose-700">ต้องสร้างเพิ่ม</div>
                                        </div>
                                    </div>
                                    {indexResults.missingCount === 0 && (
                                        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 text-emerald-800 text-xs text-center font-semibold">
                                            ✅ Indexes ทั้งหมดพร้อมใช้งานสมบูรณ์
                                        </div>
                                    )}
                                </div>
                            )}
                        </SettingCard>
                    </div>
                )}
            </div>
        </div>
    );
}
