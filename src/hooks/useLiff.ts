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
        let isMounted = true;

        const initializeLiff = async () => {
            // 1. ดึงค่า LIFF ID: ให้ความสำคัญกับค่าจากหน้าตั้งค่าระบบ (Admin Settings > ระบบ & การเชื่อมต่อ) เป็นอันดับแรก
            let activeLiffId = (liffId || '').trim();

            // ตรวจสอบจาก Cache ชั่วคราวใน session เพื่อให้เปิดหน้าได้ทันที ไม่ต้องรอเครือข่าย
            if (!activeLiffId && typeof window !== 'undefined') {
                activeLiffId = (sessionStorage.getItem('spa_liff_id_cache') || '').trim();
            }

            // ดึงจากฐานข้อมูลหน้า Settings (settings -> notifications -> lineNotifications.liffId)
            if (!activeLiffId) {
                try {
                    const snap = await getDoc(doc(db, 'settings', 'notifications'));
                    const isPresent = typeof snap?.exists === 'function' ? snap.exists() : Boolean(snap?.exists);
                    if (isPresent) {
                        const data = snap.data();
                        activeLiffId = (data?.lineNotifications?.liffId || '').trim();
                        if (activeLiffId && typeof window !== 'undefined') {
                            sessionStorage.setItem('spa_liff_id_cache', activeLiffId);
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch LIFF ID from settings:", e);
                }
            }

            // Fallback เผื่อกรณีไม่ได้กำหนดในหน้าตั้งค่า
            if (!activeLiffId) {
                activeLiffId = (process.env.NEXT_PUBLIC_LIFF_ID || '').trim();
            }

            const isLineApp = typeof window !== 'undefined' && /Line\//i.test(window.navigator.userAgent);

            // หากเปิดในเบราว์เซอร์ปกติบนคอมพิวเตอร์ช่วงพัฒนา และไม่ได้ระบุ LIFF ID ให้ใช้ Mock
            if (isDevelopment && !isLineApp && !activeLiffId) {
                console.warn("LIFF mock mode is active (Desktop development).");
                const mockLiff = {
                    isInClient: () => false,
                    isLoggedIn: () => true,
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
                if (isMounted) {
                    setLiffObject(mockLiff);
                    setProfile(MOCK_PROFILE);
                    setLoading(false);
                }
                return;
            }

            if (!activeLiffId) {
                if (isMounted) {
                    setError("ยังไม่ได้ตั้งค่า LIFF ID (กรุณากำหนดในหน้าตั้งค่าระบบ > ระบบ & การเชื่อมต่อ)");
                    setLoading(false);
                }
                return;
            }

            // 2. โหลด LIFF SDK (ใช้ window.liff จาก CDN ก่อนเป็นลำดับแรกเพื่อเสถียรภาพสูงสุดบน iOS)
            try {
                let liff = (typeof window !== 'undefined' && (window as any).liff) || null;
                if (!liff) {
                    const liffModule = await import('@line/liff');
                    liff = liffModule.default || liffModule;
                }

                // 3. เริ่มต้นการทำงานของ LIFF SDK โดยไม่ดัดแปลง URL ก่อน init
                try {
                    await liff.init({ liffId: activeLiffId });
                } catch (initErr: any) {
                    // หากเกิดข้อผิดพลาดในการโหลด extension ให้หน่วงเวลาและลองใหม่อีกครั้ง
                    if (initErr?.message && initErr.message.includes('client features')) {
                        console.warn("Retrying liff.init after extension delay...");
                        await new Promise(r => setTimeout(r, 400));
                        await liff.init({ liffId: activeLiffId });
                    } else {
                        throw initErr;
                    }
                }

                await liff.ready;

                // 4. ตรวจสอบสถานะ Login (เฉพาะ External Browser ห้ามเรียกในแอป LINE)
                if (!liff.isInClient()) {
                    if (!liff.isLoggedIn()) {
                        liff.login({
                            redirectUri: window.location.href
                        });
                        return;
                    }
                }

                // 5. ดึงข้อมูล Profile อย่างปลอดภัย
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
                                    displayName: idToken.name || 'คุณลูกค้า',
                                    pictureUrl: idToken.picture
                                };
                            }
                        } catch (tokenErr) {
                            console.warn("Could not decode ID token:", tokenErr);
                        }
                    }
                }

                if (isMounted) {
                    setProfile(userProfile);
                    setLiffObject(liff);
                    setError('');
                }

                // 6. ตรวจสอบการเปลี่ยนเส้นทาง Deep link (liff.state) หลังจาก init สำเร็จเรียบร้อยแล้วเท่านั้น
                if (typeof window !== 'undefined') {
                    try {
                        const params = new URLSearchParams(window.location.search);
                        const rawLiffState = params.get('liff.state');
                        if (rawLiffState) {
                            let targetPath = decodeURIComponent(rawLiffState);
                            if (!targetPath.startsWith('/')) {
                                targetPath = `/${targetPath}`;
                            }
                            const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
                            const destinationPath = targetPath.split('?')[0].replace(/\/$/, '') || '/';

                            if (currentPath !== destinationPath) {
                                window.location.replace(targetPath);
                                return;
                            }
                        }
                    } catch (navErr) {
                        console.warn("LIFF post-init navigation error:", navErr);
                    }
                }

            } catch (err: any) {
                console.error("LIFF initialization failed:", err);

                let userError = 'การเชื่อมต่อ LINE ไม่สมบูรณ์';
                if (err?.message && err.message.includes('client features')) {
                    userError = 'ไม่สามารถโหลดฟีเจอร์ LINE ได้ กรุณารีเฟรชหรือเปิดใหม่อีกครั้ง';
                } else if (err?.message && err.message.includes('permission')) {
                    userError = 'สิทธิ์การเข้าถึง LINE ไม่เพียงพอ (กรุณาตรวจสอบ Scope ใน LINE Developers)';
                } else if (err?.message && err.message.includes('scope')) {
                    userError = 'การตั้งค่า Scopes ใน LIFF ไม่ถูกต้อง';
                } else if (err?.message) {
                    userError = `ข้อผิดพลาด LIFF: ${err.message}`;
                }

                if (isMounted) {
                    setError(userError);

                    if (isDevelopment) {
                        console.warn('Setting up fallback mock data for development');
                        setLiffObject({
                            isInClient: () => false,
                            isLoggedIn: () => true,
                            closeWindow: () => window.history.back(),
                            sendMessages: async () => console.log('Mock: Messages sent (fallback)')
                        });
                        setProfile(MOCK_PROFILE);
                    }
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeLiff();

        return () => {
            isMounted = false;
        };
    }, [liffId]); // eslint-disable-line react-hooks/exhaustive-deps

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
