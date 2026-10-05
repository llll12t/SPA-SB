"use client";

import { useState, useEffect } from 'react';
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
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    X: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
};

// --- Status Badge ---
const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string, bg: string, text: string }> = {
        available: { label: 'พร้อมทำงาน', bg: 'bg-green-100', text: 'text-green-800' },
        on_trip: { label: 'กำลังทำงาน', bg: 'bg-blue-100', text: 'text-blue-800' },
        unavailable: { label: 'ลา', bg: 'bg-yellow-100', text: 'text-yellow-800' },
        suspended: { label: 'พักงาน', bg: 'bg-red-100', text: 'text-red-800' },
    };
    const current = config[status] || { label: status || 'ไม่ระบุ', bg: 'bg-gray-100', text: 'text-gray-700' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${current.bg} ${current.text}`}>{current.label}</span>;
};

// --- Add/Edit Modal ---
interface TechnicianFormModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    technician: Technician | null;
}

function TechnicianFormModal({ open, onClose, onSave, technician }: TechnicianFormModalProps) {
    const [formData, setFormData] = useState<Partial<Technician>>({ firstName: '', lastName: '', phoneNumber: '', lineUserId: '', imageUrl: '', status: 'available' });
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
            setFormData({ firstName: '', lastName: '', phoneNumber: '', lineUserId: '', imageUrl: '', status: 'available' });
        }
    }, [technician, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.firstName || !formData.phoneNumber) {
            showToast("กรุณากรอกชื่อและเบอร์โทรศัพท์", "error");
            return;
        }
        setSaving(true);
        try {
            if (isEdit && technician?.id) {
                await updateDoc(doc(db, "technicians", technician.id), formData);
                showToast("อัปเดตข้อมูลสำเร็จ!", "success");
            } else {
                await addDoc(collection(db, "technicians"), { ...formData, createdAt: serverTimestamp() });
                showToast("เพิ่มพนักงานใหม่สำเร็จ!", "success");
            }
            onSave();
            onClose();
        } catch (error: any) {
            showToast("เกิดข้อผิดพลาด: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md text-gray-500"><Icons.X /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อจริง *</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className={inputClass} placeholder="สมชาย" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} placeholder="ใจดี" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ *</label>
                            <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required className={inputClass} placeholder="08x-xxx-xxxx" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                            <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                                <option value="available">พร้อมให้บริการ</option>
                                <option value="on_trip">กำลังให้บริการ</option>
                                <option value="unavailable">ไม่พร้อม / ลา</option>
                                <option value="suspended">พักงาน</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">LINE User ID</label>
                            <input type="text" name="lineUserId" value={formData.lineUserId} onChange={handleChange} className={inputClass} placeholder="U12345..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">URL รูปภาพ</label>
                            <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleChange} className={inputClass} placeholder="https://..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md btn-secondary">ยกเลิก</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 rounded-md btn-primary">
                            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- Status Filters ---
const STATUS_FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'available', label: 'พร้อมทำงาน' },
    { key: 'on_trip', label: 'กำลังทำงาน' },
    { key: 'unavailable', label: 'ลา' },
    { key: 'suspended', label: 'พักงาน' },
];

export default function TechniciansPage() {
    const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
    const [filteredTechnicians, setFilteredTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
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
        } catch { showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error"); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTechnicians(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setFilteredTechnicians(statusFilter === 'all' ? allTechnicians : allTechnicians.filter(b => b.status === statusFilter));
    }, [statusFilter, allTechnicians]);

    const confirmDelete = async () => {
        if (!technicianToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "technicians", technicianToDelete.id));
            setAllTechnicians(prev => prev.filter(b => b.id !== technicianToDelete.id));
            showToast("ลบข้อมูลสำเร็จ", "success");
        } catch { showToast("ลบข้อมูลไม่สำเร็จ", "error"); }
        finally { setIsDeleting(false); setTechnicianToDelete(null); }
    };

    const openAddModal = () => { setEditingTechnician(null); setShowFormModal(true); };
    const openEditModal = (tech: Technician) => { setEditingTechnician(tech); setShowFormModal(true); };

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConfirmationModal show={!!technicianToDelete} title="ยืนยันการลบ" message={`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน "${technicianToDelete?.firstName}"?`} onConfirm={confirmDelete} onCancel={() => setTechnicianToDelete(null)} isProcessing={isDeleting} />
            <TechnicianFormModal open={showFormModal} onClose={() => setShowFormModal(false)} onSave={fetchTechnicians} technician={editingTechnician} />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">จัดการพนักงาน</h1>
                    <p className="text-sm text-gray-500">ดูรายชื่อและสถานะการทำงานของพนักงานทั้งหมด</p>
                </div>
                <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors btn-primary">
                    <Icons.Plus /> เพิ่มพนักงาน
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white border border-gray-200 rounded-lg p-3 mb-6">
                <div className="flex gap-1 overflow-x-auto w-full md:w-auto">
                    {STATUS_FILTERS.map(filter => (
                        <button key={filter.key} onClick={() => setStatusFilter(filter.key)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${statusFilter === filter.key ? 'btn-primary' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {filter.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-white border rounded-md p-1 ml-auto">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                </div>
            </div>

            {/* Content */}
            {filteredTechnicians.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.User /></div>
                    <p className="text-gray-600 font-medium">ไม่พบข้อมูลพนักงาน</p>
                    <p className="text-sm text-gray-400 mt-1">ลองเปลี่ยนตัวกรองหรือเพิ่มพนักงานใหม่</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredTechnicians.map(tech => (
                        <div key={tech.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 border">
                                    {tech.imageUrl ? <Image src={tech.imageUrl} alt={tech.firstName} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Icons.User /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-900 truncate">{tech.firstName} {tech.lastName}</h3>
                                    <div className="flex items-center gap-1 text-sm text-gray-500">
                                        <Icons.Phone />
                                        <span className="truncate">{tech.phoneNumber || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t">
                                <StatusBadge status={tech.status} />
                                <div className="flex gap-1">
                                    <button onClick={() => openEditModal(tech)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md border"><Icons.Edit /></button>
                                    <button onClick={() => setTechnicianToDelete(tech)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border"><Icons.Trash /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พนักงาน</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredTechnicians.map(tech => (
                                <tr key={tech.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                                                {tech.imageUrl ? <Image src={tech.imageUrl} alt={tech.firstName} fill className="object-cover" unoptimized /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Icons.User /></div>}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{tech.firstName} {tech.lastName}</div>
                                                <div className="text-xs text-gray-400">{tech.lineUserId || '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{tech.phoneNumber || '-'}</td>
                                    <td className="px-6 py-4"><StatusBadge status={tech.status} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openEditModal(tech)} className="text-blue-600 hover:underline text-sm mr-3">แก้ไข</button>
                                        <button onClick={() => setTechnicianToDelete(tech)} className="text-red-600 hover:underline text-sm">ลบ</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
