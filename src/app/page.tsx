import Link from 'next/link';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default function Home() {
  return (
    <main
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-between p-5 sm:p-6"
      style={{ background: 'linear-gradient(180deg, #f5f0eb 0%, #faf8f5 45%, #ffffff 100%)' }}
    >
      {/* Background Decorative Floral Watermarks */}
      <div className="fixed top-[-40px] right-[-40px] opacity-[0.06] pointer-events-none z-0">
        <SpaFlowerIcon className="w-72 h-72" color="#5d4037" />
      </div>
      <div className="fixed bottom-[-60px] left-[-60px] opacity-[0.05] pointer-events-none z-0 transform rotate-45">
        <SpaFlowerIcon className="w-80 h-80" color="#5d4037" />
      </div>
      <div className="fixed top-[45%] right-[-30px] opacity-[0.03] pointer-events-none z-0 transform -rotate-12">
        <SpaFlowerIcon className="w-48 h-48" color="#5d4037" />
      </div>

      <div className="w-full max-w-md mx-auto relative z-10 flex flex-col items-center space-y-7 my-auto py-6">

        {/* Spa Brand Emblem & Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            {/* Outer soft glow ring */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#5d4037] via-[#795548] to-[#4a3429] mx-auto flex items-center justify-center shadow-xl shadow-[#5d4037]/25 ring-8 ring-[#5d4037]/10 transition-transform hover:scale-105">
              <SpaFlowerIcon className="w-13 h-13 text-white" color="#faf8f5" />
            </div>
            {/* Small gold sparkle badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-sm">
              ✦
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-[#8d6e63] uppercase">
              Welcome to
            </p>
            <h1 className="text-3xl font-black text-[#3e2723] tracking-tight mt-1">
              SPA & WELLNESS
            </h1>
            <p className="text-xs text-[#8d6e63] max-w-xs mx-auto mt-1.5 leading-relaxed">
              สัมผัสประสบการณ์แห่งความผ่อนคลาย ฟื้นฟูร่างกายและจิตใจอย่างสมบูรณ์แบบ
            </p>
          </div>
        </div>

        {/* Primary Action: Book Service */}
        <div className="w-full space-y-3">
          <Link
            href="/appointment"
            className="group relative w-full block overflow-hidden rounded-3xl bg-gradient-to-r from-[#5d4037] via-[#4a3429] to-[#3e2723] p-5 text-white shadow-lg shadow-[#5d4037]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#5d4037]/35 hover:-translate-y-0.5 active:scale-[0.99] border border-[#5d4037]"
          >
            {/* Subtle watermark inside card */}
            <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none">
              <SpaFlowerIcon className="w-32 h-32" color="#ffffff" />
            </div>

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-2xl shadow-inner shrink-0">
                  🌿
                </div>
                <div className="text-left">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    <span>✦ ยอดนิยม</span>
                  </div>
                  <h3 className="text-lg font-bold text-white leading-tight">จองบริการสปา & นวด</h3>
                  <p className="text-xs text-[#d7ccc8] mt-0.5">เลือกคอร์สและรอบเวลาที่คุณสะดวก</p>
                </div>
              </div>

              <div className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white transition-all transform group-hover:translate-x-1 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Secondary 2-Column Portal Cards */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* My Appointments */}
            <Link
              href="/my-appointments"
              className="group p-4 rounded-3xl bg-white border border-[#e7e0da] shadow-sm hover:shadow-md hover:border-[#8d6e63] transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-lg shadow-xs">
                  📅
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-50 group-hover:bg-[#5d4037] group-hover:text-white flex items-center justify-center text-gray-400 text-xs transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#3e2723]">นัดหมายของฉัน</h4>
                <p className="text-[11px] text-[#8d6e63] mt-0.5">เช็กสถานะ & QR Code</p>
              </div>
            </Link>

            {/* Coupons & Rewards */}
            <Link
              href="/rewards"
              className="group p-4 rounded-3xl bg-white border border-[#e7e0da] shadow-sm hover:shadow-md hover:border-[#8d6e63] transition-all duration-200 active:scale-[0.98] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-lg shadow-xs">
                  🎁
                </div>
                <div className="w-6 h-6 rounded-full bg-gray-50 group-hover:bg-[#5d4037] group-hover:text-white flex items-center justify-center text-gray-400 text-xs transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#3e2723]">ของรางวัล & แต้ม</h4>
                <p className="text-[11px] text-[#8d6e63] mt-0.5">แลกรับคูปองส่วนลด</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Staff & Admin Entry */}
        <div className="w-full pt-1">
          <Link
            href="/login"
            className="group flex items-center justify-between p-3.5 rounded-2xl bg-white/70 backdrop-blur-sm border border-[#e7e0da] hover:bg-white hover:border-[#8d6e63] transition-all text-xs shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-sm text-[#5d4037]">
                🔐
              </div>
              <div>
                <span className="font-bold text-[#3e2723] block leading-tight">สำหรับเจ้าหน้าที่ & ผู้ดูแลระบบ</span>
                <span className="text-[10px] text-[#8d6e63]">เข้าสู่ระบบจัดการร้านและบันทึกงาน</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#5d4037] group-hover:translate-x-0.5 transition-transform">
              เข้าสู่ระบบ →
            </span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-2 w-full pt-2 border-t border-[#e7e0da]/70 text-center">
          <div className="p-2 rounded-2xl bg-white/60 border border-[#e7e0da]/60">
            <span className="text-sm block">🌸</span>
            <span className="text-[10px] font-bold text-[#3e2723] block mt-0.5">ธรรมชาติ 100%</span>
            <span className="text-[9px] text-[#8d6e63]">น้ำมันออร์แกนิก</span>
          </div>
          <div className="p-2 rounded-2xl bg-white/60 border border-[#e7e0da]/60">
            <span className="text-sm block">✨</span>
            <span className="text-[10px] font-bold text-[#3e2723] block mt-0.5">ผู้เชี่ยวชาญ</span>
            <span className="text-[9px] text-[#8d6e63]">มาตรฐานสปา</span>
          </div>
          <div className="p-2 rounded-2xl bg-white/60 border border-[#e7e0da]/60">
            <span className="text-sm block">💬</span>
            <span className="text-[10px] font-bold text-[#3e2723] block mt-0.5">LINE สะดวก</span>
            <span className="text-[9px] text-[#8d6e63]">แจ้งเตือนทันที</span>
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <footer className="relative z-10 text-center text-[10px] text-[#8d6e63] pt-4">
        <p>© 2024 Spa & Massage Booking System • All Rights Reserved</p>
      </footer>
    </main>
  );
}
