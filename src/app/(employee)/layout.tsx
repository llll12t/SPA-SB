"use client";

import { LiffProvider } from '@/context/LiffProvider';
import { ProfileProvider } from '@/context/ProfileProvider';
import { ReactNode } from 'react';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
    const employeeLiffId = process.env.NEXT_PUBLIC_LIFF_ID;
    return (
        <LiffProvider liffId={employeeLiffId}>
            <ProfileProvider>
                <div className="bg-[#faf8f5] min-h-screen text-[#3e2723] antialiased admin-theme">
                    <main>
                        {children}
                    </main>
                </div>
            </ProfileProvider>
        </LiffProvider>
    );
}

