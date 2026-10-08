"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { fetchEmployees, deleteEmployee, updateEmployeeStatus, promoteEmployeeToAdmin } from '@/app/actions/employeeActions';
import { fetchAdmins, deleteAdmin } from '@/app/actions/adminActions';
import { auth, createUserWithEmailAndPassword, updateProfile } from '@/app/lib/supabaseAuth';
import { db, doc, setDoc, updateDoc, serverTimestamp } from '@/app/lib/supabaseDb';
import { useToast } from '@/app/components/Toast';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { Employee } from '@/types';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Users: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Shield: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Phone: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Mail: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    Line: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 10.2c0-4.6-4.3-8.2-9.5-8.2S2.5 5.6 2.5 10.2c0 4.1 3.4 7.5 8 8.1.3 0 .7.1.8.3.1.2.1.5 0 .8-.1.4-.3 1.4-.3 1.7 0 .5.3.9.9.5l5.2-3.6c2.7-1.4 4.4-4.2 4.4-7.8zM12 14.6c-3.6 0-6.6-2.5-6.6-5.6 0-3.1 3-5.6 6.6-5.6 3.6 0 6.6 2.5 6.6 5.6 0 3.1-3 5.6-6.6 5.6z" /></svg>,
    Edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
};

// ============ MODAL ============
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}
const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e7e0da] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0eae4] bg-[#faf8f5]">
                    <h3 className="text-base font-bold text-[#3e2723]">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-400 hover:text-[#3e2723] hover:bg-[#efebe9] rounded-lg transition-colors"
                    >
                        <Icons.X />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

// ============ IMAGE UPLOADER ============
interface ImageUploaderProps {
    value?: string;
    onChange: (url: string) => void;
}
const ImageUploader = ({ value, onChange }: ImageUploaderProps) => {
    const [preview, setPreview] = useState<string | null>(value || null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const id = `photo-${Math.random().toString(36).substr(2, 9)}`;

    useEffect(() => { setPreview(value || null); }, [value]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('ไฟล์ต้องไม่เกิน 2MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreview(result);
                onChange(result);
            };
            reader.readAsDataURL(file);
        }
    };
    const clear = () => {
        setPreview(null);
        onChange('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex items-center gap-4 p-3 bg-[#faf8f5] rounded-xl border border-[#f0eae4]">
            {preview ? (
                <div className="relative w-14 h-14 rounded-full overflow-hidden border border-[#d7ccc8] flex-shrink-0">
                    <Image src={preview} alt="Profile" fill className="object-cover" unoptimized />
                    <button
                        type="button"
                        onClick={clear}
                        className="absolute top-0 right-0 w-4 h-4 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs"
                    >
                        ×
                    </button>
                </div>
            ) : (
                <div className="w-14 h-14 rounded-full bg-white border border-dashed border-[#d7ccc8] flex items-center justify-center text-[#8d6e63] flex-shrink-0">
                    <Icons.User />
                </div>
            )}
            <div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id={id} />
                <label
                    htmlFor={id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5d4037] hover:text-[#3e2723] cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-[#d7ccc8] shadow-2xs hover:bg-[#efebe9] transition-colors"
                >
                    <Icons.Upload />
                    <span>{preview ? 'เปลี่ยนรูปภาพ' : 'อัปโหลดรูปประจำตัว'}</span>
                </label>
                <p className="text-[11px] text-stone-500 mt-1">ไฟล์ PNG, JPG ไม่เกิน 2MB</p>
            </div>
        </div>
    );
};

// ============ PERSON FORM ============
interface PersonFormProps {
    person: Employee | null;
    type: 'employee' | 'admin';
    onSave: (form: any, isEdit: boolean) => void;
    onCancel: () => void;
    loading: boolean;
}
const PersonForm = ({ person, type, onSave, onCancel, loading }: PersonFormProps) => {
    const isEdit = !!person;
    const isAdmin = type === 'admin';
    const [form, setForm] = useState({
        firstName: person?.firstName || '',
        lastName: person?.lastName || '',
        phone: person?.phoneNumber || '',
        email: person?.email || '',
        password: '',
        lineUserId: person?.lineUserId || '',
        status: person?.status || 'available',
        photoURL: person?.photoURL || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(form, isEdit);
    };

    const inputClass = "w-full px-3 py-2 border border-[#d7ccc8] rounded-lg text-sm text-[#3e2723] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5d4037]/20 focus:border-[#5d4037] bg-white transition-colors";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <ImageUploader value={form.photoURL} onChange={(url) => setForm({ ...form, photoURL: url })} />

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">ชื่อจริง <span className="text-rose-600">*</span></label>
                    <input name="firstName" value={form.firstName} onChange={handleChange} required className={inputClass} placeholder="เช่น วนิดา" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">นามสกุล</label>
                    <input name="lastName" value={form.lastName} onChange={handleChange} className={inputClass} placeholder="เช่น สุขใจ" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">เบอร์โทรศัพท์ <span className="text-rose-600">*</span></label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} required className={inputClass} placeholder="08x-xxx-xxxx" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">LINE User ID</label>
                    <input name="lineUserId" value={form.lineUserId} onChange={handleChange} className={inputClass} placeholder="U1234567..." />
                </div>
            </div>

            {!isEdit && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">อีเมลสำหรับเข้าสู่ระบบ <span className="text-rose-600">*</span></label>
                        <input type="email" name="email" value={form.email} onChange={handleChange} required className={inputClass} placeholder="staff@spa.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">รหัสผ่าน <span className="text-rose-600">*</span></label>
                        <input type="password" name="password" value={form.password} onChange={handleChange} required className={inputClass} placeholder="อย่างน้อย 6 ตัวอักษร" />
                    </div>
                </div>
            )}

            {!isAdmin && (
                <div>
                    <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">สถานะการทำงาน</label>
                    <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                        <option value="available">พร้อมทำงาน (Available)</option>
                        <option value="on_leave">ลาพัก (On Leave)</option>
                        <option value="suspended">พักงาน (Suspended)</option>
                    </select>
                </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#f0eae4] mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-[#5d4037] hover:bg-[#efebe9] border border-[#d7ccc8] transition-colors"
                >
                    ยกเลิก
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm transition-all disabled:opacity-50"
                >
                    {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : (isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงาน')}
                </button>
            </div>
        </form>
    );
};

// ============ PERSON DETAIL ============
interface PersonDetailProps {
    person: Employee;
    type: 'employee' | 'admin';
    onEdit: () => void;
    onPromote: () => void;
    promoting: boolean;
}
const PersonDetail = ({ person, type, onEdit, onPromote, promoting }: PersonDetailProps) => {
    const isAdmin = type === 'admin';
    const statusBadges: Record<string, { label: string, bg: string, text: string }> = {
        available: { label: 'พร้อมทำงาน', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
        on_leave: { label: 'ลาพัก', bg: 'bg-[#faf6f0] border-[#d7ccc8]', text: 'text-[#5d4037]' },
        suspended: { label: 'พักงาน', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' }
    };
    const currentStatus = statusBadges[person.status || 'available'] || statusBadges.available;

    return (
        <div className="text-center space-y-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden mx-auto bg-[#faf6f0] border border-[#d7ccc8] flex items-center justify-center">
                {person.photoURL ? (
                    <Image src={person.photoURL} alt="" fill className="object-cover" unoptimized />
                ) : (
                    <span className="text-2xl font-bold text-[#5d4037]">{person.firstName?.charAt(0)}</span>
                )}
            </div>

            <div>
                <h3 className="text-base font-bold text-[#3e2723]">{person.firstName} {person.lastName || ''}</h3>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mt-1 border ${isAdmin ? 'bg-[#efebe9] border-[#d7ccc8] text-[#3e2723]' : `${currentStatus.bg} ${currentStatus.text}`}`}>
                    {isAdmin ? '🛡️ ผู้ดูแลระบบ (Admin)' : currentStatus.label}
                </span>
            </div>

            <div className="bg-[#faf8f5] rounded-xl p-3 border border-[#f0eae4] text-left text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-[#f0eae4]">
                    <span className="text-stone-500">เบอร์โทรศัพท์</span>
                    <span className="font-mono text-[#3e2723]">{person.phoneNumber || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f0eae4]">
                    <span className="text-stone-500">อีเมล</span>
                    <span className="font-mono text-[#3e2723]">{person.email || '-'}</span>
                </div>
                <div className="flex justify-between py-1">
                    <span className="text-stone-500">LINE User ID</span>
                    <span className="font-mono text-emerald-700">{person.lineUserId || '-'}</span>
                </div>
            </div>

            <div className="flex gap-2.5 pt-2">
                {!isAdmin && (
                    <button
                        onClick={onPromote}
                        disabled={promoting}
                        className="flex-1 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {promoting ? 'กำลังเลื่อน...' : 'เลื่อนตำแหน่งเป็น Admin'}
                    </button>
                )}
                <button
                    onClick={onEdit}
                    className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-[#5d4037] hover:bg-[#3e2723] rounded-lg transition-colors shadow-2xs"
                >
                    แก้ไขข้อมูล
                </button>
            </div>
        </div>
    );
};

// ============ MAIN PAGE ============
export default function StaffPage() {
    const [tab, setTab] = useState<'employee' | 'admin'>('employee');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [admins, setAdmins] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view' | null>(null);
    const [selected, setSelected] = useState<Employee | null>(null);
    const [toDelete, setToDelete] = useState<Employee | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();

    const getAdminToken = async () => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
            showToast('ไม่พบการยืนยันตัวตน', 'error');
            return null;
        }
        return token;
    };

    useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const loadData = async () => {
        setLoading(true);
        const token = await getAdminToken();
        if (!token) {
            setLoading(false);
            return;
        }
        const [empRes, admRes] = await Promise.all([
            fetchEmployees({ adminToken: token }),
            fetchAdmins({ adminToken: token })
        ]);
        if (empRes.success) setEmployees(empRes.employees);
        if (admRes.success) setAdmins(admRes.admins);
        setLoading(false);
    };

    const closeModal = () => { setModalMode(null); setSelected(null); };
    const isAdmin = tab === 'admin';
    const data = isAdmin ? admins : employees;
    const collectionName = isAdmin ? 'admins' : 'employees';

    const handleSave = async (form: any, isEdit: boolean) => {
        if (!isEdit && (!form.firstName || !form.phone || !form.email || !form.password)) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
            return;
        }
        if (!isEdit && form.password.length < 6) {
            showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
            return;
        }
        setSaving(true);
        try {
            if (isEdit && selected) {
                const updateData: any = {
                    firstName: form.firstName,
                    lastName: form.lastName,
                    phoneNumber: form.phone,
                    lineUserId: form.lineUserId,
                    photoURL: form.photoURL || null,
                    updatedAt: new Date()
                };
                if (!isAdmin) updateData.status = form.status;
                await updateDoc(doc(db, collectionName, selected.id), updateData);
                showToast('บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
                const user = userCredential.user;
                await updateProfile(user, { displayName: `${form.firstName} ${form.lastName}`.trim(), photoURL: form.photoURL || null });
                const saveData: any = {
                    uid: user.uid,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    phoneNumber: form.phone,
                    email: user.email,
                    lineUserId: form.lineUserId,
                    photoURL: form.photoURL || null,
                    createdAt: serverTimestamp()
                };
                if (isAdmin) saveData.role = 'admin'; else saveData.status = form.status;
                await setDoc(doc(db, collectionName, user.uid), saveData);
                showToast(isAdmin ? 'เพิ่มผู้ดูแลระบบสำเร็จ' : 'เพิ่มพนักงานสำเร็จ', 'success');
            }
            closeModal();
            loadData();
        } catch (error: any) {
            showToast(error.code === 'auth/email-already-in-use' ? 'อีเมลนี้ถูกใช้งานในระบบแล้ว' : 'เกิดข้อผิดพลาดในการบันทึก', 'error');
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!toDelete?.id) return;
        setIsDeleting(true);
        const token = await getAdminToken();
        if (!token) {
            setIsDeleting(false);
            return;
        }
        const result = isAdmin
            ? await deleteAdmin(toDelete.id, { adminToken: token })
            : await deleteEmployee(toDelete.id, { adminToken: token });
        if (result.success) {
            showToast('ลบข้อมูลสำเร็จ', 'success');
            loadData();
        } else {
            showToast('ไม่สามารถลบข้อมูลได้', 'error');
        }
        setIsDeleting(false);
        setToDelete(null);
    };

    const handlePromote = async () => {
        if (!selected) return;
        setPromoting(true);
        const token = await getAdminToken();
        if (!token) {
            setPromoting(false);
            return;
        }
        const result = await promoteEmployeeToAdmin(selected.id, { adminToken: token });
        if (result.success) {
            showToast('เลื่อนตำแหน่งเป็น Admin สำเร็จ', 'success');
            closeModal();
            loadData();
        } else {
            showToast('เกิดข้อผิดพลาดในการเลื่อนตำแหน่ง', 'error');
        }
        setPromoting(false);
    };

    const handleStatusChange = async (id: string, status: string) => {
        const token = await getAdminToken();
        if (!token) return;
        const result = await updateEmployeeStatus(id, status, { adminToken: token });
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ', 'success');
            loadData();
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            {/* Confirmation & Modals */}
            <ConfirmationModal
                show={!!toDelete}
                title="ยืนยันการลบ"
                message={`คุณต้องการลบ "${toDelete?.firstName} ${toDelete?.lastName || ''}" ออกจากระบบหรือไม่?`}
                onConfirm={handleDelete}
                onCancel={() => setToDelete(null)}
                isProcessing={isDeleting}
            />

            <Modal
                isOpen={modalMode === 'add' || modalMode === 'edit'}
                onClose={closeModal}
                title={modalMode === 'add' ? (isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงานใหม่') : 'แก้ไขข้อมูลบุคลากร'}
            >
                <PersonForm
                    person={modalMode === 'edit' ? selected : null}
                    type={tab}
                    onSave={handleSave}
                    onCancel={closeModal}
                    loading={saving}
                />
            </Modal>

            <Modal isOpen={modalMode === 'view'} onClose={closeModal} title="รายละเอียดบุคลากร">
                {selected && (
                    <PersonDetail
                        person={selected}
                        type={tab}
                        onEdit={() => setModalMode('edit')}
                        onPromote={handlePromote}
                        promoting={promoting}
                    />
                )}
            </Modal>

            {/* 1. Frameless Operations Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>บุคลากร & สิทธิ์การใช้งาน</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">จัดการบุคลากรและทีมงาน</h1>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#efebe9] text-[#5d4037] tabular-nums">
                            {employees.length + admins.length} คน
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setModalMode('add')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all"
                    >
                        <Icons.Plus />
                        <span>{isAdmin ? 'เพิ่มผู้ดูแลระบบ' : 'เพิ่มพนักงานใหม่'}</span>
                    </button>
                </div>
            </div>

            {/* 2. Clean Role Tabs */}
            <div className="flex items-center gap-1 bg-[#faf8f5] p-1 rounded-xl border border-[#e7e0da] w-fit">
                <button
                    onClick={() => setTab('employee')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        tab === 'employee'
                            ? 'bg-[#5d4037] text-white shadow-xs'
                            : 'text-stone-600 hover:text-[#3e2723] hover:bg-white/60'
                    }`}
                >
                    <Icons.Users />
                    <span>พนักงาน ({employees.length})</span>
                </button>
                <button
                    onClick={() => setTab('admin')}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        tab === 'admin'
                            ? 'bg-[#5d4037] text-white shadow-xs'
                            : 'text-stone-600 hover:text-[#3e2723] hover:bg-white/60'
                    }`}
                >
                    <Icons.Shield />
                    <span>ผู้ดูแลระบบ ({admins.length})</span>
                </button>
            </div>

            {/* 3. High-Density Table View */}
            {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                    <p className="text-xs text-stone-500 mt-3 font-medium">กำลังโหลดรายชื่อ...</p>
                </div>
            ) : (
                <div className="bg-white border border-[#e7e0da] rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#faf8f5] border-b border-[#e7e0da] text-stone-500 font-semibold uppercase text-[11px] tracking-wider">
                                <th className="py-3 px-4">{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</th>
                                <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                                <th className="py-3 px-4">{isAdmin ? 'สิทธิ์การใช้งาน' : 'สถานะการทำงาน'}</th>
                                <th className="py-3 px-4 text-right">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f0eae4]">
                            {data.map((person) => (
                                <tr key={person.id} className="hover:bg-[#fbf9f7] transition-colors">
                                    <td className="py-3 px-4">
                                        <div
                                            className="flex items-center gap-3 cursor-pointer group"
                                            onClick={() => { setSelected(person); setModalMode('view'); }}
                                        >
                                            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-[#faf6f0] border border-[#d7ccc8] flex items-center justify-center flex-shrink-0">
                                                {person.photoURL ? (
                                                    <Image src={person.photoURL} alt="" fill className="object-cover" unoptimized />
                                                ) : (
                                                    <span className="text-[#5d4037] font-bold text-xs">{person.firstName?.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[#3e2723] group-hover:text-[#5d4037] transition-colors">
                                                    {person.firstName} {person.lastName || ''}
                                                </div>
                                                <div className="text-[11px] text-stone-400 font-mono">{person.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-stone-700 font-mono tabular-nums">
                                        {person.phoneNumber || '-'}
                                    </td>
                                    <td className="py-3 px-4">
                                        {isAdmin ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5d4037] bg-[#faf6f0] px-2.5 py-0.5 rounded-full border border-[#e7e0da]">
                                                <Icons.Shield />
                                                ผู้ดูแลระบบ (Admin)
                                            </span>
                                        ) : (
                                            <select
                                                value={person.status || 'available'}
                                                onChange={(e) => handleStatusChange(person.id, e.target.value)}
                                                className="text-xs border border-[#d7ccc8] rounded-lg px-2 py-1 bg-white text-[#3e2723] focus:border-[#5d4037] outline-none"
                                            >
                                                <option value="available">🟢 พร้อมทำงาน</option>
                                                <option value="on_leave">🟡 ลาพัก</option>
                                                <option value="suspended">🔴 พักงาน</option>
                                            </select>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="inline-flex items-center gap-2">
                                            <button
                                                onClick={() => { setSelected(person); setModalMode('edit'); }}
                                                className="text-[#5d4037] hover:text-[#3e2723] font-medium hover:underline text-xs"
                                            >
                                                แก้ไข
                                            </button>
                                            <span className="text-stone-300">|</span>
                                            <button
                                                onClick={() => setToDelete(person)}
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

                    {data.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-stone-400 text-xs">ยังไม่มีข้อมูล{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</p>
                            <button
                                onClick={() => setModalMode('add')}
                                className="mt-2 text-xs font-semibold text-[#5d4037] hover:underline"
                            >
                                + เพิ่ม{isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}คนแรก
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
