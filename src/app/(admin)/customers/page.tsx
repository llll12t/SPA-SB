"use client";

import { useEffect, useState, useMemo } from "react";
import { db, collection, getDocs, query, orderBy, doc, updateDoc } from "@/app/lib/supabaseDb";
import { auth } from "@/app/lib/supabaseAuth";
import { useToast } from "@/app/components/Toast";
import { ConfirmationModal } from "@/app/components/common/NotificationComponent";
import { addCustomer, deleteCustomer } from "@/app/actions/customerActions";
import { Customer } from "@/types";

// --- Icons ---
const Icons = {
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Phone: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Mail: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Star: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Grid: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Line: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 10.2c0-4.6-4.3-8.2-9.5-8.2S2.5 5.6 2.5 10.2c0 4.1 3.4 7.5 8 8.1.3 0 .7.1.8.3.1.2.1.5 0 .8-.1.4-.3 1.4-.3 1.7 0 .5.3.9.9.5l5.2-3.6c2.7-1.4 4.4-4.2 4.4-7.8zM12 14.6c-3.6 0-6.6-2.5-6.6-5.6 0-3.1 3-5.6 6.6-5.6 3.6 0 6.6 2.5 6.6 5.6 0 3.1-3 5.6-6.6 5.6z" /></svg>,
    X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Copy: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Award: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    CheckCircle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// --- Customer Form Modal (Add/Edit) ---
interface CustomerFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    customer: Customer | null;
}

