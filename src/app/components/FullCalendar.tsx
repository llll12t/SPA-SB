"use client";

import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, addMonths, subMonths, isToday, isBefore } from 'date-fns';
import { th } from 'date-fns/locale';

interface FullCalendarProps {
    selectedDate: string;
    onDateSelect: (date: string) => void;
    weeklySchedule?: any;
    holidayDates?: any[];
    className?: string;
}

export default function FullCalendar({
    selectedDate,
    onDateSelect,
    weeklySchedule = {},
    holidayDates = [],
    className = ''
}: FullCalendarProps) {
    const generateCalendarDays = (month: Date) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
        const days = [];
        let day = startDate;
        while (day <= endDate) {
            days.push(new Date(day));
            day = addDays(day, 1);
        }
        return days;
    };

    const getDateStatus = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];

        if (isBefore(date, new Date().setHours(0, 0, 0, 0))) {
            return { isOpen: false, isPast: true, reason: 'ผ่านไปแล้ว' };
        }

        const specialHoliday = holidayDates.find((h: any) => h.date === dateStr);
        if (specialHoliday) {
            return { isOpen: false, isHoliday: true, reason: specialHoliday.reason || 'วันหยุด' };
        }

        if (!daySchedule || !daySchedule.isOpen) {
            return { isOpen: false, isHoliday: true, reason: 'วันหยุด' };
        }

        return { isOpen: true, openTime: daySchedule.openTime, closeTime: daySchedule.closeTime };
    };

    const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(selectedDate ? new Date(selectedDate) : new Date()));
    const days = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    const navigateMonth = (dir: 'next' | 'prev') => {
        setCurrentMonth(prev => dir === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    return (
        <div className={`select-none bg-white rounded-2xl overflow-hidden shadow-sm border border-[#e8ddd7] ${className}`}>
            {/* Warm Brown Header */}
            <div className="bg-gradient-to-r from-[#5D4037] to-[#3E2723] px-5 py-4 flex items-center justify-between">
                <button
                    onClick={() => navigateMonth('prev')}
                    className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="เดือนก่อนหน้า"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-sm font-semibold text-white tracking-wide">
                    {format(currentMonth, 'MMMM yyyy', { locale: th })}
                </h2>
                <button
                    onClick={() => navigateMonth('next')}
                    className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    aria-label="เดือนถัดไป"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* Calendar Body */}
            <div className="p-4">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-3">
                    {dayNames.map((day, idx) => (
                        <div
                            key={day}
                            className={`text-center text-xs font-semibold pb-2 ${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-sky-400' : 'text-[#8D6E63]'}`}
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-1">
                    {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const status = getDateStatus(day);
                        const isSelected = selectedDate === dateStr;
                        const isTodayDate = isToday(day);
                        const isDisabled = !isCurrentMonth || status.isPast || !status.isOpen;

                        let cellClass = 'flex flex-col items-center py-1.5 rounded-xl relative transition-all duration-150 ';

                        if (!isCurrentMonth) {
                            cellClass += 'opacity-0 pointer-events-none';
                        } else if (isSelected) {
                            cellClass += 'bg-[#5D4037] cursor-pointer';
                        } else if (status.isHoliday && isCurrentMonth) {
                            cellClass += 'bg-rose-50 cursor-not-allowed';
                        } else if (status.isPast) {
                            cellClass += 'cursor-not-allowed';
                        } else if (status.isOpen) {
                            cellClass += 'cursor-pointer hover:bg-[#f5ede8]';
                        } else {
                            cellClass += 'cursor-not-allowed';
                        }

                        let numClass = 'w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold transition-all ';

                        if (isSelected) {
                            numClass += 'text-white';
                        } else if (isTodayDate && isCurrentMonth) {
                            numClass += 'bg-[#f5ede8] text-[#5D4037] font-bold ring-1 ring-[#5D4037]/30';
                        } else if (status.isHoliday && isCurrentMonth) {
                            numClass += 'text-rose-400';
                        } else if (status.isPast && isCurrentMonth) {
                            numClass += 'text-gray-300';
                        } else if (isCurrentMonth && status.isOpen) {
                            numClass += 'text-gray-700';
                        } else {
                            numClass += 'text-gray-200';
                        }

                        return (
                            <div
                                key={dateStr}
                                onClick={() => !isDisabled && onDateSelect(dateStr)}
                                className={cellClass}
                            >
                                {/* Today badge */}
                                {isTodayDate && isCurrentMonth && !isSelected && (
                                    <span className="absolute -top-0.5 right-0.5 text-[8px] font-bold text-[#5D4037] leading-none">•</span>
                                )}

                                <div className={numClass}>
                                    {format(day, 'd')}
                                </div>

                                {/* Status dot */}
                                <div className="h-1.5 flex items-center justify-center mt-0.5">
                                    {isCurrentMonth && !status.isPast && (
                                        <>
                                            {isSelected ? (
                                                <div className="w-1 h-1 rounded-full bg-white/60" />
                                            ) : status.isOpen ? (
                                                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                            ) : status.isHoliday ? (
                                                <div className="w-1 h-1 rounded-full bg-rose-300" />
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend Footer */}
            <div className="bg-[#faf7f5] border-t border-[#e8ddd7] px-5 py-2.5 flex gap-5 text-[11px] text-[#8D6E63]">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>เปิดให้บริการ</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                    <span>วันหยุด</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5D4037]" />
                    <span>วันที่เลือก</span>
                </div>
            </div>
        </div>
    );
}
