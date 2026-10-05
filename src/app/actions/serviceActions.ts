"use server";

import { db, FieldValue } from '@/app/lib/supabaseDb';
import { revalidatePath } from 'next/cache';
import { Service } from '@/types';

/**
 * Adds a new service to Firestore.
 */
export async function addService(serviceData: any) {
    try {
        const serviceRef = await db.collection('services').add({
            ...serviceData,
            status: 'available',
            createdAt: FieldValue.serverTimestamp(),
        });

        revalidatePath('/admin/services');

        return { success: true, message: `เพิ่มบริการสำเร็จ ID: ${serviceRef.id}` };

    } catch (error: any) {
        console.error("🔥 Error adding service to Firestore:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all services and their active appointment schedules.
 */
export async function fetchAllServicesWithSchedules() {
    try {
        const servicesRef = db.collection('services');
        const servicesQuery = servicesRef.where('status', 'in', ['available', 'unavailable']).orderBy('serviceName');
        const servicesSnapshot = await servicesQuery.get();
        const services = servicesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        const serviceIds = services.map((v: any) => v.id);
        if (serviceIds.length === 0) {
            return { services: [], appointments: {} };
        }

        const appointmentsRef = db.collection('appointments');
        const appointmentsQuery = appointmentsRef
            .where('serviceId', 'in', serviceIds)
            .where('status', 'in', ['awaiting_confirmation', 'confirmed', 'in_progress']);

        const appointmentsSnapshot = await appointmentsQuery.get();

        const appointmentsMap: Record<string, any[]> = {};
        appointmentsSnapshot.forEach((doc: any) => {
            const appointment = doc.data();
            if (!appointmentsMap[appointment.serviceId]) {
                appointmentsMap[appointment.serviceId] = [];
            }

            const startTime = appointment.appointmentInfo.dateTime.toDate();
            const endTime = new Date(startTime.getTime() + (appointment.appointmentInfo.duration * 60000));

            appointmentsMap[appointment.serviceId].push({
                start: startTime.toISOString(),
                end: endTime.toISOString(),
            });
        });

        return {
            services: JSON.parse(JSON.stringify(services)),
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
        const servicesRef = db.collection('services');
        const q = servicesRef.where('status', '==', 'available').orderBy('serviceName');
        const snapshot = await q.get();

        const services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Service[];

        return { success: true, services: JSON.parse(JSON.stringify(services)) };
    } catch (error: any) {
        // Fallback for missing index
        if (error.code === 'failed-precondition') {
            try {
                const servicesRef = db.collection('services');
                const snapshot = await servicesRef.where('status', '==', 'available').get();
                const services = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Service[];

                // Manual sort
                services.sort((a, b) => (a.serviceName || '').localeCompare(b.serviceName || ''));

                return { success: true, services: JSON.parse(JSON.stringify(services)) };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        }
        console.error("Error fetching customer services:", error);
        return { success: false, error: error.message };
    }
}
