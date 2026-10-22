"use server";

import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { Service } from '@/types';

/**
 * Adds a new service to Supabase services table.
 */
export async function addService(serviceData: any) {
    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('services')
            .insert({
                ...serviceData,
                status: 'available',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (error) throw new Error(error.message);

        revalidatePath('/admin/services');

        return { success: true, message: `เพิ่มบริการสำเร็จ ID: ${data.id}` };

    } catch (error: any) {
        console.error("Error adding service to Supabase:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all services and their active appointment schedules.
 */
export async function fetchAllServicesWithSchedules() {
    try {
        const supabase = getSupabaseAdmin();
        const { data: services, error: sErr } = await supabase
            .from('services')
            .select('*')
            .in('status', ['available', 'unavailable'])
            .order('serviceName');

        if (sErr) throw new Error(sErr.message);

        const serviceList = services || [];
        const serviceIds = serviceList.map((v: any) => v.id);
        if (serviceIds.length === 0) {
            return { services: [], appointments: {} };
        }

        const { data: appointments, error: aErr } = await supabase
            .from('appointments')
            .select('*')
            .in('serviceId', serviceIds)
            .in('status', ['awaiting_confirmation', 'confirmed', 'in_progress']);

        if (aErr) throw new Error(aErr.message);

        const appointmentsMap: Record<string, any[]> = {};
        (appointments || []).forEach((appointment: any) => {
            if (!appointmentsMap[appointment.serviceId]) {
                appointmentsMap[appointment.serviceId] = [];
            }

            const rawDate = appointment.appointmentInfo?.dateTime;
            const startTime = rawDate ? new Date(rawDate) : new Date(`${appointment.date}T${appointment.time}`);
            const duration = Number(appointment.appointmentInfo?.duration) || 60;
            const endTime = new Date(startTime.getTime() + (duration * 60000));

            appointmentsMap[appointment.serviceId].push({
                start: startTime.toISOString(),
                end: endTime.toISOString(),
            });
        });

        return {
            services: serviceList,
            appointments: appointmentsMap,
        };

    } catch (error: any) {
        console.error("Error fetching services with schedules:", error);
        return { error: "Failed to fetch service data.", details: error.message };
    }
}

/**
 * Fetches available services for customer display.
 */
export async function getServicesForCustomer() {
    try {
        const supabase = getSupabaseAdmin();
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .eq('status', 'available')
            .order('serviceName');

        if (error) throw new Error(error.message);

        return { success: true, services: (services || []) as Service[] };
    } catch (error: any) {
        console.error("Error fetching customer services:", error);
        return { success: false, error: error.message };
    }
}
