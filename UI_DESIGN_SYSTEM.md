# 🌐 UNIVERSAL UI/UX DESIGN SYSTEM & COMPONENT BLUEPRINT
### คู่มือมาตรฐานการออกแบบ UI/UX สำหรับเว็บแอปพลิเคชัน, แดชบอร์ด และระบบบริหารจัดการ (Universal Web App & Admin Dashboard Standard)

> **วัตถุประสงค์ของเอกสาร**: เอกสารฉบับนี้เป็น **คู่มือมาตรฐานกลาง (Universal Blueprint)** สำหรับใช้เป็นแนวทางการออกแบบและสร้าง UI/UX ในทุกโปรเจกต์ใหม่ ไม่ว่าจะเป็นระบบ Admin Dashboard, ERP, CRM, E-Commerce, ระบบจัดการออเดอร์ หรือ Web Application ทั่วไป เพื่อให้ผลงานมีดีไซน์ที่ทันสมัย เรียบหรู สะอาดตา ใช้งานง่าย และมีความสม่ำเสมอในทุกหน้าจอ

---

## 📑 สารบัญ (Table of Contents)
1. [หลักการออกแบบสากล (Core Design Principles)](#1-หลักการออกแบบสากล-core-design-principles)
2. [ระบบสีและ Color Tokens (Theme-Agnostic Palette)](#2-ระบบสีและ-color-tokens)
3. [ระบบตัวอักษรและตัวเลข (Typography & Number Standards)](#3-ระบบตัวอักษรและตัวเลข-typography)
4. [เส้นขอบ ความโค้งมน และมิติเงา (Radius & Elevation)](#4-เส้นขอบ-ความโค้งมน-และมิติเงา)
5. [แม่แบบ Component สากล (Universal Component Blueprints)](#5-แม่แบบ-component-สากล)
   - [5.1 ส่วนหัวหน้าและแถบเครื่องมือ (Page Header & Actions)](#51-ส่วนหัวหน้าและแถบเครื่องมือ)
   - [5.2 แผงตัวกรองข้อมูลหลายมิติ (Multi-Column Filter Grid)](#52-แผงตัวกรองข้อมูลหลายมิติ)
   - [5.3 ตารางข้อมูลความหนาแน่นสูง (High-Density Data Table)](#53-ตารางข้อมูลความหนาแน่นสูง)
   - [5.4 การ์ดแสดงผลข้อมูล (Multi-Card Grid View)](#54-การ์ดแสดงผลข้อมูล)
   - [5.5 โมดอลจัดการข้อมูลแบบครบวงจร (Unified Action Modal)](#55-โมดอลจัดการข้อมูลแบบครบวงจร)
   - [5.6 ส่วนข้อมูลแบบพับเก็บได้ (Collapsible Progressive Disclosure)](#56-ส่วนข้อมูลแบบพับเก็บได้)
   - [5.7 ฟอร์มบันทึกข้อมูลแบบหลายขั้นตอน (Multi-Step Stepper Form)](#57-ฟอร์มบันทึกข้อมูลแบบหลายขั้นตอน)
6. [แนวปฏิบัติสำหรับฟอร์มและการแจ้งเตือน (Form UX & Validation)](#6-แนวปฏิบัติสำหรับฟอร์มและการแจ้งเตือน)
7. [Checklist การตรวจสอบ UI/UX ก่อนส่งมอบงาน (Universal Checklist)](#7-checklist-การตรวจสอบ-uiux-ก่อนส่งมอบงาน)

---

## 1. หลักการออกแบบสากล (Core Design Principles)

### 1.1 High-Density yet Airy (ข้อมูลครบถ้วน แต่โปร่งตา ไม่อึดอัด)
- ใช้ลำดับชั้นของสายตา (Visual Hierarchy) ด้วยขนาดตัวอักษร น้ำหนักฟอนต์ และสีที่ตัดกันอย่างลงตัว
- ใช้พื้นหลังคอนทราสต์คู่: พื้นหลังหน้าเว็บ `bg-slate-50/60` ตัดกับพื้นผิวการ์ด/ตารางสีขาวบริสุทธิ์ `bg-white`

### 1.2 1-Click Direct Action (ลดการคลิกซ้ำซ้อน)
- **หลีกเลี่ยง**: การสร้างปุ่ม View (ดูข้อมูลเฉยๆ) ที่เมื่อกดดูแล้วต้องกดปุ่ม Edit อีกรอบเพื่อแก้ไข
- **แนะนำ**: ใช้ **Unified Modal** ที่แสดงสรุปข้อมูลครบถ้วนและมีฟอร์มให้จัดการ/เปลี่ยนสถานะ/ออกเอกสารได้ทันทีในคลิกเดียว

### 1.3 Progressive Disclosure (ซ่อนข้อมูลย่อย เปิดเมื่อต้องการ)
- ฟิลด์ข้อมูลหรือตัวเลือกที่ไม่ได้ใช้งานเป็นประจำ ให้ **ซ่อนเป็นค่าเริ่มต้น (Collapsed by Default)**
- แสดงป้าย Badge กำกับ เช่น `มีข้อมูล` หรือ `4 รายการ` บนแถบหัวข้อ เพื่อให้ผู้ใช้ทราบสถานะโดยไม่ต้องกดเปิดดูทุกครั้ง

### 1.4 Real-Time Visual Feedback & Validation (ตอบสนองทันที)
- ช่องกรอกข้อมูลที่มีผลรวม/เป้าหมาย ต้องคำนวณและแสดงผลสด
- เมื่อเกิดข้อผิดพลาด ให้เปลี่ยนสีกรอบเป็นสีเตือน (เช่น `border-rose-300 bg-rose-50/30 text-rose-800`) พร้อมข้อความเตือนทันที

### 1.5 Clean, Compact & Zero-Noise (กระชับ คลีน สบายตา ไม่รกสายตา)
- **Standard Container Frame (ความกว้างหน้าจอมาตรฐาน)**: ทุกหน้า Admin ต้องครอบด้วย Container ความกว้างมาตรฐาน `max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4 sm:space-y-5` เสมอ เพื่อให้อยู่กึ่งกลางหน้าจอและตรงกับสเกลของ Admin Navbar พอดี ป้องกันไม่ให้คอนเทนต์แผ่กว้างล้นจอ (No 100% Edge-to-Edge Sprawl)
- **Frameless Headers (ส่วนหัวแบบไร้กรอบหนา)**: หลีกเลี่ยงการครอบส่วนหัวของหน้าด้วยกล่องการ์ดสีขาวขนาดใหญ่ ให้ใช้หัวข้อแบบโปร่งตา (Frameless Row) โดยตรงบนหน้าจอ เพื่อประหยัดพื้นที่แนวตั้งและเปิดพื้นที่ให้เห็นข้อมูลการทำงานทันที
- **Zero-Noise Metric Bar (แผง KPI ไร้ข้อความซ้ำซ้อน)**: แผงตัวชี้วัดควรเป็นแถบเดียวแบบแบ่งคอลัมน์ (Unified Divided Bar) หรือการ์ดขนาดกะทัดรัด **ห้ามใส่คำบรรยายย่อยยาวๆ ที่บอกเรื่องชัดเจนอยู่แล้ว** (เช่น "เฉพาะรายการของวันนี้", "ยอดรวมของรายการที่ไม่ถูกยกเลิก") ให้เน้นเพียง `หัวข้อสั้น + ตัวเลขขนาดใหญ่ (tabular-nums) + หน่วย`
- **Subtle Breathing Room (ระยะห่างพอดีตา)**: ใช้ระยะห่างแนวตั้ง (Gap) ที่เหมาะสม (16px - 20px) ไม่ห่างหรือเทอะทะจนดันเนื้อหาตารางหลุดจอ
- **Theme Palette**: ยึดสีหลัก **#5d4037 (Mocha)**, **#3e2723 (Deep Espresso)**, และ **#FFFFFF (Pure White)** ควบคู่กับพื้นหลังครีมอุ่น **#faf8f5** และเส้นขอบละมุน **#e7e0da / #d7ccc8**

---

## 2. ระบบสีและ Color Tokens

ระบบสีมาตรฐานถูกออกแบบให้เป็นกลาง (Theme-Agnostic) สามารถปรับเปลี่ยนสีหลัก (Brand Color) เป็นสีใดก็ได้ (เขียว, น้ำเงิน, ม่วง, ส้ม) โดยยังคงโครงสร้าง Contrast ที่ลงตัว:

```
┌──────────────────┬─────────────────┬────────────────────────────────────────┐
│ หมวดหมู่ (Token)  │ ค่าสีแนะนำ (Tailwind) │ วัตถุประสงค์การใช้งาน                    │
├──────────────────┼─────────────────┼────────────────────────────────────────┤
│ Primary Brand    │ Emerald / Indigo│ สีปุ่มหลัก, ยอดรวมเงิน, Active Tabs, สถานะเด่น│
│ Primary Light    │ Brand-50        │ พื้นหลังกล่องไฮไลต์, ป้าย Badge เลือกอยู่      │
│ Primary Border   │ Brand-200 / 300 │ เส้นขอบกล่องไฮไลต์, กรอบปุ่ม Active         │
│ Surface Base     │ #FFFFFF (White) │ การ์ด, แถวตาราง, พื้นที่กรอก Input            │
│ App Background   │ #F8FAFC (Sl-50) │ พื้นหลังหน้าหลัก, แถบหัวตาราง, พื้นที่ฟอร์มย่อย  │
│ Neutral Border   │ #E2E8F0 (Sl-200)│ เส้นขอบการ์ด, เส้นแบ่งตาราง, กรอบ Input      │
│ Text Primary     │ #0F172A (Sl-900)│ หัวข้อหลัก, ชื่อรายการ, ยอดตัวเลขสำคัญ        │
│ Text Secondary   │ #475569 (Sl-600)│ คำอธิบายฟิลด์, ข้อมูลย่อย, เมนูนำทาง         │
│ Text Muted       │ #94A3B8 (Sl-400)│ Placeholder, หมายเหตุประกอบ, วันที่ย่อย       │
│ Status: Success  │ Emerald-50/800  │ อนุมัติแล้ว, สำเร็จ, ครบถ้วน, ชำระเงินแล้ว     │
│ Status: Info     │ Sky/Blue-50/800 │ รอดำเนินการ, เลขเอกสาร, นำทาง               │
│ Status: Warning  │ Amber-50/800    │ รอตรวจสอบ, เครดิตเทอม, ใกล้หมดเวลา           │
│ Status: Danger   │ Rose-50/800     │ ยกเลิก, ยอดเกิน, ลบรายการ, ข้อผิดพลาด        │
└──────────────────┴─────────────────┴────────────────────────────────────────┘
```

### ป้ายสถานะมาตรฐาน (Standard Status Badge Template)
```tsx
// Status Badge Matrix Pattern
<span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${status.badgeClass}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
    <span>{status.label}</span>
</span>
```

---

## 3. ระบบตัวอักษรและตัวเลข (Typography)

- **ชุดฟอนต์มาตรฐาน**: `Inter, Prompt, Plus Jakarta Sans, Sarabun, sans-serif`
- **ตัวเลขและจำนวนเงิน (Numbers & Currency)**:
  - ใช้คลาส `tabular-nums` ทุกครั้งสำหรับช่องตัวเลข จำนวนเงิน สถิติ และลำดับที่
  - จัดตัวเลขชิดขวา (`text-right`) ในคอลัมน์ตารางเสมอ
- **รหัสอ้างอิงและเลขเอกสาร (IDs & Codes)**:
  - ใช้คลาส `font-mono` สำหรับหมายเลข Invoice, Tracking Code, Order ID, SKU, Barcode
- **สัดส่วนขนาดตัวอักษร (Type Scale)**:
  - `text-2xl font-bold text-slate-800`: หัวข้อหน้าหลัก (Page Title)
  - `text-base sm:text-lg font-bold text-slate-900`: หัวข้อ Modal / ยอดเงินรวม
  - `text-xs sm:text-sm font-semibold text-slate-800`: ชื่อรายการ, หัวข้อในตาราง
  - `text-xs text-slate-500`: คำอธิบาย, วันที่, ข้อความช่วยเหลือ
  - `text-[10px] / text-[11px] font-bold uppercase tracking-wide`: ป้ายกำกับหมวดหมู่

---

## 4. เส้นขอบ ความโค้งมน และมิติเงา

- **Modals / Dialogs**: `rounded-3xl shadow-2xl border border-slate-200`
- **Cards & Data Tables**: `rounded-2xl border border-slate-200 shadow-2xs`
- **Sub-cards & Group Containers**: `rounded-xl p-3 bg-slate-50/70 border border-slate-200/80`
- **Inputs / Dropdowns**: `h-8.5 sm:h-9 text-xs rounded-xl border-slate-200 focus:ring-1 focus:ring-primary`
- **Buttons**: `rounded-xl transition-all active:scale-95`

---

## 5. แม่แบบ Component สากล (Universal Component Blueprints)

### 5.1 ส่วนหัวหน้าและแถบเครื่องมือ (Frameless Clean Header - แนะนำ)
รูปแบบหัวข้อโปร่งตา ไร้กรอบการ์ดหนาเตอะ ช่วยประหยัดพื้นที่แนวตั้ง ทำให้เห็นตารางทำงานทันที:

```tsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
        <h1 className="text-xl font-bold text-[#3e2723] tracking-tight">ชื่อหน้าหลักของระบบ</h1>
        <p className="text-xs text-[#8d6e63] mt-0.5">คำอธิบายหน้าที่หรือการทำงานของหน้านี้อย่างกระชับ</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" className="h-9 px-3 text-xs font-bold rounded-xl border-[#d7ccc8] text-[#5d4037] hover:bg-[#f5f2ed] gap-1.5">
            ส่งออกข้อมูล
        </Button>
        <Button className="h-9 px-3.5 text-xs font-bold rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white gap-1.5 shadow-xs">
            + สร้างรายการใหม่
        </Button>
    </div>
</div>
```

### 5.1.1 แผงสถิติสรุปแบบกระชับ ไร้ข้อความซ้ำซ้อน (Zero-Noise Unified Metric Bar)
รวม 4 ตัวชี้วัดไว้ในแถบเดียว แบ่งคอลัมน์ด้วยเส้นคั่นบางเบา ไร้คำบรรยายย่อยรกตา:

```tsx
<div className="bg-white rounded-2xl border border-[#e7e0da] shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-[#e7e0da] grid grid-cols-2 lg:grid-cols-4">
    {/* KPI 1 */}
    <div className="px-5 py-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
            <span>คิวบริการวันนี้</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
            {todayCount} <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
        </div>
    </div>

    {/* KPI 2 */}
    <div className="px-5 py-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">
            <span>รอยืนยัน</span>
            {pendingCount > 0 && <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">ด่วน</span>}
        </div>
        <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
            {pendingCount} <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
        </div>
    </div>

    {/* KPI 3 */}
    <div className="px-5 py-3.5 flex flex-col justify-between">
        <span className="text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">ยอดรวมช่วงนี้</span>
        <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
            {totalRevenue.toLocaleString()} <span className="text-xs font-bold text-[#5d4037]">บาท</span>
        </div>
    </div>

    {/* KPI 4 */}
    <div className="px-5 py-3.5 flex flex-col justify-between">
        <span className="text-[11px] font-bold text-[#8d6e63] uppercase tracking-wider">คิวทั้งหมด</span>
        <div className="mt-2 text-2xl font-extrabold text-[#3e2723] tabular-nums tracking-tight">
            {totalCount} <span className="text-xs font-semibold text-[#8d6e63]">รายการ</span>
        </div>
    </div>
</div>
```

---

### 5.2 แผงตัวกรองข้อมูลหลายมิติ (Multi-Column Filter Grid)
รองรับการค้นหาเลขที่, ดรอปดาวน์เลือกหมวดหมู่, ตัวกรองวันที่ และปุ่มล้างค่า `✕`:

```tsx
<div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
    {/* Filter Row 1: Search & Categories */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end">
        {/* Col 1: Search Keyword / ID */}
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <Search size={13} className="text-slate-500" /> ค้นหาเลขที่ / คำสำคัญ
            </label>
            <div className="relative">
                <Input
                    placeholder="พิมพ์คำค้นหา..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9.5 text-xs rounded-xl bg-slate-50 focus:bg-white pr-8"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>

        {/* Col 2: Category / Entity Filter */}
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase">หมวดหมู่ / กลุ่ม</label>
            <select className="w-full h-9.5 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white">
                <option value="ALL">-- แสดงทั้งหมด --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
        </div>

        {/* Col 3: Datalist Auto-complete Filter */}
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase">รายการเฉพาะ (Auto-complete)</label>
            <Input list="item-datalist" placeholder="พิมพ์ชื่อเพื่อค้นหา..." className="h-9.5 text-xs rounded-xl" />
            <datalist id="item-datalist">
                {items.map((item, idx) => <option key={idx} value={item.name} />)}
            </datalist>
        </div>

        {/* Col 4: Action Controls */}
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} className="flex-1 h-9.5 text-xs font-bold rounded-xl border-slate-300">
                <RotateCcw size={13} className="mr-1" /> ล้างค่า
            </Button>
            <Button onClick={handleSearch} className="flex-1 h-9.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white">
                <Search size={13} className="mr-1" /> กรองข้อมูล
            </Button>
        </div>
    </div>
</div>
```

---

### 5.3 ตารางข้อมูลความหนาแน่นสูง (High-Density Data Table)

```tsx
<div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
    {/* Table Toolbar */}
    <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">รายการทั้งหมด</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                {records.length} รายการ
            </span>
        </div>
        {/* Quick Tabs or View Switcher */}
    </div>

    {/* Table Body */}
    <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold text-xs border-b border-slate-200">
                <tr>
                    <th className="px-3 py-2.5 text-center border-r border-slate-200 w-10">#</th>
                    <th className="px-3.5 py-2.5 border-r border-slate-200 min-w-[130px]">รหัสอ้างอิง / วันที่</th>
                    <th className="px-3.5 py-2.5 border-r border-slate-200 min-w-[180px]">ข้อมูลหลัก (Primary Entity)</th>
                    <th className="px-3.5 py-2.5 border-r border-slate-200 min-w-[180px]">รายละเอียดรายการ</th>
                    <th className="px-3.5 py-2.5 text-right border-r border-slate-200 min-w-[100px]">ยอดรวมสุทธิ</th>
                    <th className="px-3 py-2.5 text-center border-r border-slate-200 min-w-[110px]">สถานะ</th>
                    <th className="px-3 py-2.5 text-right w-24">จัดการ</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-xs">
                {records.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50/90 transition-colors cursor-pointer" onClick={() => handleRowClick(r)}>
                        <td className="px-3 py-3 text-center text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                        <td className="px-3.5 py-3 border-r border-slate-200">
                            <span className="font-mono font-bold text-slate-900 block">{r.code}</span>
                            <span className="text-[11px] text-slate-400">{r.date}</span>
                        </td>
                        <td className="px-3.5 py-3 border-r border-slate-200 font-medium text-slate-800">{r.title}</td>
                        <td className="px-3.5 py-3 border-r border-slate-200 text-slate-600 line-clamp-1">{r.description}</td>
                        <td className="px-3.5 py-3 text-right border-r border-slate-200 font-bold text-slate-900 tabular-nums">
                            {r.total.toLocaleString()} บาท
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-200">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${r.statusClass}`}>
                                {r.statusLabel}
                            </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                                <button className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg">
                                    <Edit2 size={14} />
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
```

---

### 5.4 การ์ดแสดงผลข้อมูล (Multi-Card Grid View)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {records.map(record => (
        <div key={record.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="px-4.5 py-3 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                <span className="font-mono font-bold text-xs text-slate-900">ID: {record.code}</span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                    {record.status}
                </span>
            </div>

            {/* Body */}
            <div className="p-4 space-y-2.5 text-xs">
                <div>
                    <h4 className="font-bold text-sm text-slate-900">{record.title}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">{record.subtitle}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                    {record.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-700 truncate">{item.name}</span>
                            <span className="font-bold tabular-nums text-slate-900">{item.qty} × {item.price} บาท</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4.5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">ยอดสุทธิ</span>
                    <span className="text-base font-bold text-emerald-800 tabular-nums">{record.total.toLocaleString()} บาท</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg">
                        <Edit2 size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={14} />
                    </Button>
                </div>
            </div>
        </div>
    ))}
</div>
```

---

### 5.5 โมดอลจัดการข้อมูลแบบครบวงจร (Unified Action Modal)

```tsx
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
    <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-slate-200">
        {/* Modal Header with Status Selector */}
        <div className="flex justify-between items-center px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Package size={15} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">จัดการรายการ #{item.code}</h3>
                    <p className="text-xs text-slate-500">บันทึกเมื่อ: {item.date}</p>
                </div>
            </div>
            
            {/* Status Dropdown & Close Button */}
            <div className="flex items-center gap-2 shrink-0">
                <select className="h-8.5 px-2.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-800">
                    <option value="ACTIVE">✅ ใช้งานอยู่</option>
                    <option value="PENDING">🕒 รอดำเนินการ</option>
                    <option value="CLOSED">❌ ปิดรายการ</option>
                </select>
                <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/60">
                    <X size={18} />
                </button>
            </div>
        </div>

        {/* Modal Body: 2-Column Summary Cards */}
        <div className="p-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ข้อมูลฝั่งที่ 1</span>
                    <p className="text-sm font-bold text-slate-900">{item.primaryName}</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{item.addressOrNote}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1 flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ข้อมูลฝั่งที่ 2</span>
                        <p className="text-sm font-bold text-slate-900">{item.secondaryName}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-xs text-slate-500">ยอดรวม</span>
                        <span className="text-xs font-bold text-slate-900">{item.total.toLocaleString()} บาท</span>
                    </div>
                </div>
            </div>

            {/* Main Interactive Form Area */}
            {/* ... Form Inputs & Tables ... */}
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-200 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="h-8.5 px-4 rounded-xl text-xs">
                ยกเลิก
            </Button>
            <Button onClick={handleSave} className="h-8.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs">
                บันทึกการเปลี่ยนแปลง
            </Button>
        </div>
    </div>
</div>
```

---

### 5.6 ส่วนข้อมูลแบบพับเก็บได้ (Collapsible Progressive Disclosure)

```tsx
<div className="border-t border-slate-100 pt-2.5">
    <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 text-xs font-semibold text-slate-700 transition-all border border-slate-200/60 shadow-2xs cursor-pointer"
    >
        <span className="flex items-center gap-1.5">
            <Truck size={14} className="text-emerald-600" />
            <span>ข้อมูลเพิ่มเติม / ตัวเลือกขั้นสูง</span>
            {hasData && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    มีข้อมูล
                </span>
            )}
        </span>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
            {isExpanded ? 'คลิกเพื่อซ่อน' : 'คลิกเพื่อระบุ/แก้ไข'}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
    </button>

    {isExpanded && (
        <div className="mt-2.5 space-y-2.5 p-3 bg-slate-50/50 rounded-xl border border-slate-200/60 animate-in fade-in-50">
            {/* Secondary inputs / file uploads */}
        </div>
    )}
</div>
```

---

### 5.7 ฟอร์มบันทึกข้อมูลแบบหลายขั้นตอน (Multi-Step Stepper Form)

```tsx
{/* Stepper Header Pills */}
<div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-semibold">
    <button
        type="button"
        onClick={() => setStep(1)}
        className={`px-3 py-1 rounded-lg transition-all ${step === 1 ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'}`}
    >
        1. ข้อมูลหลัก & รายการ
    </button>
    <button
        type="button"
        onClick={() => setStep(2)}
        disabled={!isStep1Valid}
        className={`px-3 py-1 rounded-lg transition-all ${step === 2 ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-400'}`}
    >
        2. สรุป & ยืนยัน
    </button>
</div>
```

---

## 6. แนวปฏิบัติสำหรับฟอร์มและการแจ้งเตือน

1. **การสลับโหมด (Segmented Controls)**:
   - ใช้แถบสลับปุ่มคู่ (เช่น `ลูกค้าเดิม` vs `ลูกค้าใหม่`) แทน Checkbox แบบดั้งเดิม
2. **การแจ้งเตือนยอดเงินหรือจำนวนเกินเป้าหมาย (Over-allocation)**:
   - แสดงป้ายกำกับชัดเจน: `⚠️ ยอดเกิน ({current} / {target})` ด้วยสีแดง `text-rose-700 bg-rose-50 border-rose-300`
   - เมื่อยอดตรงเป้าหมาย แสดง: `✓ จำนวนทั้งหมด {target}` ด้วยสีเขียว `text-emerald-800 bg-emerald-50 border-emerald-300`
3. **การแสดงผลสกุลเงินและวันที่**:
   - ใช้คำว่า `บาท` ต่อท้ายตัวเลขเสมอ (เช่น `1,500 บาท`) แทนสัญลักษณ์ที่สับสน
   - จัดรูปแบบตัวเลขด้วย `.toLocaleString()` และใส่ `tabular-nums`

---

## 7. Checklist การตรวจสอบ UI/UX ก่อนส่งมอบงาน

- [ ] **Type Check & Build สะอาด**: รัน `npx tsc --noEmit` ได้ผลลัพธ์ Exit Code `0` ไม่มี Type Warning หรือ Error
- [ ] **ความสอดคล้อง (Consistency)**: สไตล์ปุ่ม, ขนาดหัวข้อ, เส้นขอบ และสีสถานะตรงกันทุกหน้าจอ
- [ ] **Responsive Test**: ทดสอบการแสดงผลบนหน้าจอ Mobile (`360px`), Tablet (`768px`) และ Desktop (`1280px+`)
- [ ] **ลบสิ่งที่ซ้ำซ้อน**: ไม่มีปุ่มเปิด View Read-only ซ้ำซ้อนกับปุ่ม Edit Action
- [ ] **Collapsible Defaults**: ฟิลด์ทางเลือกที่ไม่จำเป็นต้องแก้ไขทุกครั้ง ถูกยุบซ่อนไว้พร้อมป้ายกำกับสถานะ
- [ ] **Live Validation**: ตรวจสอบการคำนวณสดและดักจับ Error ป้องกันการส่งข้อมูลผิดพลาด

---
*เอกสารนี้จัดทำขึ้นเป็นคู่มือมาตรฐานสากลสำหรับการพัฒนา Web Application & Enterprise Dashboard*