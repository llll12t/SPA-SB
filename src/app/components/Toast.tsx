"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Define the shape of a Toast
export interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    timestamp: Date;
    link?: string;
}

// Define the context shape
interface ToastContextType {
    showToast: (message: string, type?: Toast['type'], link?: string) => void;
    markAsRead: (id: number) => void;
    markAllAsRead: () => void;
    removeToast: (id: number) => void;
    clearAllToasts: () => void;
    toasts: Toast[];
    hasUnread: boolean;
    latestToast: Toast | null;
    dismissLatestToast: () => void;
    registerAdminBell: (active: boolean) => void;
    hasAdminBell: boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

const ADMIN_PREFIXES = [
    '/dashboard',
    '/appointments',
    '/calendar',
    '/customers',
    '/services',
    '/technicians',
    '/employees',
    '/analytics',
    '/settings',
    '/manage-rewards',
    '/reviews',
    '/connect-line',
    '/create-appointment',
];

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [floatingToasts, setFloatingToasts] = useState<Toast[]>([]);
    const [latestToast, setLatestToast] = useState<Toast | null>(null);
    const [hasAdminBell, setHasAdminBell] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const toastIdRef = useRef(0);
    const latestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pathname = usePathname() || '';

    const isAdminRoute = ADMIN_PREFIXES.some(prefix => pathname.startsWith(prefix)) || pathname.startsWith('/admin');

    const registerAdminBell = useCallback((active: boolean) => {
        setHasAdminBell(active);
    }, []);

    const dismissLatestToast = useCallback(() => {
        setLatestToast(null);
    }, []);

    const showToast = useCallback((message: string, type: Toast['type'] = 'info', link?: string) => {
        toastIdRef.current += 1;
        const id = toastIdRef.current;
        const toast: Toast = { id, message, type, read: false, timestamp: new Date(), link };

        // Keep in history for the Bell box (up to 50 items)
        setToasts(prev => [toast, ...prev].slice(0, 50));
        setHasUnread(true);

        // Set as latest toast for the Bell dropdown / preview banner
        setLatestToast(toast);
        if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
        latestTimeoutRef.current = setTimeout(() => {
            setLatestToast(null);
        }, 4500);

        // Only display floating overlay on non-admin pages (mobile/customer/employee without navbar bell)
        if (!isAdminRoute && !hasAdminBell) {
            setFloatingToasts(prev => [...prev, toast]);
            setTimeout(() => {
                setFloatingToasts(prev => prev.filter(t => t.id !== id));
            }, 4500);
        }
    }, [isAdminRoute, hasAdminBell]);

    const markAsRead = useCallback((id: number) => {
        setToasts(prev => {
            const updated = prev.map(t => t.id === id ? { ...t, read: true } : t);
            const stillHasUnread = updated.some(t => !t.read);
            setHasUnread(stillHasUnread);
            return updated;
        });
    }, []);

    const markAllAsRead = useCallback(() => {
        setToasts(prev => prev.map(t => ({ ...t, read: true })));
        setHasUnread(false);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => {
            const filtered = prev.filter(toast => toast.id !== id);
            const stillHasUnread = filtered.some(t => !t.read);
            setHasUnread(stillHasUnread);
            return filtered;
        });
        setFloatingToasts(prev => prev.filter(t => t.id !== id));
        setLatestToast(prev => prev?.id === id ? null : prev);
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
        setFloatingToasts([]);
        setLatestToast(null);
        setHasUnread(false);
    }, []);

    const shouldShowFloating = !isAdminRoute && !hasAdminBell && floatingToasts.length > 0;

    const contextValue = useMemo(() => ({
        showToast,
        markAsRead,
        markAllAsRead,
        removeToast,
        clearAllToasts,
        toasts,
        hasUnread,
        latestToast,
        dismissLatestToast,
        registerAdminBell,
        hasAdminBell
    }), [
        showToast,
        markAsRead,
        markAllAsRead,
        removeToast,
        clearAllToasts,
        toasts,
        hasUnread,
        latestToast,
        dismissLatestToast,
        registerAdminBell,
        hasAdminBell
    ]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}

            {/* Simple Toast UI Overlay - ONLY for non-admin routes without Bell box */}
            {shouldShowFloating && (
                <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                    {floatingToasts.map(toast => (
                        <div
                            key={toast.id}
                            className={`
              p-4 rounded-xl shadow-lg min-w-[280px] max-w-sm transform transition-all duration-300
              ${toast.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' :
                                toast.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' :
                                    toast.type === 'warning' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                                        'bg-white text-gray-900 border border-gray-200'}
            `}
                            onClick={() => removeToast(toast.id)}
                        >
                            <div className="flex justify-between items-start gap-2">
                                <p className="text-sm font-medium">{toast.message}</p>
                                <button onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }} className="text-gray-400 hover:text-gray-600 font-bold">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
};
