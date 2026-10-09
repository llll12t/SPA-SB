"use client";

import { useState, useEffect } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { db, collection, doc, getDocs, onSnapshot, query, orderBy } from '@/app/lib/supabaseDb';
import { redeemReward } from '@/app/actions/rewardActions';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';
import SpaFlowerIcon from '@/app/components/common/SpaFlowerIcon';

interface Reward {
    id: string;
    name: string;
    description?: string;
    pointsRequired: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
}

interface CustomerData {
    points: number;
}

const RewardCard = ({
    reward,
    userPoints,
    onRedeem,
    isRedeeming,
}: {
    reward: Reward;
    userPoints: number;
    onRedeem: (id: string) => void;
    isRedeeming: boolean;
}) => {
    const { profile } = useProfile();
    const currency = profile?.currencySymbol || '฿';
    const canRedeem = userPoints >= reward.pointsRequired;
    const diff = reward.pointsRequired - userPoints;

    return (
        <div className="bg-white p-4.5 rounded-3xl shadow-xs border border-[#e7e0da] flex justify-between items-center gap-3 transition-all hover:shadow-sm">
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-[#3e2723] truncate">{reward.name}</h3>
                {reward.description && (
                    <p className="text-xs text-[#8d6e63] mt-0.5 line-clamp-2">{reward.description}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-[#5d4037] bg-[#f5f0eb] border border-[#e7e0da] px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1">
                        <span>{reward.discountType === 'percentage' ? `ลด ${reward.discountValue}%` : `ลด ${reward.discountValue} ${currency}`}</span>
                    </span>

                    <span className="text-xs font-semibold text-[#8d6e63] flex items-center gap-1">
                        <span className="text-amber-500 font-bold">✦</span>
                        <span>{reward.pointsRequired.toLocaleString()} แต้ม</span>
                    </span>
                </div>

                {!canRedeem && diff > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                        (ขาดอีก {diff.toLocaleString()} แต้ม)
                    </p>
                )}
            </div>

            <button
                onClick={() => onRedeem(reward.id)}
                disabled={!canRedeem || isRedeeming}
                className={`font-bold px-4 py-2.5 rounded-2xl text-xs transition-all flex-shrink-0 active:scale-95 ${
                    canRedeem
                        ? 'bg-[#5d4037] text-white hover:bg-[#4a3429] shadow-sm shadow-[#5d4037]/20'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                }`}
            >
                {isRedeeming ? 'กำลังแลก...' : canRedeem ? 'แลกรางวัล' : 'แต้มไม่พอ'}
            </button>
        </div>
    );
};

export default function RewardsPage() {
    const { profile: liffProfile, loading: liffLoading, liff } = useLiffContext();
    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [notification, setNotification] = useState<{ show: boolean, title?: string, message: string, type: 'success' | 'error' | 'warning' }>({ show: false, message: '', type: 'success' });
    const [showModal, setShowModal] = useState(false);
    const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);

    useEffect(() => {
        let unsubCustomer = () => { };
        if (liffProfile?.userId) {
            const customerRef = doc(db, "customers", liffProfile.userId);
            unsubCustomer = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) setCustomer(doc.data() as CustomerData);
            });
        }
        return () => unsubCustomer();
    }, [liffProfile]);

    useEffect(() => {
        const fetchRewards = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'rewards'), orderBy('pointsRequired'));
                const snapshot = await getDocs(q);
                setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward)));
            } catch (err) {
                console.error("Error fetching rewards:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRewards();
    }, []);

    const handleRedeemClick = (rewardId: string) => {
        setSelectedRewardId(rewardId);
        setShowModal(true);
    };

    const handleConfirmRedeem = async () => {
        if (!liffProfile?.userId || !selectedRewardId) return;

        setShowModal(false);
        setIsRedeeming(true);
        const lineAccessToken = liff?.getAccessToken?.();
        const result = await redeemReward(liffProfile.userId, selectedRewardId, { lineAccessToken });
        if (result.success) {
            setNotification({ show: true, title: "แลกสำเร็จ!", message: "คุณได้รับคูปองส่วนลดใหม่เรียบร้อยแล้ว", type: 'success' });
        } else {
            setNotification({ show: true, title: "เกิดข้อผิดพลาด", message: result.error || 'Unknown error', type: 'error' });
        }
        setIsRedeeming(false);
        setSelectedRewardId(null);
    };

    const handleCancelRedeem = () => {
        setShowModal(false);
        setSelectedRewardId(null);
    };

    if (loading || liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf8f5]">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#5d4037" style={{ animationDuration: '3s' }} />
                <p className="text-xs text-[#8d6e63] mt-3 font-medium">กำลังโหลดข้อมูลของรางวัล...</p>
            </div>
        );
    }

    const currentPoints = customer?.points ?? 0;

    return (
        <div className="min-h-screen bg-[#faf8f5]">
            <CustomerHeader showBackButton={true} title="แลกของรางวัล" backUrl="/appointment" />
            
            <div className="w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-4">
                <Notification {...notification} title={notification.title || ''} />
                
                <ConfirmationModal
                    show={showModal}
                    title="ยืนยันการแลกของรางวัล"
                    message="คุณต้องการใช้คะแนนสะสมเพื่อแลกคูปองส่วนลดนี้ใช่หรือไม่?"
                    onConfirm={handleConfirmRedeem}
                    onCancel={handleCancelRedeem}
                    isProcessing={isRedeeming}
                />

                {/* Points Hero Card */}
                <div className="bg-gradient-to-br from-[#5d4037] via-[#4a3429] to-[#3e2723] rounded-3xl p-6 text-white text-center shadow-md relative overflow-hidden">
                    {/* Background flower watermark */}
                    <div className="absolute top-[-25px] right-[-25px] opacity-10 pointer-events-none">
                        <SpaFlowerIcon className="w-36 h-36" color="#ffffff" />
                    </div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-amber-200 font-medium mb-3">
                            <span>✦</span>
                            <span>คะแนนสะสมสมาชิกของคุณ</span>
                        </div>
                        
                        <div className="text-5xl font-black text-white tracking-tight">
                            {currentPoints.toLocaleString()}
                        </div>
                        
                        <p className="text-xs text-[#d7ccc8] mt-2 font-medium">
                            ใช้คะแนนสะสมแลกรับคูปองส่วนลดและสิทธิพิเศษมากมาย
                        </p>
                    </div>
                </div>

                {/* Rewards List */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-sm font-bold text-[#3e2723] flex items-center gap-1.5">
                            <span className="w-1.5 h-4 bg-[#5d4037] rounded-full"></span>
                            <span>ของรางวัลทั้งหมด</span>
                        </h2>
                        <span className="text-xs text-[#8d6e63]">
                            {rewards.length} รายการ
                        </span>
                    </div>

                    {rewards.length > 0 ? (
                        <div className="space-y-2.5">
                            {rewards.map(reward => (
                                <RewardCard
                                    key={reward.id}
                                    reward={reward}
                                    userPoints={currentPoints}
                                    onRedeem={handleRedeemClick}
                                    isRedeeming={isRedeeming && selectedRewardId === reward.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-6 bg-white rounded-3xl border border-[#e7e0da] shadow-sm">
                            <div className="w-12 h-12 bg-[#faf8f5] rounded-full flex items-center justify-center mx-auto mb-2.5 border border-[#e7e0da]">
                                <SpaFlowerIcon className="w-6 h-6" color="#8d6e63" />
                            </div>
                            <p className="text-xs text-[#8d6e63]">ยังไม่มีรายการของรางวัลให้แลกในขณะนี้</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
