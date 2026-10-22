"use client";

import { useState, useEffect } from 'react';
import { db, doc, getDoc } from '@/app/lib/supabaseDb';

const DEFAULT_LIFF_ID = '2011943877-970iUhfD';

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
        let timeoutId: NodeJS.Timeout | null = null;

        // Safety timeout: ป้องกันไม่ให้หน้าเว็บหมุนค้างตลอดกาล หาก LIFF SDK หรือเครือข่ายมีปัญหา
        timeoutId = setTimeout(() => {
            if (isMounted) {
                setLoading((prev) => {
                    if (prev) {
                        console.warn("LIFF initialization safety timeout reached (4s). Release loading state.");
                        return false;
                    }
                    return false;
                });
            }
        }, 4000);

        const initializeLiff = async () => {
            // 1. ดึงค่า LIFF ID: มีค่า Fallback ทันทีไม่ต้องรอ Network เพื่อไม่ให้หน้าเว็บหมุนค้าง
            let activeLiffId = (liffId || '').trim();

            if (!activeLiffId && typeof window !== 'undefined') {
                activeLiffId = (sessionStorage.getItem('spa_liff_id_cache') || '').trim();
            }

            if (!activeLiffId) {
                activeLiffId = (process.env.NEXT_PUBLIC_LIFF_ID || '').trim();
            }

            if (!activeLiffId) {
                activeLiffId = DEFAULT_LIFF_ID;
            }

            // โหลดค่าล่าสุดจากหน้าตั้งค่าระบบใน Background เพื่ออัปเดต cache สำหรับรอบถัดไป
            if (typeof window !== 'undefined') {
                getDoc(doc(db, 'settings', 'notifications')).then((snap) => {
                    const isPresent = typeof snap?.exists === 'function' ? snap.exists() : Boolean(snap?.exists);
                    if (isPresent) {
                        const data = snap.data();
                        const dbLiffId = (data?.lineNotifications?.liffId || '').trim();
                        if (dbLiffId) {
                            sessionStorage.setItem('spa_liff_id_cache', dbLiffId);
                        }
                    }
                }).catch(() => {});
            }

            const isLineApp = typeof window !== 'undefined' && /Line\//i.test(window.navigator.userAgent);

            // หากเปิดในเบราว์เซอร์ปกติบนคอมพิวเตอร์ช่วงพัฒนา ให้ใช้ Mock เพื่อความสะดวกในการทดสอบ
            if (isDevelopment && !isLineApp) {
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

            // 2. โหลด LIFF SDK (ใช้ window.liff จาก CDN ก่อนเป็นลำดับแรกเพื่อเสถียรภาพสูงสุดบน iOS)
            try {
                let liff = (typeof window !== 'undefined' && (window as any).liff) || null;
                if (!liff) {
                    const liffModule = await import('@line/liff');
                    liff = liffModule.default || liffModule;
                }

                // 3. เริ่มต้นการทำงานของ LIFF SDK
                try {
                    await liff.init({ liffId: activeLiffId });
                } catch (initErr: any) {
                    if (initErr?.message && initErr.message.includes('client features')) {
                        console.warn("Retrying liff.init after delay...");
                        await new Promise(r => setTimeout(r, 300));
                        await liff.init({ liffId: activeLiffId });
                    } else {
                        throw initErr;
                    }
                }

                // 4. ตรวจสอบสถานะ Login: ไม่บังคับ redirect อัตโนมัติเมื่อเปิดผ่าน External Browser ทั่วไป เพื่อให้เปิดดูข้อมูลหน้าเว็บได้ไม่ Error
                if (!liff.isInClient() && !liff.isLoggedIn()) {
                    console.info("Opened in external browser without LINE login session.");
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

                // 6. จัดการ Deep link (liff.state) หลังจาก init สำเร็จ
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
                if (timeoutId) clearTimeout(timeoutId);
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initializeLiff();

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [liffId]); // eslint-disable-line react-hooks/exhaustive-deps

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
