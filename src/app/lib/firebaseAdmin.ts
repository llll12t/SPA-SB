// Re-export Supabase database and admin for seamless backward compatibility
import { db } from './supabaseDb';
import { auth } from './supabaseAuth';
import { supabaseAdmin } from './supabaseAdmin';

export { db, auth, supabaseAdmin };
