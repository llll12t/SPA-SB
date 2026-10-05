"use client";

import Image from 'next/image';
import { Technician } from '@/types';

interface TechnicianCardProps {
    technician: Technician;
    isSelected: boolean;
    onSelect: (technician: Technician) => void;
    isAvailable: boolean;
}

export default function TechnicianCard({ technician, isSelected, onSelect, isAvailable }: TechnicianCardProps) {
    return (
        <div
            onClick={() => isAvailable && onSelect(technician)}
            className={`
                relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 select-none
                ${!isAvailable
                    ? 'opacity-40 grayscale bg-gray-50 cursor-not-allowed border-gray-200'
                    : isSelected
                        ? '!bg-[#5D4037] !border-[#5D4037] !text-white shadow-md shadow-[#5D4037]/20 scale-[1.01] cursor-pointer'
                        : 'bg-white border-[#e8ddd7] hover:border-[#5D4037]/40 hover:bg-[#fdf8f6] text-gray-800 cursor-pointer'
                }
            `}
        >
            {/* Avatar */}
            <div className={`relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 ${isSelected ? 'border-white/30' : 'border-[#e8ddd7]'}`}>
                <Image
                    src={technician.imageUrl || 'https://via.placeholder.com/150'}
                    alt={technician.firstName}
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                    {technician.firstName} {technician.lastName}
                </p>
                <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-white/70' : 'text-[#8D6E63]'}`}>
                    {isAvailable ? '● ว่าง' : '○ ไม่ว่าง'}
                </p>
            </div>

            {/* Check indicator */}
            {isSelected && (
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}
        </div>
    );
}
