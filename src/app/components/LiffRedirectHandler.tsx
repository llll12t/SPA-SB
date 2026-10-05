"use client";
import { useEffect } from 'react';

export default function LiffRedirectHandler() {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const redirectPath = params.get('liff.state');
            if (redirectPath) {
                // Instantly redirect to the deep link route (e.g. /my-appointments)
                window.location.replace(redirectPath);
            }
        }
    }, []);

    return null;
}
