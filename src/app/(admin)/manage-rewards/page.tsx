"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, doc, deleteDoc } from '@/app/lib/supabaseDb';
import { auth } from '@/app/lib/supabaseAuth';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import { addReward } from '@/app/actions/rewardActions';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Gift: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>,
    X: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    Star: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Tag: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
    CheckCircle: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// --- Add Reward Modal ---
interface AddRewardModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    currencySymbol: string;
}

function AddRewardModal({ open, onClose, onSave, currencySymbol }: AddRewardModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        pointsRequired: '',
        discountType: 'percentage',
        discountValue: ''
    });
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim() || !formData.pointsRequired || !formData.discountValue) {
            showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
            return;
        }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                showToast("ไม่พบการยืนยันตัวตนของผู้ดูแลระบบ", "error");
                setSaving(false);
                return;
            }
            const result = await addReward({
                name: formData.name.trim(),
                description: formData.description.trim(),
                pointsRequired: Number(formData.pointsRequired),
                discountType: formData.discountType as 'percentage' | 'fixed',
                discountValue: Number(formData.discountValue),
            }, { adminToken: token });

            if (result.success) {
                showToast('เพิ่มของรางวัลสำเร็จเรียบร้อย', 'success');
                setFormData({ name: '', description: '', pointsRequired: '', discountType: 'percentage', discountValue: '' });
                onSave();
                onClose();
            } else {
                showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
            }
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#e7e0da] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0eae4] bg-[#faf8f5]">
                    <div>
                        <h2 className="text-base font-semibold text-[#3e2723]">เพิ่มของรางวัลใหม่</h2>
                        <p className="text-xs text-stone-500 mt-0.5">กำหนดสิทธิประโยชน์และคะแนนที่ใช้แลก</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-stone-400 hover:text-[#3e2723] hover:bg-[#efebe9] rounded-lg transition-colors"
                    >
                        <Icons.X />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">ชื่อของรางวัล <span className="text-rose-600">*</span></label>
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className={inputClass}
                            placeholder="เช่น คูปองส่วนลด 10% หรือ ส่วนลด 100 บาท"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">รายละเอียดและเงื่อนไข</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={2}
                            className={inputClass}
                            placeholder="ระบุเงื่อนไขการใช้คูปอง เช่น ใช้ได้กับทุกคอร์สนวด..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">คะแนนที่ใช้แลก <span className="text-rose-600">*</span></label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    name="pointsRequired"
                                    value={formData.pointsRequired}
                                    onChange={handleChange}
                                    required
                                    className={`${inputClass} font-mono`}
                                    placeholder="100"
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-medium pointer-events-none">
                                    แต้ม
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">ประเภทส่วนลด</label>
                            <select
                                name="discountType"
                                value={formData.discountType}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="percentage">เปอร์เซ็นต์ (%)</option>
                                <option value="fixed">จำนวนเงิน (บาท)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[#3e2723] mb-1.5">
                            {formData.discountType === 'percentage' ? 'มูลค่าส่วนลด (%) *' : 'มูลค่าส่วนลด (บาท) *'}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                name="discountValue"
                                value={formData.discountValue}
                                onChange={handleChange}
                                required
                                className={`${inputClass} font-mono`}
                                placeholder={formData.discountType === 'percentage' ? '10' : '100'}
                                min="0"
                                max={formData.discountType === 'percentage' ? '100' : undefined}
                            />
                            <span className="absolute right-3 top-2.5 text-xs text-stone-400 font-medium pointer-events-none">
                                {formData.discountType === 'percentage' ? '%' : 'บาท'}
                            </span>
                        </div>
                    </div>

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
                            {saving ? 'กำลังบันทึก...' : 'บันทึกของรางวัล'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ManageRewardsPage() {
    const [rewards, setRewards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [rewardToDelete, setRewardToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    const fetchRewards = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'rewards'), orderBy('pointsRequired', 'asc'));
            const snap = await getDocs(q);
            setRewards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch {
            showToast("เกิดข้อผิดพลาดในการโหลดข้อมูลของรางวัล", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRewards();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Statistics calculation
    const stats = useMemo(() => {
        const total = rewards.length;
        const percentCount = rewards.filter(r => r.discountType === 'percentage').length;
        const fixedCount = rewards.filter(r => r.discountType === 'fixed').length;
        const totalRedeemed = rewards.reduce((sum, r) => sum + (Number(r.redeemedCount) || 0), 0);
        return { total, percentCount, fixedCount, totalRedeemed };
    }, [rewards]);

    const confirmDelete = async () => {
        if (!rewardToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'rewards', rewardToDelete.id));
            setRewards(prev => prev.filter(r => r.id !== rewardToDelete.id));
            showToast('ลบของรางวัลเรียบร้อยแล้ว', 'success');
        } catch (error: any) {
            showToast(`เกิดข้อผิดพลาด: ${error?.message || 'ไม่สามารถลบได้'}`, 'error');
        } finally {
            setIsDeleting(false);
            setRewardToDelete(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5">
            <ConfirmationModal
                show={!!rewardToDelete}
                title="ยืนยันการลบของรางวัล"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบของรางวัล "${rewardToDelete?.name}"? สมาชิกจะไม่สามารถแลกรางวัลนี้ได้อีกต่อไป`}
                onConfirm={confirmDelete}
                onCancel={() => setRewardToDelete(null)}
                isProcessing={isDeleting}
            />

            <AddRewardModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={fetchRewards}
                currencySymbol={profile?.currencySymbol || '฿'}
            />

            {/* 1. Frameless Clean Header (UI_DESIGN_SYSTEM Rule 1.5 & 5.1) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-[#8d6e63] font-medium mb-1">
                        <span>ระบบจัดการสปา</span>
                        <span>/</span>
                        <span>สิทธิประโยชน์ & รางวัล</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723]">จัดการของรางวัลและสิทธิพิเศษ</h1>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#efebe9] text-[#5d4037] tabular-nums">
                            {rewards.length} รายการ
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] shadow-sm hover:shadow transition-all"
                    >
                        <Icons.Plus />
                        <span>เพิ่มของรางวัลใหม่</span>
                    </button>
                </div>
            </div>

            {/* 2. Zero-Noise Unified Metric Bar (UI_DESIGN_SYSTEM Rule 5.1.1) */}
            <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-[#e7e0da] rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#f0eae4] shadow-sm">
                <div className="p-3.5 sm:p-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">ของรางวัลทั้งหมด</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#3e2723] tabular-nums mt-0.5">
                            {stats.total} <span className="text-xs font-normal text-stone-500">รายการ</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#efebe9] text-[#5d4037] flex items-center justify-center">
                        <Icons.Gift />
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">คูปองแบบเปอร์เซ็นต์</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#5d4037] tabular-nums mt-0.5">
                            {stats.percentCount} <span className="text-xs font-normal text-stone-500">รายการ</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#faf6f0] text-[#5d4037] flex items-center justify-center">
                        <Icons.Tag />
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">คูปองส่วนลดเงินสด</div>
                        <div className="text-xl sm:text-2xl font-bold text-[#5d4037] tabular-nums mt-0.5">
                            {stats.fixedCount} <span className="text-xs font-normal text-stone-500">รายการ</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-[#faf6f0] text-[#5d4037] flex items-center justify-center">
                        <Icons.Tag />
                    </div>
                </div>

                <div className="p-3.5 sm:p-4 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">แลกสำเร็จสะสม</div>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums mt-0.5">
                            {stats.totalRedeemed.toLocaleString()} <span className="text-xs font-normal text-stone-500">ครั้ง</span>
                        </div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <Icons.CheckCircle />
                    </div>
                </div>
            </div>

            {/* 3. Content Area */}
            {loading || profileLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-8 h-8 border-2 border-[#d7ccc8] border-t-[#5d4037] rounded-full animate-spin"></div>
                    <p className="text-xs text-stone-500 mt-3 font-medium">กำลังโหลดข้อมูลของรางวัล...</p>
                </div>
            ) : rewards.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-[#e7e0da]">
                    <div className="w-14 h-14 rounded-full bg-[#faf8f5] text-[#8d6e63] flex items-center justify-center mx-auto mb-3 border border-[#f0eae4]">
                        <Icons.Gift />
                    </div>
                    <h3 className="text-sm font-semibold text-[#3e2723]">ยังไม่มีของรางวัลในระบบ</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        เพิ่มรายการของรางวัลเพื่อให้ลูกค้าสมาชิกนำคะแนนสะสมมาแลกส่วนลด
                    </p>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-[#5d4037] hover:bg-[#3e2723] transition-colors"
                    >
                        <Icons.Plus /> เพิ่มของรางวัลรายการแรก
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {rewards.map(reward => (
                        <div
                            key={reward.id}
                            className="group bg-white border border-[#e7e0da] hover:border-[#5d4037]/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-xl bg-[#faf6f0] border border-[#e7e0da] flex items-center justify-center text-[#5d4037] flex-shrink-0">
                                            <Icons.Gift />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-[#3e2723] group-hover:text-[#5d4037] transition-colors">
                                                {reward.name}
                                            </h2>
                                            <span className="inline-block mt-0.5 text-[11px] font-semibold text-[#5d4037] bg-[#faf6f0] border border-[#e7e0da] px-2 py-0.5 rounded-md tabular-nums">
                                                {reward.discountType === 'percentage'
                                                    ? `ลด ${reward.discountValue}%`
                                                    : `ลด ${Number(reward.discountValue).toLocaleString()} บาท`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setRewardToDelete(reward)}
                                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                                        title="ลบของรางวัล"
                                    >
                                        <Icons.Trash />
                                    </button>
                                </div>

                                <p className="text-xs text-stone-500 line-clamp-2 min-h-[32px] mb-3">
                                    {reward.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-[#f0eae4] mt-2">
                                <div className="inline-flex items-center gap-1 text-xs font-bold text-[#5d4037]">
                                    <Icons.Star />
                                    <span className="font-mono tabular-nums text-sm">{reward.pointsRequired}</span>
                                    <span className="text-[11px] font-normal text-stone-500">แต้ม</span>
                                </div>
                                <span className="text-[11px] text-stone-500 bg-[#faf8f5] px-2 py-0.5 rounded-md border border-[#f0eae4] tabular-nums">
                                    แลกแล้ว {reward.redeemedCount || 0} ครั้ง
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
