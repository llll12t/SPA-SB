"use server";

import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { AuthContext, requireAdminAuth } from '@/app/lib/authUtils';

export async function blockAppointmentSlot(data: { date: string; time: string; technicianId?: string; duration?: number; note?: string }, auth?: AuthContext) {
    try {
        const adminAuth = await requireAdminAuth(auth);
        if (!adminAuth.ok) return { success: false, error: adminAuth.error };

        const { date, time, technicianId, duration = 60, note = 'Blocked' } = data;
        const nowIso = new Date().toISOString();

        const blockData: any = {
            date,
            time,
            technicianId: technicianId || null,
            status: 'blocked',
            serviceInfo: { name: 'Blocked' },
            customerInfo: { fullName: note, name: note },
            appointmentInfo: { duration },
            createdAt: nowIso,
            updatedAt: nowIso,
            createdBy: 'admin'
        };

        if (technicianId) {
            const { data: tech } = await supabaseAdmin
                .from('technicians')
                .select('firstName, lastName')
                .eq('id', technicianId)
                .maybeSingle();

            if (tech) {
                blockData.technicianInfo = { id: technicianId, firstName: tech.firstName, lastName: tech.lastName };
            }
        }

        const { error } = await supabaseAdmin.from('appointments').insert(blockData);
        if (error) throw new Error(error.message);

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
