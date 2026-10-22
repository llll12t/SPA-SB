"use client";

import { useState, useEffect } from 'react';

export interface CompletionNoteModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (note: string) => Promise<void>;
    customerName: string;
    serviceInfo: any;
}

const QUICK_TEMPLATES = [
    "ขอบคุณที่ไว้วางใจใช้บริการค่ะ 🙏",
    "หากต้องการคำแนะนำหรือสอบถามเพิ่มเติม ทักสอบถามได้ตลอดนะคะ ✨",
    "แนะนำดื่มน้ำมากๆ และพักผ่อนให้เพียงพอนะคะ 💧",
];

export default function CompletionNoteModal({
    open,
    onClose,
    onSave,
    customerName,
    serviceInfo,
}: CompletionNoteModalProps) {
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setNote('');
            setSaving(false);
        }
    }, [open]);

    if (!open) return null;

    const templateNote = (serviceInfo?.completionNote || '').trim();

    const handleLoadTemplate = () => {
        if (templateNote) {
            setNote(templateNote);
        } else {
            alert('ไม่มีข้อความแนะนำที่กำหนดไว้สำหรับบริการนี้');
        }
    };

    const handleQuickSelect = (text: string) => {
        setNote(text);
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSave(note.trim());
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-md border border-[#e8ddd7] space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f5ede8] border border-[#e8ddd7] flex items-center justify-center text-[#5D4037] text-base shrink-0">
                            💬
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900 leading-tight">ข้อความถึงลูกค้า</h2>
                            <p className="text-xs text-[#8D6E63] mt-1 leading-relaxed">
                                ส่งข้อความขอบคุณหรือคำแนะนำการดูแลหลังบริการให้ <span className="font-semibold text-gray-800">{customerName}</span> ทาง LINE
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg leading-none transition-colors"
                        aria-label="ปิด"
                    >
                        ✕
                    </button>
                </div>

                {/* Service Recommendation Template */}
                {templateNote && (
                    <div className="p-3.5 rounded-xl bg-[#fdf8f6] border border-[#e8ddd7] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[#5D4037] flex items-center gap-1.5">
                                <span>✨ ข้อความแนะนำจากบริการ</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleLoadTemplate}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all shadow-2xs ${
                                    note === templateNote
                                        ? 'bg-[#5D4037] text-white border-[#5D4037]'
                                        : 'bg-white hover:bg-[#f5ede8] text-[#5D4037] border-[#e8ddd7]'
                                }`}
                            >
                                {note === templateNote ? '✓ กำลังใช้งาน' : 'ใช้ข้อความนี้'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-700 bg-white/80 p-2.5 rounded-lg border border-[#e8ddd7]/60 leading-relaxed italic">
                            &quot;{templateNote}&quot;
                        </p>
                    </div>
                )}

                {/* Quick Templates Chips */}
                <div>
                    <span className="block text-[11px] font-semibold text-[#8D6E63] mb-1.5">
                        ข้อความสำเร็จรูป:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_TEMPLATES.map((tmpl, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleQuickSelect(tmpl)}
                                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors text-left ${
                                    note === tmpl
                                        ? 'bg-[#5D4037] text-white border-[#5D4037]'
                                        : 'bg-[#faf7f5] hover:bg-[#f5ede8] text-[#5D4037] border-[#e8ddd7]/70'
                                }`}
                            >
                                {tmpl}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Textarea Input */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-gray-700">ข้อความ (ไม่บังคับ)</label>
                        {note && (
                            <button
                                type="button"
                                onClick={() => setNote('')}
                                className="text-[10px] text-gray-400 hover:text-rose-500 transition-colors font-medium"
                            >
                                ล้างข้อความ
                            </button>
                        )}
                    </div>
                    <textarea
                        className="w-full border border-[#e8ddd7] rounded-xl px-3.5 py-2.5 h-24 resize-none text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5D4037]/20 focus:border-[#5D4037] transition-all bg-[#faf9f8]"
                        placeholder="เช่น ขอบคุณที่ใช้บริการค่ะ แนะนำให้หลีกเลี่ยงการโดนแดดจัดหลังทำทรีตเมนต์นะคะ..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        maxLength={200}
                    />
                    <div className="text-[10px] text-gray-400 mt-1 text-right">
                        {note.length}/200
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-[#f5ede8]">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-[#f5ede8] rounded-xl transition-colors disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#5D4037] hover:bg-[#4a3429] rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                        <span>{saving ? 'กำลังส่ง...' : 'บริการเสร็จสิ้น'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