function CustomerFormModal({ open, onClose, onSave, customer }: CustomerFormModalProps) {
    const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', points: 0, userId: '' });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const isEdit = !!customer;

    useEffect(() => {
        if (customer) {
            setFormData({
                fullName: customer.fullName || '',
                phone: customer.phone || '',
                email: customer.email || '',
                points: customer.points || 0,
                userId: customer.userId || ''
            });
        } else {
            setFormData({ fullName: '', phone: '', email: '', points: 0, userId: '' });
        }
    }, [customer, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => showToast('คัดลอก LINE User ID เรียบร้อยแล้ว', 'success'));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName?.trim() || !formData.phone?.trim()) {
            showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "error");
            return;
        }
        setSaving(true);
        try {
            if (isEdit && customer?.id) {
                await updateDoc(doc(db, "customers", customer.id), {
                    fullName: formData.fullName,
                    phone: formData.phone,
                    email: formData.email,
                    points: Number(formData.points) || 0,
                    updatedAt: new Date()
                });
                showToast("อัปเดตข้อมูลลูกค้าสำเร็จ", "success");
            } else {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    showToast("ไม่พบการยืนยันตัวตนของผู้ดูแลระบบ", "error");
                    setSaving(false);
                    return;
                }
                const result = await addCustomer({
                    ...formData,
                    points: Number(formData.points) || 0
                }, { adminToken: token });
                if (!result.success) throw new Error(result.error);
                showToast(result.message || "เพิ่มลูกค้าใหม่สำเร็จ", 'success');
            }
            onSave();
            onClose();
        } catch (error: any) {
            showToast("เกิดข้อผิดพลาด: " + (error?.message || "ไม่สามารถบันทึกได้"), "error");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const inputClass = "w-full px-3 py-2 border border-[#d7ccc8] rounded-lg text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] bg-white transition-colors";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e7e0da] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0eae4] bg-[#faf8f5]">
                    <div>
                        <h2 className="text-base font-semibold text-[#3e2723]">
                            {isEdit ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
                        </h2>
                        <p className="text-xs text-stone-500 mt-0.5">กรอกข้อมูลส่วนบุคคลและคะแนนสะสมของสมาชิก</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-400 hover:text-[#3e2723] hover:bg-[#efebe9] rounded-lg transition-colors"
                    >
                        <Icons.X />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* LINE ID Section if available */}
                    {isEdit && formData.userId && (
                        <div className="bg-[#f5f8f5] rounded-xl p-3 border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-emerald-100 text-[#06c755] rounded-lg">
                                    <Icons.Line />
                                </div>
                                <div>
                                    <p className="text-[11px] font-semibold text-emerald-800">เชื่อมต่อ LINE Official แล้ว</p>
                                    <p className="text-xs font-mono text-stone-600 truncate max-w-[240px]">{formData.userId}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => copyToClipboard(formData.userId)}
                                className="px-2.5 py-1 bg-white text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-xs"
                            >
                                คัดลอก ID
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">ชื่อ-นามสกุล <span className="text-rose-600">*</span></label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                                className={inputClass}
                                placeholder="ระบุชื่อลูกค้า"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">เบอร์โทรศัพท์ <span className="text-rose-600">*</span></label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className={inputClass}
                                placeholder="08x-xxx-xxxx"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">อีเมล</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="customer@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">คะแนนสะสม (Points)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    name="points"
                                    value={formData.points}
                                    onChange={handleChange}
                                    className={`${inputClass} font-mono`}
                                    placeholder="0"
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-medium pointer-events-none">
                                    คะแนน
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#f0eae4] mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-xs font-medium text-[#5d4037] hover:bg-[#efebe9] border border-[#d7ccc8] transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm transition-all disabled:opacity-50"
                        >
                            {saving ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Quick filter options
const CUSTOMER_FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'line', label: 'ผูก LINE แล้ว' },
    { key: 'noline', label: 'ยังไม่ผูก LINE' },
    { key: 'points', label: 'มีคะแนนสะสม' },
];

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterKey, setFilterKey] = useState("all");
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const { showToast } = useToast();

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        } catch {
            showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Summary statistics (Zero-noise strip)
    const stats = useMemo(() => {
        const total = customers.length;
        const lineConnected = customers.filter(c => !!c.userId).length;
        const withPoints = customers.filter(c => (c.points || 0) > 0).length;
        const totalPoints = customers.reduce((acc, c) => acc + (Number(c.points) || 0), 0);
        return { total, lineConnected, withPoints, totalPoints };
    }, [customers]);

    const confirmDelete = async () => {
        if (!customerToDelete?.id) return;
        setIsDeleting(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast("ไม่พบการยืนยันตัวตนของผู้ดูแลระบบ", "error");
            setIsDeleting(false);
            return;
        }
        const result = await deleteCustomer(customerToDelete.id, { adminToken: token });
        if (result.success) {
            showToast(result.message || 'ลบข้อมูลลูกค้าเรียบร้อยแล้ว', 'success');
            fetchCustomers();
        } else {
            showToast(result.error || 'ไม่สามารถลบข้อมูลลูกค้าได้', 'error');
        }
        setIsDeleting(false);
        setCustomerToDelete(null);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => showToast('คัดลอก LINE User ID เรียบร้อยแล้ว', 'success'));
    };

    const openAddModal = () => {
        setEditingCustomer(null);
        setShowFormModal(true);
    };

    const openEditModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setShowFormModal(true);
    };

    const filtered = useMemo(() => {
        return customers.filter(c => {
            const q = search.trim().toLowerCase();
            const matchesSearch = !q ||
                (c.fullName?.toLowerCase().includes(q)) ||
                (c.phone?.includes(q)) ||
                (c.email?.toLowerCase().includes(q));

            let matchesTab = true;
            if (filterKey === 'line') matchesTab = !!c.userId;
            else if (filterKey === 'noline') matchesTab = !c.userId;
            else if (filterKey === 'points') matchesTab = (c.points || 0) > 0;

            return matchesSearch && matchesTab;
        });
    }, [customers, search, filterKey]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Confirmation & Form Modals */}
            <ConfirmationModal
                show={!!customerToDelete}
                title="ยืนยันการลบลูกค้า"
                message={`คุณต้องการลบข้อมูลลูกค้า "${customerToDelete?.fullName}" ออกจากระบบหรือไม่? ข้อมูลประวัติและแต้มสะสมจะถูกลบอย่างถาวร`}
                onConfirm={confirmDelete}
                onCancel={() => setCustomerToDelete(null)}
                isProcessing={isDeleting}
            />

            <CustomerFormModal
                open={showFormModal}
                onClose={() => setShowFormModal(false)}
                onSave={fetchCustomers}
                customer={editingCustomer}
            />

            {/* 1. Frameless Clean Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>ฐานข้อมูลลูกค้า</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">จัดการลูกค้าและสมาชิก</h1>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#efebe9] text-[#5d4037] tabular-nums">
                            {customers.length} คน
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all"
                    >
                        <Icons.Plus />
                        <span>เพิ่มลูกค้าใหม่</span>
                    </button>
                </div>
            </div>

            {/* 2. Zero-Noise Unified Metric Bar (UI_DESIGN_SYSTEM Rule 5.1.1) */}
            <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-[#e7e0da] rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#f0eae4] shadow-sm">
                <div
                    onClick={() => setFilterKey('all')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${filterKey === 'all' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ลูกค้าทั้งหมด</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums mt-0.5">
                            {stats.total} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#efebe9] text-[#5d4037] flex items-center justify-center">
                        <Icons.Users />
                    </div>
                </div>

                <div
                    onClick={() => setFilterKey('line')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${filterKey === 'line' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ผูก LINE แล้ว</div>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
                            {stats.lineConnected} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#06c755] flex items-center justify-center">
                        <Icons.Line />
                    </div>
                </div>

                <div
                    onClick={() => setFilterKey('points')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${filterKey === 'points' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">สมาชิกสะสมแต้ม</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#5d4037] tabular-nums mt-0.5">
                            {stats.withPoints} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                        <Icons.Star />
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 flex items-center justify-between bg-white">
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">แต้มสะสมรวมทั้งระบบ</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums mt-0.5">
                            {stats.totalPoints.toLocaleString()} <span className="text-xs font-normal text-stone-500">แต้ม</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#efebe9] text-[#5d4037] flex items-center justify-center">
                        <Icons.Award />
                    </div>
                </div>
            </div>

            {/* 3. Search & Filter Matrix */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-[#e7e0da] shadow-sm">
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                        <Icons.Search />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, อีเมล..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-[#faf8f5] border border-[#e7e0da] rounded-lg text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#5d4037] transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
                        >
                            <Icons.X />
                        </button>
                    )}
                </div>

                {/* Filter Tabs + View Mode */}
                <div className="flex items-center gap-2 justify-between sm:justify-end overflow-x-auto">
                    <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-lg border border-[#f0eae4]">
                        {CUSTOMER_FILTERS.map(filter => {
                            const active = filterKey === filter.key;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => setFilterKey(filter.key)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-[#5d4037] text-white shadow-xs'
                                            : 'text-stone-600 hover:text-[#3e2723] hover:bg-white/60'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center bg-[#faf8f5] p-1 rounded-lg border border-[#f0eae4] flex-shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid View"
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-[#5d4037] shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            <Icons.Grid />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            aria-label="Table View"
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-[#5d4037] shadow-xs' : 'text-stone-400 hover:text-stone-600'}`}
                        >
                            <Icons.List />
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                    <p className="text-xs text-stone-500 mt-3 font-medium">กำลังโหลดข้อมูลลูกค้า...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-14 h-14 rounded-full bg-[#faf8f5] text-[#8d6e63] flex items-center justify-center mx-auto mb-3 border border-[#f0eae4]">
                        <Icons.User />
                    </div>
                    <h3 className="text-sm font-semibold text-[#3e2723]">ไม่พบข้อมูลลูกค้า</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        {search ? `ไม่พบรายการที่ตรงกับ "${search}" ลองค้นหาด้วยคำอื่น` : 'ยังไม่มีข้อมูลลูกค้าในระบบหรือตามเงื่อนไขที่เลือก'}
                    </p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] transition-colors"
                    >
                        <Icons.Plus /> เพิ่มลูกค้าคนแรก
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {filtered.map(customer => (
                        <div
                            key={customer.id}
                            className="group bg-white border border-[#e7e0da] hover:border-[#5d4037]/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-11 h-11 rounded-full bg-[#faf6f0] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-bold text-sm flex-shrink-0">
                                        {customer.fullName?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-[#3e2723] truncate group-hover:text-[#5d4037] transition-colors">
                                            {customer.fullName}
                                        </h3>
                                        <div className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                                            <Icons.Phone />
                                            <span className="font-mono tabular-nums">{customer.phone || '-'}</span>
                                        </div>
                                    </div>
                                    {customer.userId && (
                                        <button
                                            onClick={() => copyToClipboard(customer.userId!)}
                                            className="p-1.5 bg-[#f5f8f5] text-[#06c755] hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                                            title="คัดลอก LINE ID"
                                        >
                                            <Icons.Line />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2 mb-3">
                                    {customer.email ? (
                                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                                            <Icons.Mail />
                                            <span className="truncate">{customer.email}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-stone-400 italic">ไม่มีอีเมล</div>
                                    )}

                                    <div className="flex items-center justify-between pt-1">
                                        <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#5d4037] bg-[#faf6f0] border border-[#e7e0da] px-2.5 py-0.5 rounded-full">
                                            <Icons.Star />
                                            <span className="font-mono tabular-nums">{customer.points || 0}</span>
                                            <span className="text-[11px] font-normal text-stone-500">คะแนน</span>
                                        </div>

                                        {customer.userId ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                <Icons.CheckCircle />
                                                LINE
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-stone-400">ยังไม่ผูก LINE</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-[#f0eae4]">
                                <button
                                    onClick={() => openEditModal(customer)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#5d4037] hover:bg-[#efebe9] border border-[#d7ccc8] transition-colors"
                                >
                                    <Icons.Edit />
                                    <span>แก้ไข</span>
                                </button>
                                <button
                                    onClick={() => setCustomerToDelete(customer)}
                                    className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                    title="ลบข้อมูลลูกค้า"
                                >
                                    <Icons.Trash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* High-Density Table View */
                <div className="bg-white border border-[#e7e0da] rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#faf8f5] border-b border-[#e7e0da] text-stone-500 font-semibold uppercase text-[11px] tracking-wider">
                                    <th className="py-3 px-4">ลูกค้า</th>
                                    <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                                    <th className="py-3 px-4">อีเมล</th>
                                    <th className="py-3 px-4">คะแนนสะสม</th>
                                    <th className="py-3 px-4">LINE User ID</th>
                                    <th className="py-3 px-4 text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0eae4]">
                                {filtered.map(c => (
                                    <tr key={c.id} className="hover:bg-[#fbf9f7] transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-[#faf6f0] border border-[#d7ccc8] flex items-center justify-center text-[#5d4037] font-semibold text-xs flex-shrink-0">
                                                    {c.fullName?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <span className="font-semibold text-[#3e2723]">{c.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-stone-700 font-mono tabular-nums">
                                            {c.phone || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-stone-600">
                                            {c.email || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1 font-semibold text-[#5d4037] bg-[#faf6f0] px-2.5 py-0.5 rounded-full border border-[#e7e0da] font-mono tabular-nums">
                                                <Icons.Star />
                                                {c.points || 0}
                                                <span className="text-[11px] font-normal text-stone-500">แต้ม</span>
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {c.userId ? (
                                                <div className="inline-flex items-center gap-1.5 bg-[#f5f8f5] px-2 py-0.5 rounded border border-emerald-100">
                                                    <span className="text-[#06c755]"><Icons.Line /></span>
                                                    <span className="font-mono text-stone-600 text-[11px] max-w-[130px] truncate">{c.userId}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(c.userId!)}
                                                        className="text-stone-400 hover:text-emerald-700 p-0.5"
                                                        title="คัดลอก LINE ID"
                                                    >
                                                        <Icons.Copy />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-stone-400 text-xs">ยังไม่ผูก</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(c)}
                                                    className="text-[#5d4037] hover:text-[#3e2723] font-medium hover:underline text-xs"
                                                >
                                                    แก้ไข
                                                </button>
                                                <span className="text-stone-300">|</span>
                                                <button
                                                    onClick={() => setCustomerToDelete(c)}
                                                    className="text-rose-600 hover:text-rose-800 font-medium hover:underline text-xs"
                                                >
                                                    ลบ
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
