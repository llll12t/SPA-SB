// Re-export Supabase database and auth for seamless backward compatibility
import { db } from './supabaseDb';
import { auth } from './supabaseAuth';
import { supabase } from './supabase';

export { db, auth, supabase };
