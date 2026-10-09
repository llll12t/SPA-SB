"use client";
import { useEffect } from 'react';

export default function LiffRedirectHandler() {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const params = new URLSearchParams(window.location.search);
            const rawLiffState = params.get('liff.state');
            if (!rawLiffState) return;

            // ถอดรหัส URL เช่น %2Fcheck-in -> /check-in
            let targetPath = rawLiffState;
            try {
                targetPath = decodeURIComponent(rawLiffState);
            } catch {
                targetPath = rawLiffState;
            }

            // ตรวจสอบให้แน่ใจว่าขึ้นต้นด้วย /
            if (!targetPath.startsWith('/')) {
                targetPath = `/${targetPath}`;
            }

            const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
            const destinationPath = targetPath.split('?')[0].replace(/\/$/, '') || '/';

            if (currentPath !== destinationPath) {
                // หากยังไม่อยู่ที่หน้าที่ต้องการ (เช่น เปิดจาก External browser แล้ว LINE ส่งมาที่ Root)
                window.location.replace(targetPath);
            } else {
                // หากอยู่ที่หน้านั้นแล้ว ให้ลบ liff.state ออกจาก URL เพื่อป้องกันการ redirect ซ้ำ
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('liff.state');
                window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search || ''));
            }
        } catch (e) {
            console.error("LiffRedirectHandler error:", e);
        }
    }, []);

    return null;
}

