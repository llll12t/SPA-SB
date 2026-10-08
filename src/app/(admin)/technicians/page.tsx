"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from '@/app/lib/supabaseDb';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';

// Define Types
interface Technician {
    id: string;
    firstName: string;
    lastName?: string;
    phoneNumber: string;
    lineUserId?: string;
    imageUrl?: string;
    status: 'available' | 'on_trip' | 'unavailable' | 'suspended';
    createdAt?: any;
    updatedAt?: any;
}

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Phone: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Grid: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Line: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 10.2c0-4.6-4.3-8.2-9.5-8.2S2.5 5.6 2.5 10.2c0 4.1 3.4 7.5 8 8.1.3 0 .7.1.8.3.1.2.1.5 0 .8-.1.4-.3 1.4-.3 1.7 0 .5.3.9.9.5l5.2-3.6c2.7-1.4 4.4-4.2 4.4-7.8zM12 14.6c-3.6 0-6.6-2.5-6.6-5.6 0-3.1 3-5.6 6.6-5.6 3.6 0 6.6 2.5 6.6 5.6 0 3.1-3 5.6-6.6 5.6z" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    CheckCircle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    AlertCircle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Copy: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
};

// --- Status Badge ---
const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string, dot: string }> = {
        available: { label: 'พร้อมทำงาน', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        on_trip: { label: 'กำลังทำงาน', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', dot: 'bg-amber-500' },
        unavailable: { label: 'ลาหยุด', bg: 'bg-[#f5efe6] border-[#d7ccc8]', text: 'text-[#5d4037]', dot: 'bg-[#8d6e63]' },
        suspended: { label: 'พักงาน', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
    };
    const current = config[status] || { label: status || 'ไม่ระบุ', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${current.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
            {current.label}
        </span>
    );
};

// --- Add/Edit Modal ---
interface TechnicianFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    technician: Technician | null;
}

function TechnicianFormModal({ open, onClose, onSave, technician }: TechnicianFormModalProps) {
    const [formData, setFormData] = useState<Partial<Technician>>({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        lineUserId: '',
        imageUrl: '',
        status: 'available'
    });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const isEdit = !!technician;

    useEffect(() => {
        if (technician) {
            setFormData({
                firstName: technician.firstName || '',
                lastName: technician.lastName || '',
                phoneNumber: technician.phoneNumber || '',
                lineUserId: technician.lineUserId || '',
                imageUrl: technician.imageUrl || '',
                status: technician.status || 'available',
            });
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                phoneNumber: '',
                lineUserId: '',
                imageUrl: '',
                status: 'available'
            });
        }
    }, [technician, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.firstName?.trim() || !formData.phoneNumber?.trim()) {
            showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "error");
            return;
        }
        setSaving(true);
        try {
            if (isEdit && technician?.id) {
                await updateDoc(doc(db, "technicians", technician.id), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
                showToast("อัปเดตข้อมูลช่างเรียบร้อยแล้ว", "success");
            } else {
                await addDoc(collection(db, "technicians"), {
                    ...formData,
                    createdAt: serverTimestamp()
                });
                showToast("เพิ่มช่างผู้ให้บริการสำเร็จ", "success");
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
                            {isEdit ? 'แก้ไขข้อมูลช่างผู้ให้บริการ' : 'เพิ่มช่างผู้ให้บริการใหม่'}
                        </h2>
                        <p className="text-xs text-stone-500 mt-0.5">ระบุรายละเอียดข้อมูลส่วนบุคคลและสถานะการทำงาน</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-400 hover:text-[#3e2723] hover:bg-[#efebe9] rounded-lg transition-colors"
                    >
                        <Icons.X />
                    </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Avatar Preview */}
                    <div className="flex items-center gap-4 p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4]">
                        <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white border border-[#d7ccc8] flex-shrink-0 flex items-center justify-center">
                            {formData.imageUrl ? (
                                <Image
                                    src={formData.imageUrl}
                                    alt="Preview"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={() => setFormData(p => ({ ...p, imageUrl: '' }))}
                                />
                            ) : (
                                <span className="text-[#8d6e63] font-semibold text-lg">
                                    {formData.firstName ? formData.firstName.charAt(0).toUpperCase() : <Icons.User />}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <label className="block text-xs font-medium text-[#5d4037] mb-1">ลิงก์ URL รูปภาพประจำตัว</label>
                            <input
                                type="url"
                                name="imageUrl"
                                value={formData.imageUrl || ''}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="https://example.com/avatar.jpg"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">ชื่อจริง <span className="text-rose-600">*</span></label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName || ''}
                                onChange={handleChange}
                                required
                                className={inputClass}
                                placeholder="เช่น สมคิด"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">นามสกุล</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName || ''}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="เช่น เจริญสุข"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">เบอร์โทรศัพท์ <span className="text-rose-600">*</span></label>
                            <input
                                type="tel"
                                name="phoneNumber"
                                value={formData.phoneNumber || ''}
                                onChange={handleChange}
                                required
                                className={inputClass}
                                placeholder="08x-xxx-xxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">สถานะเริ่มต้น</label>
                            <select
                                name="status"
                                value={formData.status || 'available'}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="available">พร้อมทำงาน (Available)</option>
                                <option value="on_trip">กำลังทำงาน (On Trip)</option>
                                <option value="unavailable">ลาหยุด (Unavailable)</option>
                                <option value="suspended">พักงาน (Suspended)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">LINE User ID</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#06c755]">
                                <Icons.Line />
                            </div>
                            <input
                                type="text"
                                name="lineUserId"
                                value={formData.lineUserId || ''}
                                onChange={handleChange}
                                className={`${inputClass} pl-9 font-mono text-xs`}
                                placeholder="U1234567890abcdef..."
                            />
                        </div>
                        <p className="text-[11px] text-stone-500 mt-1">ใช้สำหรับการส่งแจ้งเตือนคิวงานอัตโนมัติผ่าน LINE Official</p>
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

// --- Status Filter Keys ---
const STATUS_FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'available', label: 'พร้อมทำงาน' },
    { key: 'on_trip', label: 'กำลังทำงาน' },
    { key: 'unavailable', label: 'ลาหยุด' },
    { key: 'suspended', label: 'พักงาน' },
];

export default function TechniciansPage() {
    const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
    const { showToast } = useToast();

    const fetchTechnicians = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'technicians'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setAllTechnicians(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Technician)));
        } catch {
            showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลช่าง", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTechnicians();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Statistics Calculation (Zero-Noise Metric Strip)
    const stats = useMemo(() => {
        const total = allTechnicians.length;
        const available = allTechnicians.filter(t => t.status === 'available').length;
        const onTrip = allTechnicians.filter(t => t.status === 'on_trip').length;
        const offDuty = allTechnicians.filter(t => t.status === 'unavailable' || t.status === 'suspended').length;
        return { total, available, onTrip, offDuty };
    }, [allTechnicians]);

    // Filtering logic
    const filteredTechnicians = useMemo(() => {
        return allTechnicians.filter(tech => {
            const matchesStatus = statusFilter === 'all' || tech.status === statusFilter;
            const q = searchTerm.trim().toLowerCase();
            const fullName = `${tech.firstName || ''} ${tech.lastName || ''}`.toLowerCase();
            const matchesSearch = !q || fullName.includes(q) || (tech.phoneNumber && tech.phoneNumber.includes(q));
            return matchesStatus && matchesSearch;
        });
    }, [allTechnicians, statusFilter, searchTerm]);

    const confirmDelete = async () => {
        if (!technicianToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "technicians", technicianToDelete.id));
            setAllTechnicians(prev => prev.filter(b => b.id !== technicianToDelete.id));
            showToast("ลบข้อมูลช่างเรียบร้อยแล้ว", "success");
        } catch {
            showToast("ไม่สามารถลบข้อมูลช่างได้", "error");
        } finally {
            setIsDeleting(false);
            setTechnicianToDelete(null);
        }
    };

    const copyLineId = (lineId: string) => {
        navigator.clipboard.writeText(lineId).then(() => {
            showToast("คัดลอก LINE User ID แล้ว", "success");
        });
    };

    const openAddModal = () => {
        setEditingTechnician(null);
        setShowFormModal(true);
    };

    const openEditModal = (tech: Technician) => {
        setEditingTechnician(tech);
        setShowFormModal(true);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Confirmation & Form Modals */}
            <ConfirmationModal
                show={!!technicianToDelete}
                title="ยืนยันการลบช่างผู้ให้บริการ"
                message={`คุณต้องการลบข้อมูลช่าง "${technicianToDelete?.firstName} ${technicianToDelete?.lastName || ''}" ออกจากระบบหรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้`}
                onConfirm={confirmDelete}
                onCancel={() => setTechnicianToDelete(null)}
                isProcessing={isDeleting}
            />

            <TechnicianFormModal
                open={showFormModal}
                onClose={() => setShowFormModal(false)}
                onSave={fetchTechnicians}
                technician={editingTechnician}
            />

            {/* 1. Frameless Clean Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>ช่างผู้ให้บริการ</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">จัดการช่างผู้ให้บริการ</h1>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#efebe9] text-[#5d4037] tabular-nums">
                            {allTechnicians.length} คน
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all"
                    >
                        <Icons.Plus />
                        <span>เพิ่มช่างใหม่</span>
                    </button>
                </div>
            </div>

            {/* 2. Zero-Noise Unified Metric Bar (UI_DESIGN_SYSTEM Rule 5.1.1) */}
            <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-[#e7e0da] rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#f0eae4] shadow-sm">
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${statusFilter === 'all' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ช่างทั้งหมด</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums mt-0.5">
                            {stats.total} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#efebe9] text-[#5d4037] flex items-center justify-center">
                        <Icons.Users />
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter('available')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${statusFilter === 'available' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">พร้อมทำงาน</div>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
                            {stats.available} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <Icons.CheckCircle />
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter('on_trip')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${statusFilter === 'on_trip' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">กำลังทำงาน</div>
                        <div className="text-xl sm:text-2xl font-bold text-amber-800 tabular-nums mt-0.5">
                            {stats.onTrip} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
                        <Icons.Clock />
                    </div>
                </div>

                <div
                    onClick={() => setStatusFilter('unavailable')}
                    className={`p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-colors ${statusFilter === 'unavailable' ? 'bg-[#faf8f5]' : 'hover:bg-[#fcfbf9]'}`}
                >
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ลาหยุด / พักงาน</div>
                        <div className="text-xl sm:text-2xl font-bold text-rose-700 tabular-nums mt-0.5">
                            {stats.offDuty} <span className="text-xs font-normal text-stone-500">คน</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                        <Icons.AlertCircle />
                    </div>
                </div>
            </div>

            {/* 3. Search & Filter Matrix */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-[#e7e0da] shadow-sm">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                        <Icons.Search />
                    </div>
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อช่าง, นามสกุล หรือเบอร์โทรศัพท์..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-[#faf8f5] border border-[#e7e0da] rounded-lg text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-[#5d4037] transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
                        >
                            <Icons.X />
                        </button>
                    )}
                </div>

                {/* Filter Pills + View Mode */}
                <div className="flex items-center gap-2 justify-between sm:justify-end overflow-x-auto">
                    <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-lg border border-[#f0eae4]">
                        {STATUS_FILTERS.map(filter => {
                            const active = statusFilter === filter.key;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => setStatusFilter(filter.key)}
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
                    <p className="text-xs text-stone-500 mt-3 font-medium">กำลังโหลดข้อมูลช่าง...</p>
                </div>
            ) : filteredTechnicians.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-14 h-14 rounded-full bg-[#faf8f5] text-[#8d6e63] flex items-center justify-center mx-auto mb-3 border border-[#f0eae4]">
                        <Icons.User />
                    </div>
                    <h3 className="text-sm font-semibold text-[#3e2723]">ไม่พบข้อมูลช่างผู้ให้บริการ</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        {searchTerm ? `ไม่พบรายการที่ตรงกับ "${searchTerm}" ลองค้นหาด้วยคำอื่น` : 'ยังไม่มีข้อมูลช่างในระบบหรือตามตัวกรองที่เลือก'}
                    </p>
                    <button
                        onClick={openAddModal}
                        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] transition-colors"
                    >
                        <Icons.Plus /> เพิ่มช่างคนแรก
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {filteredTechnicians.map(tech => (
                        <div
                            key={tech.id}
                            className="group bg-white border border-[#e7e0da] hover:border-[#5d4037]/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#faf8f5] border border-[#d7ccc8] flex-shrink-0 flex items-center justify-center">
                                        {tech.imageUrl ? (
                                            <Image
                                                src={tech.imageUrl}
                                                alt={tech.firstName}
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <span className="text-[#5d4037] font-bold text-base">
                                                {tech.firstName ? tech.firstName.charAt(0).toUpperCase() : '?'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-[#3e2723] truncate group-hover:text-[#5d4037] transition-colors">
                                            {tech.firstName} {tech.lastName || ''}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                                            <Icons.Phone />
                                            <span className="font-mono tabular-nums">{tech.phoneNumber || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & LINE ID badges */}
                                <div className="space-y-1.5 mb-3">
                                    <div className="flex items-center justify-between">
                                        <StatusBadge status={tech.status} />
                                    </div>

                                    {tech.lineUserId && (
                                        <div className="flex items-center justify-between bg-[#f5f8f5] px-2.5 py-1 rounded-lg border border-emerald-100 text-xs">
                                            <span className="inline-flex items-center gap-1 text-[#06c755] font-medium text-[11px]">
                                                <Icons.Line />
                                                <span className="font-mono text-stone-600 truncate max-w-[120px]">
                                                    {tech.lineUserId}
                                                </span>
                                            </span>
                                            <button
                                                onClick={() => copyLineId(tech.lineUserId!)}
                                                className="text-stone-400 hover:text-emerald-700 transition-colors p-0.5"
                                                title="คัดลอก LINE ID"
                                            >
                                                <Icons.Copy />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-[#f0eae4]">
                                <button
                                    onClick={() => openEditModal(tech)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#5d4037] hover:bg-[#efebe9] border border-[#d7ccc8] transition-colors"
                                >
                                    <Icons.Edit />
                                    <span>แก้ไข</span>
                                </button>
                                <button
                                    onClick={() => setTechnicianToDelete(tech)}
                                    className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                                    title="ลบข้อมูลช่าง"
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
                                    <th className="py-3 px-4">ช่างผู้ให้บริการ</th>
                                    <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                                    <th className="py-3 px-4">LINE User ID</th>
                                    <th className="py-3 px-4">สถานะ</th>
                                    <th className="py-3 px-4 text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f0eae4]">
                                {filteredTechnicians.map(tech => (
                                    <tr key={tech.id} className="hover:bg-[#fbf9f7] transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[#faf8f5] border border-[#d7ccc8] flex-shrink-0 flex items-center justify-center">
                                                    {tech.imageUrl ? (
                                                        <Image
                                                            src={tech.imageUrl}
                                                            alt={tech.firstName}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    ) : (
                                                        <span className="text-[#5d4037] font-semibold text-xs">
                                                            {tech.firstName ? tech.firstName.charAt(0).toUpperCase() : '?'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[#3e2723]">
                                                        {tech.firstName} {tech.lastName || ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-stone-700 font-mono tabular-nums">
                                            {tech.phoneNumber || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {tech.lineUserId ? (
                                                <div className="inline-flex items-center gap-1.5 bg-[#f5f8f5] px-2 py-0.5 rounded border border-emerald-100">
                                                    <span className="text-[#06c755]"><Icons.Line /></span>
                                                    <span className="font-mono text-stone-600 text-[11px] max-w-[140px] truncate">
                                                        {tech.lineUserId}
                                                    </span>
                                                    <button
                                                        onClick={() => copyLineId(tech.lineUserId!)}
                                                        className="text-stone-400 hover:text-emerald-700 p-0.5"
                                                        title="คัดลอก LINE ID"
                                                    >
                                                        <Icons.Copy />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-stone-400">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <StatusBadge status={tech.status} />
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => openEditModal(tech)}
                                                    className="text-[#5d4037] hover:text-[#3e2723] font-medium hover:underline text-xs"
                                                >
                                                    แก้ไข
                                                </button>
                                                <span className="text-stone-300">|</span>
                                                <button
                                                    onClick={() => setTechnicianToDelete(tech)}
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
