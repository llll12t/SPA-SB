import { getSupabaseClient } from './supabase';

export interface User {
    uid: string;
    id: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    getIdToken: () => Promise<string>;
}

export interface UserCredential {
    user: User;
}

export const browserLocalPersistence = 'LOCAL';
export const browserSessionPersistence = 'SESSION';

function mapSupabaseUser(sbUser: any, token?: string): User | null {
    if (!sbUser) return null;
    return {
        uid: sbUser.id,
        id: sbUser.id,
        email: sbUser.email,
        displayName: sbUser.user_metadata?.displayName || sbUser.user_metadata?.full_name || '',
        photoURL: sbUser.user_metadata?.photoURL || sbUser.user_metadata?.avatar_url || '',
        getIdToken: async () => {
            if (token) return token;
            const client = getSupabaseClient();
            const { data } = await client.auth.getSession();
            return data.session?.access_token || '';
        },
    };
}

export class AuthCompat {
    get currentUser(): User | null {
        if (typeof window === 'undefined') return null;
        const client = getSupabaseClient();
        // Return cached synchronous representation if possible
        try {
            // Read from supabase local storage key if available
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.includes('auth-token')) {
                    const session = JSON.parse(localStorage.getItem(key) || '{}');
                    if (session?.user) {
                        return mapSupabaseUser(session.user, session.access_token);
                    }
                }
            }
        } catch { }
        return null;
    }

    async setPersistence(_persistence: any): Promise<void> {
        return Promise.resolve();
    }

    async createCustomToken(uid: string): Promise<string> {
        return `sb_custom_${uid}_${Date.now()}`;
    }
}

export const auth = new AuthCompat();

export async function signInWithEmailAndPassword(
    _auth: any,
    email: string,
    password: string
): Promise<UserCredential> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        // Map Supabase error messages to friendly error codes
        const err: any = new Error(error.message);
        if (error.message.includes('Invalid login credentials')) {
            err.code = 'auth/invalid-credential';
        } else if (error.message.includes('Email not confirmed')) {
            err.code = 'auth/user-disabled';
        } else {
            err.code = 'auth/internal-error';
        }
        throw err;
    }

    const user = mapSupabaseUser(data.user, data.session?.access_token);
    if (!user) throw new Error('User not found.');

    return { user };
}

export async function signOut(_auth: any): Promise<void> {
    const client = getSupabaseClient();
    await client.auth.signOut();
    if (typeof window !== 'undefined') {
        localStorage.removeItem('lineAdminSession');
    }
}

export async function createUserWithEmailAndPassword(
    _auth: any,
    email: string,
    password: string
): Promise<UserCredential> {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
        email,
        password,
    });

    if (error) {
        const err: any = new Error(error.message);
        if (error.message.includes('User already registered')) {
            err.code = 'auth/email-already-in-use';
        } else if (error.message.includes('Password should be at least')) {
            err.code = 'auth/weak-password';
        } else {
            err.code = 'auth/internal-error';
        }
        throw err;
    }

    const user = mapSupabaseUser(data.user, data.session?.access_token);
    if (!user) throw new Error('Failed to create user.');

    return { user };
}

export async function updateProfile(user: User, profileData: { displayName?: string; photoURL?: string }): Promise<void> {
    const client = getSupabaseClient();
    const { error } = await client.auth.updateUser({
        data: {
            ...(profileData.displayName ? { displayName: profileData.displayName } : {}),
            ...(profileData.photoURL ? { photoURL: profileData.photoURL } : {}),
        },
    });

    if (error) throw new Error(error.message);
}

export function onAuthStateChanged(
    _auth: any,
    callback: (user: User | null) => void
): () => void {
    const client = getSupabaseClient();

    // Trigger immediate check
    client.auth.getSession().then(({ data }) => {
        callback(mapSupabaseUser(data.session?.user, data.session?.access_token));
    }).catch(() => {
        callback(null);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        callback(mapSupabaseUser(session?.user, session?.access_token));
    });

    return () => {
        subscription.unsubscribe();
    };
}

export async function setPersistence(_auth: any, _persistence: any): Promise<void> {
    return Promise.resolve();
}
