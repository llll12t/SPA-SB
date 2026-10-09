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
            // Check redirect path first to handle deep linking before LIFF initialization
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const redirectPath = params.get('liff.state');
                if (redirectPath) {
                    window.location.replace(redirectPath);
                    return;
                }
            }

            if (isDevelopment) {
                console.warn("LIFF mock mode is active.");
                const mockLiff = {
                    isInClient: () => true,
                    closeWindow: () => {
                        console.log('Mock: LIFF window closed');
                        window.history.back();
                    },
                    sendMessages: async (messages: any) => {
                        console.log('Mock: Messages sent:', messages);
                        return Promise.resolve();
                    },
                    scanCodeV2: async () => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ value: 'mock-appointment-id-12345' });
                            }, 1000);
                        });
                    }
                };
                setLiffObject(mockLiff);
                setProfile(MOCK_PROFILE);
                setLoading(false);
                return;
            }

            let activeLiffId = liffId;
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

            if (!activeLiffId) {
                setError("ยังไม่ได้ตั้งค่า LIFF ID (กรุณากำหนดในหน้าตั้งค่าระบบ)");
                setLoading(false);
                return;
            }
            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId: activeLiffId });

                if (!liff.isLoggedIn()) {
                    liff.login({
                        redirectUri: window.location.href
                    });
                    return;
                }

                const userProfile = await liff.getProfile();
                setProfile(userProfile);
                setLiffObject(liff);

            } catch (err: any) {
                console.error("LIFF initialization failed", err);

                let userError = 'การเชื่อมต่อ LINE ไม่สมบูรณ์';
                if (err.message && err.message.includes('permission')) {
                    userError = 'สิทธิ์การเข้าถึง LINE ไม่เพียงพอ กรุณาอนุญาตสิทธิ์ในการส่งข้อความ';
                } else if (err.message && err.message.includes('scope')) {
                    userError = 'การตั้งค่า LIFF ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ';
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
    }, [liffId]);

    return { liff: liffObject, profile, loading, error };
};

export default useLiff;
