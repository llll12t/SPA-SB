"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, signOut } from "@/app/lib/supabaseAuth";
import { format } from "date-fns";
import { th } from "date-fns/locale";

// --- Icons ---
const Icons = {
    Menu: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>,
    Close: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
    ChevronDown: ({ className }: { className?: string }) => <svg className={`w-3.5 h-3.5 ${className || ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>,
    Bell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    Logout: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Spa: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C9 5 6 8 6 11a6 6 0 0012 0c0-3-3-6-6-9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 0 2-3 5-4M12 11c0 0-2-3-5-4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22v-4" />
        </svg>
    ),
};

// --- Hook ---
function useClickOutside(ref: React.RefObject<any>, handler: (e: MouseEvent) => void) {
    useEffect(() => {
        const listener = (e: MouseEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return;
            handler(e);
        };
        document.addEventListener("mousedown", listener);
        return () => document.removeEventListener("mousedown", listener);
    }, [ref, handler]);
}

interface NavItem { name: string; href: string; }
interface NavLinkConfig { name: string; href?: string; items?: NavItem[]; }

// --- Nav Links ---
const navLinks: NavLinkConfig[] = [
    { name: "แดชบอร์ด", href: "/dashboard" },
    { name: "ปฏิทิน", href: "/calendar" },
    {
        name: "ข้อมูลหลัก",
        items: [
            { name: "สร้างการนัดหมาย", href: "/create-appointment" },
            { name: "บริการ", href: "/services" },
            { name: "ช่าง", href: "/technicians" },
            { name: "ลูกค้า", href: "/customers" },
        ]
    },
    {
        name: "วิเคราะห์",
        items: [
            { name: "ของรางวัล", href: "/manage-rewards" },
            { name: "วิเคราะห์", href: "/analytics" },
            { name: "รีวิวลูกค้า", href: "/reviews" },
        ]
    },
    {
        name: "ตั้งค่า",
        items: [
            { name: "จัดการบุคลากร", href: "/employees" },
            { name: "ตั้งค่าระบบ", href: "/settings" },
        ]
    },
];

interface NavLinkProps {
    link: NavLinkConfig;
    currentPath: string;
    onClick?: () => void;
}

// --- Desktop NavLink ---
const NavLink: React.FC<NavLinkProps> = ({ link, currentPath, onClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    useClickOutside(dropdownRef, () => setIsOpen(false));

    const isActive = link.items
        ? link.items.some(i => currentPath.startsWith(i.href))
        : (link.href && currentPath === link.href);

    if (link.items) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 rounded-lg transition-all duration-150
                        ${isActive
                            ? 'text-white bg-white/20'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                >
                    {link.name}
                    <Icons.ChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-[#e8ddd7] z-50 overflow-hidden">
                        <div className="py-1">
                            {link.items.map(item => (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => { setIsOpen(false); onClick?.(); }}
                                    className={`flex items-center px-4 py-2.5 text-sm transition-colors
                                        ${currentPath === item.href || currentPath.startsWith(item.href + '/')
                                            ? 'bg-[#f5ede8] text-[#5D4037] font-semibold'
                                            : 'text-gray-600 hover:bg-[#fdf8f6] hover:text-[#5D4037]'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!link.href) return null;

    return (
        <Link
            href={link.href}
            onClick={onClick}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150
                ${isActive
                    ? 'text-white bg-white/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
        >
            {link.name}
        </Link>
    );
};

interface AdminNavbarProps {
    notifications?: any[];
    unreadCount?: number;
    onMarkAsRead?: () => void;
    onClearAll?: () => void;
}

// --- Main Navbar ---
export default function AdminNavbar({ notifications = [], unreadCount = 0, onMarkAsRead, onClearAll }: AdminNavbarProps) {
    const pathname = usePathname() || '';
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    useClickOutside(notifRef, () => setIsNotifOpen(false));

    const handleLogout = async () => {
        try { await signOut(auth); router.push("/"); }
        catch (e) { console.error("Error signing out:", e); }
    };

    const toggleNotif = () => {
        setIsNotifOpen(prev => !prev);
    };

    const hasUnread = unreadCount > 0;

    return (
        <nav className="bg-gradient-to-r from-[#5D4037] via-[#4a3429] to-[#3E2723] sticky top-0 z-40 shadow-md">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-14 items-center gap-4">

                    {/* Left: Logo */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {isMobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
                        </button>
                        <Link href="/dashboard" className="flex items-center gap-2.5 group">
                            <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
                                <Icons.Spa />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-sm font-bold text-white leading-tight">SPA Admin</p>
                                <p className="text-[10px] text-white/50 leading-tight">Management Panel</p>
                            </div>
                        </Link>
                    </div>

                    {/* Center: Desktop Nav */}
                    <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
                        {navLinks.map(link => <NavLink key={link.name} link={link} currentPath={pathname} />)}
                    </div>

                    {/* Right: Notifications & Logout */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">

                        {/* Notification Bell */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={toggleNotif}
                                className={`relative p-2 rounded-lg transition-all duration-150
                                    ${hasUnread
                                        ? 'text-white bg-white/20 hover:bg-white/30'
                                        : 'text-white/70 hover:text-white hover:bg-white/10'
                                    }`}
                                aria-label="การแจ้งเตือน"
                            >
                                <Icons.Bell />
                                {hasUnread && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-400 rounded-full border-2 border-[#3E2723] animate-pulse" />
                                )}
                            </button>

                            {isNotifOpen && (
                                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-[#e8ddd7] z-50 overflow-hidden">
                                    {/* Notif Header */}
                                    <div className="px-4 py-3 bg-gradient-to-r from-[#5D4037] to-[#3E2723] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icons.Bell />
                                            <span className="text-sm font-semibold text-white">
                                                การแจ้งเตือน
                                            </span>
                                            {hasUnread && (
                                                <span className="text-xs bg-rose-400 text-white px-1.5 py-0.5 rounded-full font-bold">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            {hasUnread && (
                                                <button
                                                    onClick={onMarkAsRead}
                                                    className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                                                    title="อ่านทั้งหมด"
                                                >
                                                    <Icons.Check />
                                                </button>
                                            )}
                                            {notifications.length > 0 && (
                                                <button
                                                    onClick={onClearAll}
                                                    className="p-1.5 text-white/70 hover:text-rose-300 hover:bg-white/15 rounded-lg transition-colors"
                                                    title="ลบทั้งหมด"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notif List */}
                                    <div className="max-h-72 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-2">
                                                    <Icons.Bell />
                                                </div>
                                                <p className="text-sm text-gray-400">ไม่มีการแจ้งเตือน</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-[#f0e8e4]">
                                                {notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        className={`px-4 py-3 flex gap-3 transition-colors hover:bg-[#fdf8f6] ${!n.isRead ? 'bg-[#fdf5f0]' : ''}`}
                                                    >
                                                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.type === 'error' ? 'bg-rose-400' : 'bg-[#8D6E63]'}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                                                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
                                                            <p className="text-[10px] text-[#A1887F] mt-1">
                                                                {n.createdAt?.toDate
                                                                    ? format(n.createdAt.toDate(), 'dd MMM HH:mm', { locale: th })
                                                                    : 'เพิ่งมาถึง'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150"
                        >
                            <Icons.Logout />
                            <span>ออก</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-white/10 py-3">
                        {navLinks.map(link => (
                            <div key={link.name}>
                                {link.items ? (
                                    <div className="mb-2">
                                        <div className="px-3 py-1 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                            {link.name}
                                        </div>
                                        {link.items.map(item => (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`flex items-center px-4 py-2.5 text-sm rounded-lg mx-1 mb-0.5 transition-colors
                                                    ${pathname === item.href || pathname.startsWith(item.href + '/')
                                                        ? 'bg-white/20 text-white font-semibold'
                                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {item.name}
                                            </Link>
                                        ))}
                                    </div>
                                ) : link.href ? (
                                    <Link
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center px-4 py-2.5 text-sm rounded-lg mx-1 mb-0.5 transition-colors
                                            ${pathname === link.href
                                                ? 'bg-white/20 text-white font-semibold'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {link.name}
                                    </Link>
                                ) : null}
                            </div>
                        ))}
                        <div className="border-t border-white/10 mt-2 pt-2 px-1">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-white/80 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <Icons.Logout />
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
