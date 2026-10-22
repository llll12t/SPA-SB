"use client";

interface TimeSlotGridProps {
    timeSlots: string[];
    selectedTime: string;
    onSelect: (time: string) => void;
    isDisabled?: boolean;
}

export default function TimeSlotGrid({ timeSlots, selectedTime, onSelect, isDisabled = false }: TimeSlotGridProps) {
    if (timeSlots.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-[#8D6E63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <p className="text-sm text-[#8D6E63] font-medium">ไม่พบช่วงเวลาว่าง</p>
                <p className="text-xs text-gray-400 mt-0.5">ลองเลือกวันอื่น</p>
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-3 gap-2 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {timeSlots.map(time => {
                const isSelected = selectedTime === time;
                return (
                    <button
                        key={time}
                        type="button"
                        onClick={() => onSelect(time)}
                        disabled={isDisabled}
                        className={`
                            relative px-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 border
                            ${isSelected
                                ? '!bg-[#5D4037] !text-white !border-[#5D4037] shadow-sm shadow-[#5D4037]/20 scale-[1.02]'
                                : 'bg-white text-[#5D4037] border-[#e8ddd7] hover:border-[#5D4037]/40 hover:bg-[#fdf8f6]'
                            }
                        `}
                    >
                        {time} น.
                        {isSelected && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full border border-white" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
