"use client";

import { useState, useEffect } from 'react';
import { db, doc, getDoc } from '@/app/lib/supabaseDb';

const MOCK_PROFILE = {
    userId: 'U_TEST_1234567890ABCDEF',
    displayName: 'คุณ ทดสอบ',
    pictureUrl: 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7'
};

const useLiff = (liffId?: string) => {
    const [liffObject, setLiffObject] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isDevelopment = process.env.NODE_ENV === 'development';

    useEffect(() => {
        const initializeLiff = async () => {
            // 1. จัดการ Deep link (liff.state) ป้องกันการเกิด Redirect Loop
            if (typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search);
                    const rawLiffState = params.get('liff.state');
                    if (rawLiffState) {
                        let targetPath = rawLiffState;
                        try {
                            targetPath = decodeURIComponent(rawLiffState);
                        } catch {
                            targetPath = rawLiffState;
                        }

                        if (!targetPath.startsWith('/')) {
                            targetPath = `/${targetPath}`;
                        }

                        const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
                        const destinationPath = targetPath.split('?')[0].replace(/\/$/, '') || '/';

                        if (currentPath !== destinationPath) {
                            window.location.replace(targetPath);
                            return;
                        } else {
                            // ลบพารามิเตอร์ liff.state ออกจาก URL เพื่อไม่ให้ redirect ซ้ำ
                            const cleanUrl = new URL(window.location.href);
                            cleanUrl.searchParams.delete('liff.state');
                            window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search || ''));
                        }
                    }
                } catch (e) {
                    console.error("useLiff deep link error:", e);
                }
            }

            // 2. ดึงค่า LIFF ID จาก Props, Env หรือ Supabase Settings
            let activeLiffId = liffId || process.env.NEXT_PUBLIC_LIFF_ID;
            if (!activeLiffId) {
                try {
                    const snap = await getDoc(doc(db, 'settings', 'notifications'));
                    if (snap.exists()) {
                        activeLiffId = snap.data()?.lineNotifications?.liffId;
                    }
                } catch (e) {
                    console.error("Failed to fetch LIFF ID from settings:", e);
                }
            }

            const isLineApp = typeof window !== 'undefined' && /Line\//i.test(window.navigator.userAgent);

            // หากเปิดในเบราว์เซอร์ปกติบนคอมพิวเตอร์ช่วงพัฒนา และไม่ได้ระบุ LIFF ID ให้ใช้ Mock
            if (isDevelopment && !isLineApp && !activeLiffId) {
                console.warn("LIFF mock mode is active (Desktop development).");
                const mockLiff = {
                    isInClient: () => false,
                    closeWindow: () => window.history.back(),
                    sendMessages: async (messages: any) => {
                        console.log('Mock: Messages sent:', messages);
                        return Promise.resolve();
                    },
                    scanCodeV2: async () => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ value: 'mock-appointment-id-12345' });
                            }, 500);
                        });
                    }
                };
                setLiffObject(mockLiff);
                setProfile(MOCK_PROFILE);
                setLoading(false);
                return;
            }

            if (!activeLiffId) {
                setError("ยังไม่ได้ตั้งค่า LIFF ID (กรุณากำหนดในหน้าตั้งค่าระบบ > ระบบ & การเชื่อมต่อ)");
                setLoading(false);
                return;
            }

            // 3. เริ่มต้นการทำงานของ LIFF SDK
            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId: activeLiffId });
                await liff.ready;

                // ⚠️ สำคัญมาก: ห้ามเรียก liff.login() ภายในแอป LINE (in-client) เด็ดขาด
                // ให้เรียกเฉพาะกรณีเปิดใน External Browser (Chrome / Safari) เท่านั้น
                if (!liff.isInClient()) {
                    if (!liff.isLoggedIn()) {
                        liff.login({
                            redirectUri: window.location.href
                        });
                        return;
                    }
                }

                // 4. ดึงข้อมูล Profile อย่างปลอดภัย (พร้อม Fallback เผื่อสิทธิ์ scope profile ไม่ได้เปิด)
                let userProfile: any = null;
                if (liff.isLoggedIn()) {
                    try {
                        userProfile = await liff.getProfile();
                    } catch (profileErr: any) {
                        console.warn("Could not get profile via liff.getProfile():", profileErr);
                        try {
                            const idToken = liff.getDecodedIDToken();
                            if (idToken) {
                                userProfile = {
                                    userId: idToken.sub,
                                    displayName: idToken.name || 'พนักงาน',
                                    pictureUrl: idToken.picture
                                };
                            }
                        } catch (tokenErr) {
                            console.warn("Could not decode ID token:", tokenErr);
                        }
                    }
                }

                setProfile(userProfile);
                setLiffObject(liff);
                setError('');

            } catch (err: any) {
                console.error("LIFF initialization failed:", err);

                let userError = 'การเชื่อมต่อ LINE ไม่สมบูรณ์';
                if (err?.message && err.message.includes('permission')) {
                    userError = 'สิทธิ์การเข้าถึง LINE ไม่เพียงพอ (กรุณาตรวจสอบ Scope ใน LINE Developers)';
                } else if (err?.message && err.message.includes('scope')) {
                    userError = 'การตั้งค่า Scopes ใน LIFF ไม่ถูกต้อง';
                } else if (err?.message) {
                    userError = `ข้อผิดพลาด LIFF: ${err.message}`;
                }

                setError(userError);

                if (isDevelopment) {
                    console.warn('Setting up fallback mock data for development');
                    setLiffObject({
                        isInClient: () => false,
                        closeWindow: () => window.history.back(),
                        sendMessages: async () => console.log('Mock: Messages sent (fallback)')
                    });
                    setProfile(MOCK_PROFILE);
                }
            } finally {
                setLoading(false);
            }
        };

        initializeLiff();
    }, [liffId]); // eslint-disable-line react-hooks/exhaustive-deps

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
