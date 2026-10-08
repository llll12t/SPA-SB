"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, collection, addDoc } from '@/app/lib/supabaseDb';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import ImageUploadBase64 from '@/app/components/ImageUploadBase64';

export default function AddServicePage() {
    const [serviceType, setServiceType] = useState('single');
    const [formData, setFormData] = useState({
        serviceName: '',
        price: '',
        duration: '',
        imageUrl: '',
        details: '',
        completionNote: '',
        addOnServices: [] as any[],
        selectableAreas: [] as any[],
        serviceOptions: [] as any[],
        areaOptions: [] as any[],
    });
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();
    const { profile } = useProfile();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleImageChange = (url: string) => setFormData(prev => ({ ...prev, imageUrl: url }));

    // Handlers
    const handleAddOnChange = (idx: number, field: string, value: string) => {
        const list = [...formData.addOnServices];
        list[idx][field] = value;
        setFormData(prev => ({ ...prev, addOnServices: list }));
    };
    const handleAddAddOn = () =>
        setFormData(prev => ({ ...prev, addOnServices: [...prev.addOnServices, { name: '', price: '', duration: '' }] }));
    const handleRemoveAddOn = (idx: number) =>
        setFormData(prev => ({ ...prev, addOnServices: prev.addOnServices.filter((_, i) => i !== idx) }));

    const handleAddAreaGroup = () =>
        setFormData(prev => ({
            ...prev,
            areaOptions: [...prev.areaOptions, { areaName: '', options: [{ name: '', price: '', duration: '' }] }],
        }));
    const handleRemoveAreaGroup = (idx: number) =>
        setFormData(prev => ({ ...prev, areaOptions: prev.areaOptions.filter((_, i) => i !== idx) }));
    const handleAreaNameChange = (idx: number, val: string) => {
        const list = [...formData.areaOptions];
        list[idx].areaName = val;
        setFormData(prev => ({ ...prev, areaOptions: list }));
    };
    const handleAddOptionToArea = (areaIdx: number) => {
        const list = [...formData.areaOptions];
        list[areaIdx].options.push({ name: '', price: '', duration: '' });
        setFormData(prev => ({ ...prev, areaOptions: list }));
    };
    const handleRemoveOptionFromArea = (areaIdx: number, optIdx: number) => {
        const list = [...formData.areaOptions];
        list[areaIdx].options = list[areaIdx].options.filter((_: any, i: number) => i !== optIdx);
        setFormData(prev => ({ ...prev, areaOptions: list }));
    };
    const handleOptionInAreaChange = (areaIdx: number, optIdx: number, field: string, val: string) => {
        const list = [...formData.areaOptions];
        list[areaIdx].options[optIdx][field] = val;
        setFormData(prev => ({ ...prev, areaOptions: list }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.serviceName.trim()) return showToast('กรุณากรอกชื่อบริการ', 'error');
        if (serviceType === 'single' && (!formData.price || !formData.duration))
            return showToast('กรุณากรอกราคาและระยะเวลาให้ครบถ้วน', 'error');
        if (serviceType === 'area-based-options' && !formData.areaOptions.length)
            return showToast('กรุณาเพิ่มหมวดหมู่และตัวเลือก', 'error');

        setLoading(true);
        try {
            const dataToSave: any = {
                serviceName: formData.serviceName.trim(),
                name: formData.serviceName.trim(),
                serviceType,
                details: formData.details.trim(),
                completionNote: formData.completionNote.trim(),
                imageUrl: formData.imageUrl || '',
                addOnServices: formData.addOnServices.map(a => ({
                    name: a.name,
                    price: Number(a.price) || 0,
                    duration: Number(a.duration) || 0,
                })),
                status: 'available',
                createdAt: new Date(),
            };

            if (serviceType === 'single') {
                dataToSave.price = Number(formData.price) || 0;
                dataToSave.duration = Number(formData.duration) || 0;
            } else if (serviceType === 'area-based-options') {
                dataToSave.areaOptions = formData.areaOptions.map(g => ({
                    areaName: g.areaName,
                    options: g.options.map((o: any) => ({
                        name: o.name,
                        price: Number(o.price) || 0,
                        duration: Number(o.duration) || 0,
                    })),
                }));
                const allOptions = dataToSave.areaOptions.flatMap((g: any) => g.options);
                dataToSave.price = allOptions.length > 0 ? Math.min(...allOptions.map((o: any) => o.price)) : 0;
                dataToSave.duration = allOptions.length > 0 ? Math.min(...allOptions.map((o: any) => o.duration)) : 0;
            }

            await addDoc(collection(db, 'services'), dataToSave);
            showToast('เพิ่มบริการใหม่สำเร็จ!', 'success');
            router.push('/services');
        } catch (error: any) {
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        'w-full h-10 px-3 text-xs sm:text-sm rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] outline-none text-[#3e2723] font-medium transition-all';

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
            {/* 1. Frameless Operations Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/services"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8d6e63] hover:text-[#5d4037] transition-colors"
                        >
                            <span>← จัดการบริการ</span>
                        </Link>
                        <span className="text-[#d7ccc8]">/</span>
                        <h1 className="text-xl sm:text-2xl font-bold text-[#3e2723] tracking-tight">
                            เพิ่มบริการใหม่
                        </h1>
                    </div>
                    <p className="text-xs text-[#8d6e63] mt-0.5">
                        กำหนดชื่อบริการ รูปภาพ อัตราค่าบริการ และตัวเลือกเสริมสำหรับลูกค้า
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/services"
                        className="h-9 px-3.5 text-xs font-bold rounded-xl border border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed] transition-colors flex items-center"
                    >
                        ยกเลิก
                    </Link>
                </div>
            </div>

            {/* 2. Form Content */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info Card */}
                <div className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="pb-2 border-b border-[#e7e0da]">
                        <h2 className="font-bold text-sm text-[#3e2723]">ข้อมูลบริการทั่วไป</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                รูปแบบการคิดราคา
                            </label>
                            <select
                                value={serviceType}
                                onChange={e => setServiceType(e.target.value)}
                                className={inputClass}
                            >
                                <option value="single">ราคาคงที่ (เดี่ยว)</option>
                                <option value="area-based-options">หมวดหมู่แยกตัวเลือก</option>
                            </select>
                        </div>

                        <div className={serviceType === 'single' ? 'sm:col-span-1 lg:col-span-1' : 'sm:col-span-1 lg:col-span-3'}>
                            <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                ชื่อบริการ <span className="text-rose-500">*</span>
                            </label>
                            <input
                                name="serviceName"
                                value={formData.serviceName}
                                onChange={handleChange}
                                required
                                className={inputClass}
                                placeholder="เช่น นวดอโรม่าเธอราปี 60 นาที"
                            />
                        </div>

                        {serviceType === 'single' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                        ราคา (บาท) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                        ระยะเวลา (นาที) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="duration"
                                        value={formData.duration}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                        placeholder="60"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Area-based Options */}
                {serviceType === 'area-based-options' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-[#3e2723]">หมวดหมู่และตัวเลือกย่อย</h3>
                            <button
                                type="button"
                                onClick={handleAddAreaGroup}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#5d4037] text-white hover:bg-[#3e2723] transition-colors"
                            >
                                + เพิ่มหมวดหมู่
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {formData.areaOptions.map((areaGroup, areaIdx) => (
                                <div key={areaIdx} className="bg-white border border-[#e7e0da] rounded-2xl overflow-hidden shadow-2xs">
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f5f2ed] border-b border-[#e7e0da]">
                                        <input
                                            type="text"
                                            value={areaGroup.areaName}
                                            onChange={e => handleAreaNameChange(areaIdx, e.target.value)}
                                            className="flex-1 px-2.5 py-1 text-xs font-bold text-[#3e2723] rounded-lg border border-[#d7ccc8] bg-white outline-none"
                                            placeholder="ชื่อหมวดหมู่ (เช่น แขน, ขา, ทั่วตัว)"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddOptionToArea(areaIdx)}
                                            className="px-2 py-1 text-xs font-bold text-[#5d4037] bg-white border border-[#d7ccc8] rounded-lg hover:bg-[#f5f2ed]"
                                        >
                                            + ตัวเลือก
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAreaGroup(areaIdx)}
                                            className="p-1 text-rose-500 hover:text-rose-700"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="p-3">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[#8d6e63] font-bold border-b border-[#e7e0da]">
                                                    <th className="text-left pb-2">ชื่อตัวเลือก</th>
                                                    <th className="w-20 text-center pb-2">นาที</th>
                                                    <th className="w-24 text-center pb-2">ราคา (บาท)</th>
                                                    <th className="w-6"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e7e0da]/60">
                                                {areaGroup.options.map((opt: any, optIdx: number) => (
                                                    <tr key={optIdx}>
                                                        <td className="py-1.5 pr-2">
                                                            <input
                                                                type="text"
                                                                value={opt.name}
                                                                onChange={e => handleOptionInAreaChange(areaIdx, optIdx, 'name', e.target.value)}
                                                                className="w-full px-2 py-1 border border-[#d7ccc8] rounded-lg text-xs text-[#3e2723]"
                                                                placeholder="เช่น 60 นาที, 90 นาที"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-1">
                                                            <input
                                                                type="number"
                                                                value={opt.duration}
                                                                onChange={e => handleOptionInAreaChange(areaIdx, optIdx, 'duration', e.target.value)}
                                                                className="w-full px-1.5 py-1 border border-[#d7ccc8] rounded-lg text-xs text-center text-[#3e2723]"
                                                                placeholder="60"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 px-1">
                                                            <input
                                                                type="number"
                                                                value={opt.price}
                                                                onChange={e => handleOptionInAreaChange(areaIdx, optIdx, 'price', e.target.value)}
                                                                className="w-full px-1.5 py-1 border border-[#d7ccc8] rounded-lg text-xs text-center text-[#3e2723]"
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="py-1.5 pl-1 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveOptionFromArea(areaIdx, optIdx)}
                                                                className="text-rose-400 hover:text-rose-600"
                                                            >
                                                                ✕
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Media & Details Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Image Box */}
                    <div className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-2">
                        <label className="block text-xs font-bold text-[#3e2723] uppercase">
                            รูปภาพบริการ
                        </label>
                        <ImageUploadBase64 imageUrl={formData.imageUrl} onImageChange={handleImageChange} />
                    </div>

                    {/* Description Notes */}
                    <div className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                คำอธิบายบริการ
                            </label>
                            <textarea
                                name="details"
                                value={formData.details}
                                onChange={handleChange}
                                rows={3}
                                className="w-full p-3 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] resize-none font-medium placeholder:text-[#a1887f]"
                                placeholder="รายละเอียดขั้นตอนการบริการ..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#3e2723] uppercase mb-1">
                                ข้อความส่งให้ลูกค้าหลังจบงาน
                            </label>
                            <textarea
                                name="completionNote"
                                value={formData.completionNote}
                                onChange={handleChange}
                                rows={2}
                                className="w-full p-3 text-xs rounded-xl bg-[#faf8f5] border border-[#d7ccc8] focus:bg-white focus:border-[#5d4037] outline-none text-[#3e2723] resize-none font-medium placeholder:text-[#a1887f]"
                                placeholder="เช่น ดื่มน้ำอุ่นมากๆ หลีกเลี่ยงอากาศเย็น..."
                            />
                        </div>
                    </div>

                    {/* Add-ons List */}
                    <div className="bg-white border border-[#e7e0da] rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[#e7e0da]">
                            <label className="text-xs font-bold text-[#3e2723] uppercase">บริการเสริม (Add-ons)</label>
                            <button
                                type="button"
                                onClick={handleAddAddOn}
                                className="px-2.5 py-1 text-xs font-bold bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] rounded-lg hover:bg-[#ebdccc] transition-colors"
                            >
                                + เพิ่ม
                            </button>
                        </div>
                        {formData.addOnServices.length === 0 ? (
                            <p className="text-xs text-[#8d6e63] text-center py-5">ยังไม่มีบริการเสริม</p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {formData.addOnServices.map((addOn, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 p-2 bg-[#faf8f5] rounded-xl border border-[#e7e0da]">
                                        <input
                                            type="text"
                                            value={addOn.name}
                                            onChange={e => handleAddOnChange(idx, 'name', e.target.value)}
                                            className="flex-1 px-2 py-1 text-xs rounded-lg border border-[#d7ccc8] bg-white text-[#3e2723]"
                                            placeholder="ชื่อ"
                                        />
                                        <input
                                            type="number"
                                            value={addOn.duration}
                                            onChange={e => handleAddOnChange(idx, 'duration', e.target.value)}
                                            className="w-14 px-1 py-1 text-xs text-center rounded-lg border border-[#d7ccc8] bg-white text-[#3e2723]"
                                            placeholder="นาที"
                                        />
                                        <input
                                            type="number"
                                            value={addOn.price}
                                            onChange={e => handleAddOnChange(idx, 'price', e.target.value)}
                                            className="w-16 px-1 py-1 text-xs text-center rounded-lg border border-[#d7ccc8] bg-white text-[#3e2723]"
                                            placeholder="บาท"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAddOn(idx)}
                                            className="text-rose-500 hover:text-rose-700 px-1"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Row */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 h-10 rounded-xl border border-[#d7ccc8] text-xs font-bold text-[#5d4037] hover:bg-[#f5f2ed] transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 h-10 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึกบริการใหม่'}
                    </button>
                </div>
            </form>
        </div>
    );
}
