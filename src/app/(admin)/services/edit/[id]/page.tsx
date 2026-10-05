"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, doc, getDoc, updateDoc, serverTimestamp } from '@/app/lib/supabaseDb';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';
import ImageUploadBase64 from '@/app/components/ImageUploadBase64';

const Icons = {
    Back: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

export default function EditServicePage() {
    const params = useParams();
    const id = params?.id as string;
    const [serviceType, setServiceType] = useState('single');
    const [formData, setFormData] = useState({
        serviceName: '', price: '', duration: '', imageUrl: '', details: '', completionNote: '',
        addOnServices: [] as any[], selectableAreas: [] as any[], serviceOptions: [] as any[], areaOptions: [] as any[]
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();
    const { profile } = useProfile();

    useEffect(() => {
        if (!id) return;
        const fetchService = async () => {
            try {
                const docSnap = await getDoc(doc(db, "services", id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setServiceType(data.serviceType || 'single');
                    setFormData({
                        serviceName: data.serviceName || data.name || '',
                        price: data.price ? String(data.price) : '',
                        duration: data.duration ? String(data.duration) : '',
                        imageUrl: data.imageUrl || '',
                        details: data.details || data.description || '',
                        completionNote: data.completionNote || '',
                        addOnServices: Array.isArray(data.addOnServices) ? data.addOnServices.map((a: any) => ({ ...a, price: String(a.price || 0), duration: String(a.duration || 0) })) : [],
                        selectableAreas: Array.isArray(data.selectableAreas) ? data.selectableAreas.map((s: string) => ({ name: s })) : [],
                        serviceOptions: Array.isArray(data.serviceOptions) ? data.serviceOptions.map((o: any) => ({ ...o, price: String(o.price), duration: String(o.duration) })) : [],
                        areaOptions: Array.isArray(data.areaOptions) ? data.areaOptions.map((g: any) => ({ ...g, options: g.options.map((o: any) => ({ ...o, price: String(o.price), duration: String(o.duration) })) })) : []
                    });
                } else {
                    showToast("ไม่พบบริการนี้", "error");
                    router.push('/services');
                }
            } catch (err: any) {
                showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + err.message, "error");
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [id, router, showToast]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleImageChange = (url: string) => setFormData(prev => ({ ...prev, imageUrl: url }));

    const handleAddOnChange = (idx: number, field: string, value: string) => { const list = [...formData.addOnServices]; list[idx][field] = value; setFormData(prev => ({ ...prev, addOnServices: list })); };
    const handleAddAddOn = () => setFormData(prev => ({ ...prev, addOnServices: [...prev.addOnServices, { name: '', price: '', duration: '' }] }));
    const handleRemoveAddOn = (idx: number) => setFormData(prev => ({ ...prev, addOnServices: prev.addOnServices.filter((_, i) => i !== idx) }));

    const handleAddAreaGroup = () => setFormData(prev => ({ ...prev, areaOptions: [...prev.areaOptions, { areaName: '', options: [{ name: '', price: '', duration: '' }] }] }));
    const handleRemoveAreaGroup = (idx: number) => setFormData(prev => ({ ...prev, areaOptions: prev.areaOptions.filter((_, i) => i !== idx) }));
    const handleAreaNameChange = (idx: number, val: string) => { const list = [...formData.areaOptions]; list[idx].areaName = val; setFormData(prev => ({ ...prev, areaOptions: list })); };
    const handleAddOptionToArea = (areaIdx: number) => { const list = [...formData.areaOptions]; list[areaIdx].options.push({ name: '', price: '', duration: '' }); setFormData(prev => ({ ...prev, areaOptions: list })); };
    const handleRemoveOptionFromArea = (areaIdx: number, optIdx: number) => { const list = [...formData.areaOptions]; list[areaIdx].options = list[areaIdx].options.filter((_: any, i: number) => i !== optIdx); setFormData(prev => ({ ...prev, areaOptions: list })); };
    const handleOptionInAreaChange = (areaIdx: number, optIdx: number, field: string, val: string) => { const list = [...formData.areaOptions]; list[areaIdx].options[optIdx][field] = val; setFormData(prev => ({ ...prev, areaOptions: list })); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.serviceName) return showToast("กรุณากรอกชื่อบริการ", "error");
        if (serviceType === 'single' && (!formData.price || !formData.duration)) return showToast("กรุณากรอกราคาและระยะเวลา", "error");
        if (serviceType === 'area-based-options' && !formData.areaOptions.length) return showToast("กรุณาเพิ่มหมวดหมู่และตัวเลือก", "error");

        setSaving(true);
        try {
            const dataToSave: any = {
                serviceName: formData.serviceName, imageUrl: formData.imageUrl || '', details: formData.details || '',
                completionNote: formData.completionNote?.trim() || '',
                addOnServices: formData.addOnServices.map(a => ({ ...a, price: Number(a.price) || 0, duration: Number(a.duration) || 0 })),
                serviceType, updatedAt: serverTimestamp(),
            };

            if (serviceType === 'single') {
                dataToSave.price = Number(formData.price) || 0;
                dataToSave.duration = Number(formData.duration) || 0;
            } else if (serviceType === 'option-based') {
                dataToSave.selectableAreas = formData.selectableAreas.map(a => a.name);
                dataToSave.serviceOptions = formData.serviceOptions.map(opt => ({ name: opt.name, price: Number(opt.price) || 0, duration: Number(opt.duration) || 0 }));
                dataToSave.price = Math.min(...dataToSave.serviceOptions.map((o: any) => o.price));
                dataToSave.duration = Math.min(...dataToSave.serviceOptions.map((o: any) => o.duration));
            } else if (serviceType === 'area-based-options') {
                dataToSave.areaOptions = formData.areaOptions.map(g => ({ areaName: g.areaName, options: g.options.map((o: any) => ({ name: o.name, price: Number(o.price) || 0, duration: Number(o.duration) || 0 })) }));
                const allOptions = dataToSave.areaOptions.flatMap((g: any) => g.options);
                dataToSave.price = allOptions.length > 0 ? Math.min(...allOptions.map((o: any) => o.price)) : 0;
                dataToSave.duration = allOptions.length > 0 ? Math.min(...allOptions.map((o: any) => o.duration)) : 0;
            }

            await updateDoc(doc(db, "services", id), dataToSave);
            showToast("บันทึกการแก้ไขสำเร็จ!", "success");
            router.push('/services');
        } catch (error: any) { showToast("เกิดข้อผิดพลาด: " + error.message, "error"); }
        finally { setSaving(false); }
    };

    const inputClass = "w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

    if (loading) return <div className="flex justify-center items-center min-h-[400px]"><div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-4">
            <div className="flex items-center gap-3 mb-4">
                <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Icons.Back /></button>
                <h1 className="text-xl font-semibold text-gray-900">แก้ไขบริการ</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
                            <div className="px-2.5 py-1.5 border border-gray-300 rounded text-sm bg-gray-50 text-gray-500">
                                {serviceType === 'single' ? 'ราคาคงที่' : serviceType === 'area-based-options' ? 'หมวดหมู่แยกตัวเลือก' : serviceType}
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อบริการ *</label>
                            <input name="serviceName" value={formData.serviceName} onChange={handleChange} required className={inputClass} placeholder="เช่น เลเซอร์กำจัดขน" />
                        </div>
                        {serviceType === 'single' && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">ราคา ({profile?.currencySymbol})</label>
                                    <input type="number" name="price" value={formData.price} onChange={handleChange} required className={inputClass} placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">เวลา (นาที)</label>
                                    <input type="number" name="duration" value={formData.duration} onChange={handleChange} required className={inputClass} placeholder="60" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {serviceType === 'area-based-options' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {formData.areaOptions.map((areaGroup, areaIdx) => (
                            <div key={areaIdx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b">
                                    <input type="text" value={areaGroup.areaName} onChange={(e) => handleAreaNameChange(areaIdx, e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm font-medium text-gray-900 bg-white" placeholder="ชื่อหมวดหมู่ (เช่น แขน, ขา)" />
                                    <button type="button" onClick={() => handleAddOptionToArea(areaIdx)} className="text-xs text-blue-600 font-medium whitespace-nowrap">+ เพิ่ม</button>
                                    <button type="button" onClick={() => handleRemoveAreaGroup(areaIdx)} className="p-1 text-red-500 hover:bg-red-100 rounded"><Icons.Trash /></button>
                                </div>
                                <div className="p-3">
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left pb-2 font-medium">ตัวเลือก</th><th className="w-16 text-center pb-2 font-medium">นาที</th><th className="w-20 text-center pb-2 font-medium">ราคา</th><th className="w-6"></th></tr></thead>
                                        <tbody>
                                            {areaGroup.options.map((opt: any, optIdx: number) => (
                                                <tr key={optIdx} className="border-b border-gray-100 last:border-0">
                                                    <td className="py-1 pr-2"><input type="text" value={opt.name} onChange={(e) => handleOptionInAreaChange(areaIdx, optIdx, 'name', e.target.value)} className="w-full px-2 py-1 border rounded text-sm text-gray-900" placeholder="S, M, L" /></td>
                                                    <td className="py-1 px-1"><input type="number" value={opt.duration} onChange={(e) => handleOptionInAreaChange(areaIdx, optIdx, 'duration', e.target.value)} className="w-full px-1.5 py-1 border rounded text-sm text-center text-gray-900" placeholder="60" /></td>
                                                    <td className="py-1 px-1"><input type="number" value={opt.price} onChange={(e) => handleOptionInAreaChange(areaIdx, optIdx, 'price', e.target.value)} className="w-full px-1.5 py-1 border rounded text-sm text-center text-gray-900" placeholder="0" /></td>
                                                    <td className="py-1 pl-1"><button type="button" onClick={() => handleRemoveOptionFromArea(areaIdx, optIdx)} className="p-0.5 text-red-400 hover:text-red-600"><Icons.Trash /></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddAreaGroup} className="lg:col-span-2 py-2 border border-dashed border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-1">
                            <Icons.Plus /> เพิ่มหมวดหมู่ใหม่
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">รูปภาพ</label>
                        <ImageUploadBase64 imageUrl={formData.imageUrl} onImageChange={handleImageChange} />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">รายละเอียด</label>
                            <textarea name="details" value={formData.details} onChange={handleChange} rows={3} className={inputClass} placeholder="รายละเอียดบริการ..."></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">ข้อความหลังจบงาน</label>
                            <textarea name="completionNote" value={formData.completionNote} onChange={handleChange} rows={2} className={inputClass} placeholder="ข้อความส่งให้ลูกค้า..."></textarea>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-700">บริการเสริม</label>
                            <button type="button" onClick={handleAddAddOn} className="text-xs px-2 py-1 rounded flex items-center gap-1 btn-primary"><Icons.Plus /> เพิ่ม</button>
                        </div>
                        {formData.addOnServices.length === 0 && <p className="text-gray-400 text-xs text-center py-3">ยังไม่มีบริการเสริม</p>}
                        <div className="space-y-1.5">
                            {formData.addOnServices.map((addOn, idx) => (
                                <div key={idx} className="flex items-center gap-1 p-2 bg-gray-50 rounded border">
                                    <input type="text" value={addOn.name} onChange={e => handleAddOnChange(idx, 'name', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm text-gray-900" placeholder="ชื่อ" />
                                    <input type="number" value={addOn.duration} onChange={e => handleAddOnChange(idx, 'duration', e.target.value)} className="w-14 px-2 py-1 border rounded text-sm text-center text-gray-900" placeholder="นาที" />
                                    <input type="number" value={addOn.price} onChange={e => handleAddOnChange(idx, 'price', e.target.value)} className="w-16 px-2 py-1 border rounded text-sm text-center text-gray-900" placeholder="ราคา" />
                                    <button type="button" onClick={() => handleRemoveAddOn(idx)} className="p-1 text-red-500 hover:bg-red-100 rounded"><Icons.Trash /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm font-medium rounded btn-secondary">ยกเลิก</button>
                    <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium rounded btn-primary">
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                </div>
            </form>
        </div>
    );
}
