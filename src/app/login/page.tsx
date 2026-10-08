"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence, onAuthStateChanged } from '@/app/lib/supabaseAuth';
import { doc, getDoc, db } from '@/app/lib/supabaseDb';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [error, setError] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const router = useRouter();

    const [storeName, setStoreName] = useState('');

    useEffect(() => {
        const savedEmail = localStorage.getItem('adminEmail');
        if (savedEmail) {
            setEmail(savedEmail);
        }

        const fetchProfile = async () => {
            try {
                const docRef = doc(db, 'settings', 'profile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setStoreName(docSnap.data().storeName || 'SPA & MASSAGE');
                }
            } catch (err) {
                console.error("Error fetching store profile:", err);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const adminDocRef = doc(db, 'admins', user.uid);
                const adminDocSnap = await getDoc(adminDocRef);
                if (adminDocSnap.exists()) {
                    router.push('/dashboard');
                } else {
                    setCheckingAuth(false);
                }
            } else {
                setCheckingAuth(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmail(value);
        localStorage.setItem('adminEmail', value);
    };

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const adminDocRef = doc(db, 'admins', user.uid);
            const adminDocSnap = await getDoc(adminDocRef);

            if (adminDocSnap.exists()) {
                setRedirecting(true);
                router.push('/dashboard');
            } else {
                await signOut(auth);
                setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
            }

        } catch (error: any) {
            console.error("Admin Login Error:", error);
            let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
            switch (error.code) {
                case 'auth/missing-env':
                    errorMessage = "ยังไม่ได้เชื่อมต่อ Supabase: กรุณาสร้างไฟล์ .env.local พร้อมระบุค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY";
                    break;
                case 'auth/user-not-found':
                    errorMessage = "ไม่พบผู้ใช้งานนี้ในระบบ";
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "รูปแบบอีเมลไม่ถูกต้อง";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "บัญชีผู้ใช้ถูกระงับ หรือยังไม่ได้ยืนยันอีเมล";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง";
                    break;
                case 'auth/network-request-failed':
                    errorMessage = "ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ Supabase URL";
                    break;
                case 'auth/internal-error':
                    errorMessage = error.message || "เกิดข้อผิดพลาดภายใน กรุณาลองใหม่อีกครั้ง";
                    break;
                default:
                    errorMessage = error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง";
            }
            setError(errorMessage);
        } finally {
            if (!redirecting) {
                setLoading(false);
            }
        }
    };

    // --- Line Login Logic (Truncated for brevity, full implementation requires LIFF types) ---
    // ... Assuming similar logic to JS version but with types if LIFF SDK was installed with types
    // For now, removing LIFF part to focus on basic Admin Login via Email, 
    // as LIFF setup requires more context.

    if (checkingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#faf8f5]">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#d7ccc8] border-t-[#5d4037] mx-auto"></div>
                    <p className="text-xs font-medium text-[#8d6e63]">กำลังตรวจสอบสถานะ...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4 relative">
            {/* Background subtle glow */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#f5f2ed] rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-sm bg-white rounded-3xl p-7 sm:p-8 border border-[#e7e0da] shadow-xl relative z-10 space-y-6">
                {/* Header */}
                <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5f2ed] border border-[#d7ccc8] text-[#5d4037] flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
                        <svg className="w-6 h-6 text-[#5d4037]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-[#3e2723] tracking-tight">{storeName || 'SPA & MASSAGE'}</h1>
                    <p className="text-[#8d6e63] text-xs font-medium mt-1">เข้าสู่ระบบสำหรับผู้ดูแล (Admin Portal)</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="block text-xs font-bold text-[#3e2723] uppercase tracking-wide">
                            อีเมล
                        </label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            value={email}
                            onChange={handleEmailChange}
                            placeholder="admin@example.com"
                            required
                            className="w-full h-10 px-3.5 bg-[#faf8f5] border border-[#d7ccc8] rounded-xl focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] transition-all outline-none text-xs sm:text-sm text-[#3e2723] placeholder:text-[#a1887f] font-medium"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="password-admin" className="block text-xs font-bold text-[#3e2723] uppercase tracking-wide">
                            รหัสผ่าน
                        </label>
                        <input
                            type="password"
                            name="password-admin"
                            id="password-admin"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full h-10 px-3.5 bg-[#faf8f5] border border-[#d7ccc8] rounded-xl focus:bg-white focus:border-[#5d4037] focus:ring-1 focus:ring-[#5d4037] transition-all outline-none text-xs sm:text-sm text-[#3e2723] placeholder:text-[#a1887f] font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-[#d7ccc8] text-[#5d4037] focus:ring-[#5d4037] accent-[#5d4037] cursor-pointer"
                            />
                            <span className="text-xs font-medium text-[#5d4037]">
                                จดจำฉันไว้
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs font-medium animate-in fade-in-50">
                            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="leading-relaxed">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-10 rounded-xl bg-[#5d4037] hover:bg-[#3e2723] text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {redirecting ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                <span>กำลังเข้าสู่ระบบ...</span>
                            </>
                        ) : loading ? (
                            <>
                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                <span>กำลังตรวจสอบ...</span>
                            </>
                        ) : (
                            <span>เข้าสู่ระบบ</span>
                        )}
                    </button>
                </form>

                {/* Footer copyright */}
                <div className="pt-2 text-center border-t border-[#e7e0da]">
                    <p className="text-[11px] text-[#8d6e63]">
                        ระบบจัดการสปาและความงาม © 2026
                    </p>
                </div>
            </div>
        </main>
    );
}
