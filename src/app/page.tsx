import Link from 'next/link';
import { redirect } from 'next/navigation';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const liffState = params?.['liff.state'];
  if (typeof liffState === 'string' && liffState.trim()) {
    let target = decodeURIComponent(liffState.trim());
    if (!target.startsWith('/')) target = '/' + target;
    redirect(target);
  }

  return (
    <main
      className="min-h-screen relative overflow-hidden flex flex-col justify-between p-5 sm:p-6"
      style={{ background: 'linear-gradient(180deg, #f7f4f0 0%, #faf8f5 50%, #ffffff 100%)' }}
    >
      {/* Decorative background watermark */}
      <div className="fixed top-[-60px] right-[-60px] opacity-[0.04] pointer-events-none z-0">
        <SpaFlowerIcon className="w-96 h-96" color="#5d4037" />
      </div>
      <div className="fixed bottom-[-60px] left-[-60px] opacity-[0.03] pointer-events-none z-0 transform rotate-45">
        <SpaFlowerIcon className="w-80 h-80" color="#5d4037" />
      </div>

      <div className="w-full max-w-md mx-auto relative z-10 flex flex-col my-auto py-6 space-y-5">
        
        {/* Brand Header */}
        <div className="text-center space-y-2.5 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-[#5d4037] mx-auto flex items-center justify-center shadow-md shadow-[#5d4037]/20 border border-[#4a3429]/20">
            <SpaFlowerIcon className="w-9 h-9" color="#faf8f5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.25em] text-[#8d6e63] uppercase">
              Spa & Wellness
            </p>
            <h1 className="text-2xl font-black text-[#3e2723] tracking-tight mt-0.5">
              ระบบจองบริการสปา
            </h1>
            <p className="text-xs text-[#8d6e63] max-w-xs mx-auto mt-1 leading-relaxed">
              ผ่อนคลายและดูแลสุขภาพ ด้วยบริการมาตรฐานระดับพรีเมียม
            </p>
          </div>
        </div>

        {/* Primary Action: Book Service */}
        <div className="pt-1">
          <Link
            href="/appointment"
            className="group relative w-full block overflow-hidden rounded-2xl bg-gradient-to-r from-[#5d4037] to-[#432d26] p-4 text-white shadow-md shadow-[#5d4037]/20 transition-all hover:shadow-lg hover:shadow-[#5d4037]/25 hover:-translate-y-0.5 active:scale-[0.99] border border-[#5d4037]"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white shrink-0">
                  <svg className="w-5 h-5 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">จองบริการสปาและนวด</h2>
                  <p className="text-xs text-[#d7ccc8] mt-0.5">เลือกคอร์ส วันที่ และรอบเวลาที่สะดวก</p>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white transition-all transform group-hover:translate-x-1 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Customer Portals (2 Columns) */}
        <div className="grid grid-cols-2 gap-3">
          {/* My Appointments */}
          <Link
            href="/my-appointments"
            className="group p-3.5 rounded-2xl bg-white border border-[#e7e0da] shadow-xs hover:border-[#8d6e63] hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-[#5d4037]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#5d4037] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#3e2723]">นัดหมายของฉัน</h3>
              <p className="text-[11px] text-[#8d6e63] mt-0.5">เช็กสถานะและคิวบริการ</p>
            </div>
          </Link>

          {/* Rewards & Coupons */}
          <Link
            href="/rewards"
            className="group p-3.5 rounded-2xl bg-white border border-[#e7e0da] shadow-xs hover:border-[#8d6e63] hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-[#5d4037]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 01-2 2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#5d4037] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#3e2723]">รางวัลและแต้มสะสม</h3>
              <p className="text-[11px] text-[#8d6e63] mt-0.5">แลกรับคูปองส่วนลด</p>
            </div>
          </Link>
        </div>

        {/* Staff & Admin Section */}
        <div className="pt-1 space-y-2">
          {/* Employee Check-in Portal */}
          <Link
            href="/check-in"
            className="group flex items-center justify-between p-3 rounded-2xl bg-white border border-[#e7e0da] hover:border-[#8d6e63] transition-all text-xs shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf8f5] border border-[#e7e0da] flex items-center justify-center text-[#5d4037] shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="text-left">
                <span className="font-bold text-[#3e2723] block leading-tight">จุดบริการเช็คอินคิว</span>
                <span className="text-[10px] text-[#8d6e63]">สแกน QR Code หรือค้นหาเบอร์โทรลูกค้า</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#5d4037] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
              เข้าใช้งาน
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>

          {/* Admin / System Login */}
          <Link
            href="/login"
            className="group flex items-center justify-between p-3 rounded-2xl bg-[#faf8f5] border border-[#e7e0da] hover:bg-white hover:border-[#8d6e63] transition-all text-xs"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#e7e0da] flex items-center justify-center text-[#5d4037] shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-left">
                <span className="font-bold text-[#3e2723] block leading-tight">สำหรับเจ้าหน้าที่และผู้ดูแล</span>
                <span className="text-[10px] text-[#8d6e63]">เข้าสู่ระบบจัดการร้านและรายงาน</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#8d6e63] group-hover:text-[#5d4037] group-hover:translate-x-0.5 transition-all flex items-center gap-1">
              เข้าสู่ระบบ
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>

      </div>

      {/* Clean Minimalist Footer */}
      <footer className="relative z-10 text-center text-[10px] text-[#8d6e63] py-2">
        <p>Spa & Wellness Booking System</p>
      </footer>
    </main>
  );
}
