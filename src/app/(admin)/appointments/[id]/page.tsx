"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, doc, getDoc, deleteDoc, onSnapshot } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileProvider';
import { Appointment, Service } from '@/types';

// --- Icons ---
const Icons = {
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Calendar: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    CreditCard: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    Clock: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Spa: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C9 5 6 8 6 11a6 6 0 0012 0c0-3-3-6-6-9z" />
        </svg>
    )
};

// --- Modal: Edit Payment ---
interface EditPaymentModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (amount: string | number, method: string) => Promise<void>;
    defaultAmount?: number;
    defaultMethod?: string;
    currencySymbol?: string;
}

function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod, currencySymbol }: EditPaymentModalProps) {
    const [amount, setAmount] = useState<string | number>(defaultAmount || '');
    const [method, setMethod] = useState(defaultMethod || 'เงินสด');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-[#e8ddd7]">
                <h2 className="text-base font-bold text-gray-900 mb-4">ยืนยันการชำระเงิน</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">ยอดชำระ ({currencySymbol})</label>
                        <input type="number" className="w-full border border-[#e8ddd7] rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#5D4037]" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">ช่องทางชำระ</label>
                        <select className="w-full border border-[#e8ddd7] rounded-xl px-3 py-2 text-xs bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#5D4037]" value={method} onChange={e => setMethod(e.target.value)}>
                            <option value="เงินสด">เงินสด</option>
                            <option value="โอนเงิน">โอนเงิน</option>
                            <option value="บัตรเครดิต">บัตรเครดิต</option>
                            <option value="PromptPay">PromptPay</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-[#f5ede8] rounded-xl transition-colors">ยกเลิก</button>
                    <button onClick={async () => { setSaving(true); await onSave(amount, method); setSaving(false); }} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#5D4037] hover:bg-[#4a3429] rounded-xl transition-colors shadow-sm">
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Modal: Completion Note ---
interface CompletionNoteModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (note: string) => Promise<void>;
    customerName: string;
    serviceInfo: any;
}

function CompletionNoteModal({ open, onClose, onSave, customerName, serviceInfo }: CompletionNoteModalProps) {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const loadServiceNote = () => {
        const n = serviceInfo?.completionNote || '';
        if (n) setNote(n); else alert('ไม่มีข้อความที่กำหนดไว้');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-[#e8ddd7]">
                <h2 className="text-base font-bold text-gray-900 mb-2">ข้อความถึงลูกค้า</h2>
                <p className="text-xs text-[#8D6E63] mb-4">ส่งข้อความขอบคุณหรือคำแนะนำการดูแลหลังบริการให้ {customerName}</p>
                {serviceInfo?.completionNote && (
                    <button onClick={loadServiceNote} className="mb-3 px-3 py-1.5 bg-[#fdf8f6] text-[#5D4037] border border-[#e8ddd7] rounded-xl text-[10px] font-semibold hover:bg-[#f5ede8] transition-colors">
                        ใช้ข้อความแนะนำจากบริการ
                    </button>
                )}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">ข้อความ (ไม่บังคับ)</label>
                    <textarea className="w-full border border-[#e8ddd7] rounded-xl px-3 py-2 h-24 resize-none text-xs focus:outline-none focus:ring-1 focus:ring-[#5D4037]" placeholder="เช่น ขอบคุณที่ใช้บริการค่ะ แนะนำให้หลีกเลี่ยงการโดนแดดจัดหลังทำทรีตเมนต์นะคะ..." value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
                    <div className="text-[10px] text-gray-400 mt-1 text-right">{note.length}/200</div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-[#f5ede8] rounded-xl transition-colors">ยกเลิก</button>
                    <button onClick={async () => { setSaving(true); await onSave(note.trim()); setSaving(false); }} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#5D4037] hover:bg-[#4a3429] rounded-xl transition-colors shadow-sm">
                        {saving ? 'กำลังส่ง...' : 'บริการเสร็จสิ้น'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Helpers ---
const InfoRow = ({ label, value }: { label: string, value: any }) => (
    <div className="flex justify-between py-2.5 border-b border-[#f5ede8] last:border-0">
        <span className="text-xs text-[#8D6E63] font-medium">{label}</span>
        <span className="text-xs font-bold text-gray-800">{value || '-'}</span>
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-[#fff9e6]', text: 'text-amber-700' },
        confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-[#eafaf1]', text: 'text-emerald-700' },
        in_progress: { label: 'กำลังบริการ', bg: 'bg-[#f3ebfa]', text: 'text-purple-700' },
        completed: { label: 'เสร็จสิ้น', bg: 'bg-[#eef2f6]', text: 'text-[#5D4037]' },
        cancelled: { label: 'ยกเลิก', bg: 'bg-rose-50', text: 'text-rose-600' },
        pending: { label: 'จอง', bg: 'bg-gray-100', text: 'text-gray-600' },
    };
    const current = config[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' };
    return <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${current.bg} ${current.text}`}>{current.label}</span>;
};

const STATUS_OPTIONS = [
    { value: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { value: 'confirmed', label: 'ยืนยันแล้ว' },
    { value: 'in_progress', label: 'กำลังบริการ' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'cancelled', label: 'ยกเลิก' },
];

const formatPrice = (v: number | undefined) => v == null ? '-' : Number(v).toLocaleString();
const safeDate = (d: any) => { if (!d) return null; if (typeof d.toDate === 'function') return d.toDate(); return new Date(d); };

// --- Main Component ---
export default function AppointmentDetailPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [serviceDetails, setServiceDetails] = useState<Service | null>(null);
    const fetchedServiceIdRef = useRef<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showEditPayment, setShowEditPayment] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompletionNote, setShowCompletionNote] = useState(false);
    const [statusChangeInfo, setStatusChangeInfo] = useState<{ newStatus: string, statusLabel: string } | null>(null);
    const [isSendingInvoice, setIsSendingInvoice] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตน", "error");
            return null;
        }
        return token;
    };

    const handleSavePayment = async (amount: string | number, method: string) => {
        if (!appointment?.id) return;
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method }, { adminToken: token });
            if (result.success) {
                showToast('อัพเดตการชำระเงินสำเร็จ', 'success');
                setShowEditPayment(false);
            } else showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
    };

    const handleStatusChange = (newStatus: string) => {
        if (!appointment || newStatus === appointment.status) return;
        if (newStatus === 'completed') { setShowCompletionNote(true); return; }
        setStatusChangeInfo({ newStatus, statusLabel: STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus });
    };

    const handleCompletionWithNote = async (note: string) => {
        if (!appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', note, { adminToken: token });
            if (result.success) showToast('อัพเดทสถานะสำเร็จ', 'success');
            else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
        } catch (err: any) { showToast(`ไม่สำเร็จ: ${err.message}`, 'error'); }
        finally { setUpdating(false); setShowCompletionNote(false); }
    };

    const confirmStatusChange = async () => {
        if (!statusChangeInfo || !appointment?.id) return;
        setUpdating(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await updateAppointmentStatusByAdmin(appointment.id, statusChangeInfo.newStatus, undefined, { adminToken: token });
            if (result.success) showToast('อัพเดทสถานะสำเร็จ', 'success');
            else showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
        } catch (err: any) { showToast(`ไม่สำเร็จ: ${err.message}`, 'error'); }
        finally { setUpdating(false); setStatusChangeInfo(null); }
    };

    const handleDelete = async () => {
        if (!appointment?.id) return;
        setLoading(true);
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'appointments', appointment.id));
            showToast('ลบการจองสำเร็จ', 'success');
            setDeleted(true);
            router.push('/dashboard');
        } catch (err) { showToast('ลบไม่สำเร็จ', 'error'); }
        finally { setDeleting(false); setShowDeleteConfirm(false); }
    };

    const handleSendInvoice = async () => {
        if (!appointment?.id) return;
        setIsSendingInvoice(true);
        try {
            const token = await getAdminToken();
            if (!token) return;
            const result = await sendInvoiceToCustomer(appointment.id, { adminToken: token });
            if (result.success) showToast('ส่งลิงก์ชำระเงินทาง LINE แล้ว', 'success');
            else throw new Error(result.error);
        } catch (err: any) { showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error'); }
        finally { setIsSendingInvoice(false); }
    };

    useEffect(() => {
        if (!id || deleted) return;
        setLoading(true);
        const unsub = onSnapshot(doc(db, 'appointments', id), async (snap) => {
            if (!snap.exists()) { showToast('ไม่พบข้อมูล', 'error'); setAppointment(null); setLoading(false); return; }
            const raw = snap.data();
            const appData = { id: snap.id, ...raw, createdAt: safeDate(raw.createdAt), updatedAt: safeDate(raw.updatedAt) } as any;

            setAppointment(appData);

            if (raw.serviceId && fetchedServiceIdRef.current !== raw.serviceId) {
                try {
                    const sSnap = await getDoc(doc(db, 'services', raw.serviceId));
                    if (sSnap.exists()) {
                        setServiceDetails(sSnap.data() as Service);
                        fetchedServiceIdRef.current = raw.serviceId;
                    }
                } catch { }
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, deleted, showToast]);

    if (deleted) return <div className="flex justify-center items-center min-h-[400px] text-gray-500 text-xs">กำลังกลับสู่แดชบอร์ด...</div>;
    if (loading || profileLoading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-[#5D4037] rounded-full animate-spin"></div></div>;
    if (!appointment) return <div className="flex justify-center items-center min-h-[400px] text-gray-500 text-xs">ไม่พบข้อมูลการนัดหมาย</div>;

    const dateTime = safeDate(appointment.appointmentInfo?.dateTime || appointment.date);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            <ConfirmationModal show={showDeleteConfirm} title="ยืนยันการลบการจอง" message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลการจองนี้อย่างถาวร?" onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} isProcessing={deleting} />
            <ConfirmationModal show={!!statusChangeInfo} title="ยืนยันการเปลี่ยนสถานะ" message={`ต้องการปรับปรุงสถานะคิวเป็น "${statusChangeInfo?.statusLabel}" ใช่หรือไม่?`} onConfirm={confirmStatusChange} onCancel={() => setStatusChangeInfo(null)} isProcessing={updating} />
            <CompletionNoteModal open={showCompletionNote} onClose={() => setShowCompletionNote(false)} onSave={handleCompletionWithNote} customerName={appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้า'} serviceInfo={serviceDetails || appointment.serviceInfo} />
            <EditPaymentModal open={showEditPayment} onClose={() => setShowEditPayment(false)} onSave={handleSavePayment} defaultAmount={appointment.paymentInfo?.totalPrice} defaultMethod={appointment.paymentInfo?.paymentMethod} currencySymbol={profile.currencySymbol} />

            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 hover:bg-[#f5ede8] rounded-xl text-[#8D6E63] hover:text-[#5D4037] transition-colors" aria-label="กลับ">
                        <Icons.Back />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg font-bold text-gray-900">คิวจอง #{appointment.id.substring(0, 6).toUpperCase()}</h1>
                            <StatusBadge status={appointment.status} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            บันทึกในระบบ: {appointment.createdAt ? format(appointment.createdAt as Date, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'}
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="px-3.5 py-1.5 text-xs font-semibold text-rose-500 hover:text-white border border-rose-200 hover:bg-rose-500 rounded-xl transition-all shadow-sm">
                    ลบข้อมูลคิวจอง
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                {/* 1. Customer Info Card */}
                <div className="bg-white border border-[#e8ddd7] rounded-2xl shadow-sm">
                    <div className="px-5 py-4 border-b border-[#e8ddd7] flex items-center gap-2 text-[#5D4037]">
                        <Icons.User />
                        <h2 className="text-sm font-bold">ข้อมูลลูกค้า</h2>
                    </div>
                    <div className="p-5">
                        <InfoRow label="ชื่อ-นามสกุล" value={appointment.customerInfo?.fullName || appointment.customerInfo?.name} />
                        <InfoRow label="เบอร์โทรศัพท์" value={appointment.customerInfo?.phone} />
                        <InfoRow label="การเชื่อมต่อ LINE" value={appointment.userId ? <span className="text-emerald-600 font-bold text-[10px] px-2 py-0.5 rounded-md bg-emerald-50">✓ เชื่อมต่อแล้ว</span> : <span className="text-gray-400 text-[10px] px-2 py-0.5 rounded-md bg-gray-50">ไม่ได้เชื่อมต่อ</span>} />
                        <InfoRow label="รายละเอียดเพิ่มเติม" value={appointment.customerInfo?.note} />
                        
                        {appointment.completionNote && (
                            <div className="mt-4 bg-[#fdf8f6] border border-[#e8ddd7] rounded-xl p-3.5 text-xs text-gray-700">
                                <span className="font-bold text-[#5D4037] block mb-1 text-[10px] uppercase tracking-wider">บันทึกแนะนำหลังการดูแล:</span>
                                {appointment.completionNote}
                            </div>
                        )}

                        {/* Status Controller */}
                        <div className="mt-6 pt-5 border-t border-[#f5ede8]">
                            <p className="text-[10px] font-bold text-[#8D6E63] uppercase tracking-wider mb-3">ปรับเปลี่ยนสถานะคิว</p>
                            <div className="flex flex-wrap gap-2">
                                {appointment.status === 'awaiting_confirmation' && (
                                    <button onClick={() => handleStatusChange('confirmed')} disabled={updating} className="px-4 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-sm">
                                        ยืนยันคิวนัดหมาย
                                    </button>
                                )}
                                {appointment.status === 'confirmed' && (
                                    <button onClick={() => handleStatusChange('in_progress')} disabled={updating} className="px-4 py-2 text-xs font-semibold text-white bg-[#5D4037] hover:bg-[#4a3429] rounded-xl transition-all shadow-sm">
                                        เริ่มให้บริการลูกค้า
                                    </button>
                                )}
                                {appointment.status === 'in_progress' && (
                                    <button onClick={() => handleStatusChange('completed')} disabled={updating} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm">
                                        ทำรายการเสร็จสิ้น
                                    </button>
                                )}
                                
                                {/* Additional Quick Controls */}
                                <div className="flex flex-wrap gap-1.5 w-full mt-2">
                                    {STATUS_OPTIONS.filter(o => o.value !== appointment.status && !['confirmed', 'in_progress', 'completed'].includes(o.value)).map(o => (
                                        <button key={o.value} onClick={() => handleStatusChange(o.value)} disabled={updating} className="px-3 py-1.5 text-[10px] font-semibold text-[#8D6E63] bg-[#faf7f5] hover:bg-[#f5ede8] border border-[#e8ddd7]/60 rounded-xl transition-all">
                                            ปรับเป็น: {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Service Details Card */}
                <div className="bg-white border border-[#e8ddd7] rounded-2xl shadow-sm">
                    <div className="px-5 py-4 border-b border-[#e8ddd7] flex items-center gap-2 text-[#5D4037]">
                        <Icons.Spa />
                        <h2 className="text-sm font-bold">ข้อมูลบริการที่จอง</h2>
                    </div>
                    <div className="p-5">
                        <div className="flex gap-4 mb-5 items-start">
                            <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-[#faf7f5] flex-shrink-0 border border-[#e8ddd7]">
                                {appointment.serviceInfo?.imageUrl ? (
                                    <Image src={appointment.serviceInfo.imageUrl} alt="Service" fill className="object-cover" unoptimized />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-[10px] text-gray-300 font-semibold uppercase bg-gray-50">No Image</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-gray-900 leading-snug">{appointment.serviceInfo?.name}</h3>
                                <div className="flex items-center gap-1.5 text-xs text-[#8D6E63] mt-1.5 font-medium">
                                    <Icons.Clock />
                                    <span>{appointment.appointmentInfo?.duration || appointment.serviceInfo?.duration || 0} นาที</span>
                                </div>
                            </div>
                        </div>
                        
                        <InfoRow label="วันและเวลาเข้าใช้บริการ" value={dateTime ? format(dateTime, 'd MMMM yyyy, HH:mm น.', { locale: th }) : '-'} />
                        <InfoRow label="พนักงานบริการ (ช่าง)" value={appointment.appointmentInfo?.technicianName || 'ไม่ได้ระบุพนักงาน'} />
                        <InfoRow label="ลำดับคิว" value={appointment.queue || appointment.queueNumber || '-'} />

                        {/* Add-on List */}
                        {(appointment.appointmentInfo?.addOns?.length || appointment.addOns?.length || 0) > 0 && (
                            <div className="mt-4 bg-[#faf7f5] border border-[#e8ddd7]/65 rounded-2xl p-4">
                                <h4 className="text-xs font-bold text-[#5D4037] mb-2.5">บริการเสริมเพิ่มเติม:</h4>
                                <div className="space-y-2">
                                    {(appointment.appointmentInfo?.addOns || appointment.addOns || []).map((a, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-[#8D6E63] font-medium">
                                            <span>• {a.name || a.title}</span>
                                            <span className="text-gray-800 font-bold">{formatPrice(a.price)} {profile.currencySymbol}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Payment Card */}
                <div className="bg-white border border-[#e8ddd7] rounded-2xl shadow-sm lg:sticky lg:top-20">
                    <div className="px-5 py-4 border-b border-[#e8ddd7] flex items-center gap-2 text-[#5D4037]">
                            <Icons.CreditCard />
                            <h2 className="text-sm font-bold">ข้อมูลการเงิน</h2>
                        </div>
                        <div className="p-5">
                            <div className="space-y-2.5 mb-4">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-gray-500">ค่าบริการหลัก</span>
                                    <span className="text-gray-800 font-semibold">{formatPrice(appointment.paymentInfo?.originalPrice || appointment.serviceInfo?.price)} {profile.currencySymbol}</span>
                                </div>
                                {(appointment.paymentInfo?.addOnsTotal || 0) > 0 && (
                                    <div className="flex justify-between text-xs font-medium">
                                        <span className="text-gray-500">ค่าบริการเสริม</span>
                                        <span className="text-gray-800 font-semibold">+{formatPrice(appointment.paymentInfo?.addOnsTotal)} {profile.currencySymbol}</span>
                                    </div>
                                )}
                                {((appointment.paymentInfo?.discount || 0) > 0 || (appointment.paymentInfo?.couponDiscount || 0) > 0) && (
                                    <div className="flex justify-between text-xs font-medium text-green-600">
                                        <span>ส่วนลดพิเศษ</span>
                                        <span>-{formatPrice((appointment.paymentInfo?.discount || 0) + (appointment.paymentInfo?.couponDiscount || 0))} {profile.currencySymbol}</span>
                                    </div>
                                )}
                                <div className="border-t border-dashed border-[#e8ddd7] my-2"></div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-gray-800">ยอดรวมสุทธิ</span>
                                    <span className="font-bold text-base text-gray-900">
                                        {formatPrice(appointment.paymentInfo?.totalPrice)} <span className="text-[10px] font-normal text-gray-500">{profile.currencySymbol}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Summary payment details */}
                            <div className="bg-[#faf7f5] rounded-2xl p-4 mb-4 border border-[#e8ddd7]/50">
                                <InfoRow label="สถานะจ่ายเงิน" value={
                                    appointment.paymentInfo?.paymentStatus === 'paid' ? <span className="text-emerald-600 font-bold text-[11px]">✓ ชำระเงินแล้ว</span> :
                                        appointment.paymentInfo?.paymentStatus === 'invoiced' ? <span className="text-blue-600 font-bold text-[11px]">ส่งลิงก์แจ้งแล้ว</span> :
                                            <span className="text-amber-600 font-bold text-[11px]">รอชำระเงิน</span>
                                } />
                                <InfoRow label="ช่องทาง" value={appointment.paymentInfo?.paymentMethod || 'ไม่ระบุ'} />
                                {(appointment.paymentInfo as any)?.paidAt && (
                                    <InfoRow label="เวลาที่จ่าย" value={format(safeDate((appointment.paymentInfo as any).paidAt), 'd MMM HH:mm น.', { locale: th })} />
                                )}
                            </div>

                            {/* Payment Actions */}
                            <div className="space-y-2">
                                <button 
                                    onClick={handleSendInvoice} 
                                    disabled={isSendingInvoice || appointment.paymentInfo?.paymentStatus === 'paid'} 
                                    className="w-full py-2.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                >
                                    {isSendingInvoice ? 'กำลังส่ง...' : 'ส่งลิงก์ชำระเงินเข้า LINE'}
                                </button>
                                <button 
                                    onClick={() => setShowEditPayment(true)} 
                                    className="w-full py-2.5 text-xs font-bold text-[#5D4037] hover:text-[#4a3429] bg-white border border-[#e8ddd7] hover:border-[#5D4037]/45 rounded-xl transition-all"
                                >
                                    รับเงินเข้าระบบ (Manual)
                                </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
