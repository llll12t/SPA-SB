import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Supabase Admin: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing in environment.');
    }
}

// Server singleton for Server Actions and API routes
let adminInstance: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
    if (!adminInstance) {
        adminInstance = createClient(
            supabaseUrl || 'https://placeholder.supabase.co',
            supabaseServiceRoleKey || 'placeholder-service-key',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );
    }
    return adminInstance;
};

export const supabaseAdmin = getSupabaseAdmin();
