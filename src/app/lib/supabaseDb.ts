import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { getSupabaseAdmin } from './supabaseAdmin';

// ==============================================================================
// 1. TIMESTAMP COMPATIBILITY CLASS
// ==============================================================================
export class Timestamp {
    private date: Date;

    constructor(seconds: number, nanoseconds: number) {
        this.date = new Date(seconds * 1000 + nanoseconds / 1000000);
    }

    static now(): Timestamp {
        return Timestamp.fromDate(new Date());
    }

    static fromDate(date: Date): Timestamp {
        const ms = date.getTime();
        const seconds = Math.floor(ms / 1000);
        const nanoseconds = (ms % 1000) * 1000000;
        return new Timestamp(seconds, nanoseconds);
    }

    static fromMillis(millis: number): Timestamp {
        return Timestamp.fromDate(new Date(millis));
    }

    toDate(): Date {
        return this.date;
    }

    toMillis(): number {
        return this.date.getTime();
    }

    toISOString(): string {
        return this.date.toISOString();
    }

    toString(): string {
        return this.date.toISOString();
    }

    get seconds(): number {
        return Math.floor(this.date.getTime() / 1000);
    }

    get nanoseconds(): number {
        return (this.date.getTime() % 1000) * 1000000;
    }
}

// Helper to convert date strings / ISO / Date to Timestamp or Date with .toDate()
export function wrapDates<T>(obj: any): T {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => wrapDates(item)) as any;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            // ISO date string
            const d = new Date(val);
            result[key] = {
                toDate: () => d,
                toISOString: () => val,
                toString: () => val,
                seconds: Math.floor(d.getTime() / 1000),
                nanoseconds: (d.getTime() % 1000) * 1000000,
            };
        } else if (val && typeof val === 'object') {
            result[key] = wrapDates(val);
        } else {
            result[key] = val;
        }
    }
    return result;
}

// ==============================================================================
// 2. FIELD VALUE COMPATIBILITY
// ==============================================================================
export const FieldValue = {
    serverTimestamp: () => new Date().toISOString(),
    increment: (n: number) => ({ __type: 'increment', value: n }),
    delete: () => null,
    arrayUnion: (...elements: any[]) => ({ __type: 'arrayUnion', elements }),
    arrayRemove: (...elements: any[]) => ({ __type: 'arrayRemove', elements }),
};

export const serverTimestamp = FieldValue.serverTimestamp;
export const increment = FieldValue.increment;

// Network online/offline helpers for parity
export const enableNetwork = async (_db?: any): Promise<void> => Promise.resolve();
export const disableNetwork = async (_db?: any): Promise<void> => Promise.resolve();

// ==============================================================================
// 3. REFERENCES, INTERFACES & TYPES
// ==============================================================================
export interface DocRef {
    collectionName: string;
    id: string;
    customerId?: string; // for coupons
    isSettings?: boolean;
    get: () => Promise<DocumentSnapshot>;
    set: (data: any, options?: { merge?: boolean }) => Promise<void>;
    update: (data: any) => Promise<void>;
    delete: () => Promise<void>;
    collection: (subName: string) => CollectionWrapper;
}

export interface CollectionRef {
    collectionName: string;
    customerId?: string; // for coupons subcollection
    isSettings?: boolean;
}

export interface QueryConstraint {
    type: 'where' | 'orderBy' | 'limit' | 'startAfter';
    field?: string;
    op?: string;
    value?: any;
    direction?: 'asc' | 'desc';
}

export interface QueryRef {
    collectionRef: CollectionRef;
    constraints: QueryConstraint[];
}

export interface DocumentSnapshot<T = any> {
    id: string;
    exists: any; // Can be accessed as boolean: if (doc.exists) or called as function: if (doc.exists())
    data: () => T | undefined;
    ref: DocRef;
}

export interface QuerySnapshot<T = any> {
    empty: boolean;
    size: number;
    docs: DocumentSnapshot<T>[];
    forEach: (callback: (doc: DocumentSnapshot<T>) => void) => void;
}

export type DocumentData = Record<string, any>;
export type QueryDocumentSnapshot<T = DocumentData> = DocumentSnapshot<T>;

export interface DocWrapper extends DocRef {}

export interface QueryWrapper extends QueryRef {
    where: (field: string, op: string, val: any) => QueryWrapper;
    orderBy: (field: string, dir?: 'asc' | 'desc') => QueryWrapper;
    limit: (n: number) => QueryWrapper;
    startAfter: (cursor: any) => QueryWrapper;
    get: () => Promise<QuerySnapshot>;
}

export interface CollectionWrapper extends CollectionRef {
    doc: (id?: string) => DocWrapper;
    where: (field: string, op: string, val: any) => QueryWrapper;
    orderBy: (field: string, dir?: 'asc' | 'desc') => QueryWrapper;
    limit: (n: number) => QueryWrapper;
    startAfter: (cursor: any) => QueryWrapper;
    get: () => Promise<QuerySnapshot>;
    add: (data: any) => Promise<{ id: string }>;
}

// Function to resolve whether we use Admin or Browser client
function getClient(isServer = false): SupabaseClient {
    if (typeof window === 'undefined' || isServer) {
        return getSupabaseAdmin();
    }
    return getSupabaseClient();
}

// ==============================================================================
// 4. UNIFIED CHAINABLE DB WRAPPERS
// ==============================================================================
function createQueryWrapper(collectionRef: CollectionRef, constraints: QueryConstraint[] = []): QueryWrapper {
    const qRef: QueryRef = { collectionRef, constraints };
    return {
        ...qRef,
        where: (field: string, op: string, val: any) =>
            createQueryWrapper(collectionRef, [...constraints, where(field, op, val)]),
        orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') =>
            createQueryWrapper(collectionRef, [...constraints, orderBy(field, dir)]),
        limit: (n: number) =>
            createQueryWrapper(collectionRef, [...constraints, limit(n)]),
        startAfter: (cursor: any) =>
            createQueryWrapper(collectionRef, [...constraints, startAfter(cursor)]),
        get: () => getDocs(qRef),
    };
}

function createDocWrapper(colRef: CollectionRef, id?: string): DocWrapper {
    const targetId = id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `doc_${Date.now()}`);
    const dRefBase = {
        collectionName: colRef.collectionName,
        id: targetId,
        customerId: colRef.customerId,
        isSettings: colRef.isSettings,
    };

    const wrapper: DocWrapper = {
        ...dRefBase,
        get: () => fetchDocSnapshot(wrapper, false),
        set: (data: any, options?: any) => setDoc(wrapper, data, options),
        update: (data: any) => updateDoc(wrapper, data),
        delete: () => deleteDoc(wrapper),
        collection: (subName: string) => {
            if (colRef.collectionName === 'customers' && subName === 'coupons') {
                return createCollectionWrapper({
                    collectionName: 'coupons',
                    customerId: targetId,
                });
            }
            return createCollectionWrapper({
                collectionName: subName,
            });
        },
    };

    return wrapper;
}

function createCollectionWrapper(colRef: CollectionRef): CollectionWrapper {
    return {
        ...colRef,
        doc: (id?: string) => createDocWrapper(colRef, id),
        where: (field: string, op: string, val: any) =>
            createQueryWrapper(colRef, [where(field, op, val)]),
        orderBy: (field: string, dir: 'asc' | 'desc' = 'asc') =>
            createQueryWrapper(colRef, [orderBy(field, dir)]),
        limit: (n: number) =>
            createQueryWrapper(colRef, [limit(n)]),
        startAfter: (cursor: any) =>
            createQueryWrapper(colRef, [startAfter(cursor)]),
        get: () => getDocs(colRef),
        add: (data: any) => addDoc(colRef, data),
    };
}

// ==============================================================================
// 5. COLLECTION & DOC BUILDERS
// ==============================================================================
export function collection(db: any, path: string, ...subpaths: string[]): CollectionWrapper {
    // Check for customer coupons subcollection: collection(db, 'customers', userId, 'coupons')
    if (path === 'customers' && subpaths.length >= 2 && subpaths[1] === 'coupons') {
        return createCollectionWrapper({
            collectionName: 'coupons',
            customerId: subpaths[0],
        });
    }

    return createCollectionWrapper({
        collectionName: path,
        isSettings: path === 'settings',
    });
}

export function doc(dbOrCollection: any, pathOrId: string, ...extra: string[]): DocRef {
    // Signature 1: doc(db, 'collection', 'id')
    // Signature 2: doc(collectionRef, 'id')
    // Signature 3: doc(db, 'customers', userId, 'coupons', couponId)
    let colName = '';
    let targetId = '';
    let customerId: string | undefined;

    if (typeof dbOrCollection === 'object' && dbOrCollection !== null && 'collectionName' in dbOrCollection) {
        colName = dbOrCollection.collectionName;
        customerId = dbOrCollection.customerId;
        targetId = pathOrId;
    } else if (pathOrId === 'customers' && extra.length >= 3 && extra[1] === 'coupons') {
        colName = 'coupons';
        customerId = extra[0];
        targetId = extra[2];
    } else {
        colName = pathOrId;
        targetId = extra[0];
    }

    return createDocWrapper({
        collectionName: colName,
        customerId,
        isSettings: colName === 'settings',
    }, targetId);
}

// ==============================================================================
// 6. QUERY CONSTRAINTS
// ==============================================================================
export function where(field: string, op: string, value: any): QueryConstraint {
    return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
    return { type: 'orderBy', field, direction };
}

export function limit(n: number): QueryConstraint {
    return { type: 'limit', value: n };
}

export function startAfter(lastDoc: any): QueryConstraint {
    return { type: 'startAfter', value: lastDoc };
}

export function query(collectionRef: CollectionRef, ...constraints: QueryConstraint[]): QueryWrapper {
    return createQueryWrapper(collectionRef, constraints);
}

// ==============================================================================
// 7. EXECUTE GET DOC / DOCS
// ==============================================================================
export function createDocSnapshot<T = any>(raw: any, docRef: DocRef, forClient = true): DocumentSnapshot<T> {
    const isPresent = raw !== null && raw !== undefined;
    const wrapped = isPresent ? wrapDates(raw) : undefined;
    const ref = createDocWrapper(
        { collectionName: docRef.collectionName, customerId: docRef.customerId, isSettings: docRef.isSettings },
        docRef.id
    );

    const snap: any = {
        id: docRef.id,
        data: () => wrapped,
        ref,
    };

    if (forClient) {
        const fn: any = () => isPresent;
        fn.valueOf = () => isPresent;
        snap.exists = fn;
    } else {
        snap.exists = isPresent;
    }

    return snap;
}

export async function fetchDocSnapshot<T = any>(docRef: DocRef, forClient = false): Promise<DocumentSnapshot<T>> {
    const client = getClient(!forClient);
    const table = docRef.collectionName;

    try {
        if (docRef.isSettings) {
            const { data, error } = await client
                .from('settings')
                .select('*')
                .eq('id', docRef.id)
                .maybeSingle();

            if (error || !data) {
                return createDocSnapshot<T>(null, docRef, forClient);
            }
            return createDocSnapshot<T>(data.data || {}, docRef, forClient);
        }

        let q = client.from(table).select('*').eq('id', docRef.id);
        if (docRef.customerId) {
            q = q.eq('customerId', docRef.customerId);
        }

        const { data, error } = await q.maybeSingle();
        if (error || !data) {
            return createDocSnapshot<T>(null, docRef, forClient);
        }

        return createDocSnapshot<T>(data, docRef, forClient);
    } catch (e) {
        console.error(`fetchDocSnapshot error for ${table}/${docRef.id}:`, e);
        return createDocSnapshot<T>(null, docRef, forClient);
    }
}

export async function getDoc<T = any>(docRef: DocRef): Promise<DocumentSnapshot<T>> {
    return fetchDocSnapshot<T>(docRef, true);
}

export async function getDocs<T = any>(queryOrCollection: QueryRef | CollectionRef): Promise<QuerySnapshot<T>> {
    const client = getClient();
    const isQuery = 'constraints' in queryOrCollection;
    const colRef = isQuery ? queryOrCollection.collectionRef : queryOrCollection;
    const constraints = isQuery ? queryOrCollection.constraints : [];
    const table = colRef.collectionName;

    try {
        let q = client.from(table).select('*');

        if (colRef.customerId) {
            q = q.eq('customerId', colRef.customerId);
        }

        for (const c of constraints) {
            if (c.type === 'where' && c.field && c.op) {
                const f = c.field;
                const v = c.value;
                if (c.op === '==' || c.op === '===') {
                    if (f.includes('.')) {
                        const parts = f.split('.');
                        q = q.eq(`${parts[0]}->>${parts[1]}`, String(v));
                    } else {
                        q = q.eq(f, v);
                    }
                } else if (c.op === '!=') {
                    q = q.neq(f, v);
                } else if (c.op === '>') {
                    q = q.gt(f, v);
                } else if (c.op === '>=') {
                    q = q.gte(f, v);
                } else if (c.op === '<') {
                    q = q.lt(f, v);
                } else if (c.op === '<=') {
                    q = q.lte(f, v);
                } else if (c.op === 'in') {
                    q = q.in(f, Array.isArray(v) ? v : [v]);
                } else if (c.op === 'array-contains') {
                    q = q.contains(f, [v]);
                }
            } else if (c.type === 'orderBy' && c.field) {
                const ascending = c.direction === 'asc';
                if (c.field.includes('.')) {
                    const parts = c.field.split('.');
                    q = q.order(`${parts[0]}->>${parts[1]}`, { ascending });
                } else {
                    q = q.order(c.field, { ascending });
                }
            } else if (c.type === 'limit' && typeof c.value === 'number') {
                q = q.limit(c.value);
            }
        }

        const { data, error } = await q;
        if (error) {
            console.error(`getDocs error on ${table}:`, error);
            return {
                empty: true,
                size: 0,
                docs: [],
                forEach: () => {},
            };
        }

        const docs = (data || []).map(row => {
            const rowData = colRef.isSettings ? row.data : row;
            return createDocSnapshot<T>(rowData, {
                collectionName: table,
                id: row.id,
                customerId: colRef.customerId,
            } as DocRef, false);
        });

        return {
            empty: docs.length === 0,
            size: docs.length,
            docs,
            forEach: (cb) => docs.forEach(cb),
        };
    } catch (e) {
        console.error(`getDocs error on ${table}:`, e);
        return {
            empty: true,
            size: 0,
            docs: [],
            forEach: () => {},
        };
    }
}

// ==============================================================================
// 8. EXECUTE SET / ADD / UPDATE / DELETE
// ==============================================================================
export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }): Promise<void> {
    const client = getClient();
    const table = docRef.collectionName;

    try {
        if (docRef.isSettings) {
            let finalData = data;
            if (options?.merge) {
                const existing = await fetchDocSnapshot(docRef, false);
                const current = existing.exists ? existing.data() : {};
                finalData = { ...current, ...data };
            }
            const { error } = await client
                .from('settings')
                .upsert({ id: docRef.id, data: finalData, updatedAt: new Date().toISOString() });
            if (error) throw new Error(error.message);
            return;
        }

        let recordData = { ...data, id: docRef.id };
        if (docRef.customerId) {
            recordData.customerId = docRef.customerId;
        }

        if (options?.merge) {
            const existing = await fetchDocSnapshot(docRef, false);
            if (existing.exists) {
                recordData = { ...existing.data(), ...recordData };
            }
        }

        const { error } = await client.from(table).upsert(recordData);
        if (error) throw new Error(error.message);
    } catch (err: any) {
        console.error(`setDoc failed for ${table}/${docRef.id}:`, err);
        throw err;
    }
}

export async function addDoc(collectionRef: CollectionRef, data: any): Promise<{ id: string }> {
    const client = getClient();
    const table = collectionRef.collectionName;
    const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `id_${Date.now()}`;

    const recordData = {
        ...data,
        id: data.id || generatedId,
        createdAt: data.createdAt || new Date().toISOString(),
    };

    if (collectionRef.customerId) {
        recordData.customerId = collectionRef.customerId;
    }

    const { error } = await client.from(table).insert(recordData);
    if (error) throw new Error(error.message);

    return { id: recordData.id };
}

export async function updateDoc(docRef: DocRef, data: any): Promise<void> {
    const client = getClient();
    const table = docRef.collectionName;

    try {
        if (docRef.isSettings) {
            const existing = await fetchDocSnapshot(docRef, false);
            const current = existing.exists ? existing.data() : {};
            const finalData = { ...current, ...data };

            const { error } = await client
                .from('settings')
                .upsert({ id: docRef.id, data: finalData, updatedAt: new Date().toISOString() });
            if (error) throw new Error(error.message);
            return;
        }

        // Process special fields like increment
        const updates: any = {};
        for (const key of Object.keys(data)) {
            const val = data[key];
            if (val && typeof val === 'object' && val.__type === 'increment') {
                const existing = await fetchDocSnapshot(docRef, false);
                const currentVal = existing.exists ? (existing.data()?.[key] || 0) : 0;
                updates[key] = currentVal + val.value;
            } else {
                updates[key] = val;
            }
        }

        let query = client.from(table).update(updates).eq('id', docRef.id);
        if (docRef.customerId) {
            query = query.eq('customerId', docRef.customerId);
        }

        const { error } = await query;
        if (error) throw new Error(error.message);
    } catch (err: any) {
        console.error(`updateDoc failed for ${table}/${docRef.id}:`, err);
        throw err;
    }
}

export async function deleteDoc(docRef: DocRef): Promise<void> {
    const client = getClient();
    const table = docRef.collectionName;

    let query = client.from(table).delete().eq('id', docRef.id);
    if (docRef.customerId) {
        query = query.eq('customerId', docRef.customerId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
}

// ==============================================================================
// 9. REALTIME LISTENER (onSnapshot compatibility)
// ==============================================================================
export function onSnapshot<T = any>(
    queryOrDoc: DocRef,
    onNext: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (error: any) => void
): () => void;
export function onSnapshot<T = any>(
    queryOrDoc: QueryRef | CollectionRef,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (error: any) => void
): () => void;
export function onSnapshot<T = any>(
    queryOrDoc: any,
    onNext: (snapshot: any) => void,
    onError?: (error: any) => void
): () => void {
    const isDoc = 'id' in queryOrDoc && typeof queryOrDoc.id === 'string';
    const client = getSupabaseClient();
    const table = isDoc
        ? queryOrDoc.collectionName
        : 'constraints' in queryOrDoc
        ? queryOrDoc.collectionRef.collectionName
        : queryOrDoc.collectionName;

    let isSubscribed = true;

    const fetchLatest = async () => {
        if (!isSubscribed) return;
        try {
            if (isDoc) {
                const snap = await getDoc<T>(queryOrDoc as DocRef);
                if (isSubscribed) onNext(snap);
            } else {
                const snap = await getDocs<T>(queryOrDoc);
                if (isSubscribed) onNext(snap);
            }
        } catch (err) {
            if (isSubscribed && onError) onError(err);
        }
    };

    // Initial fetch
    fetchLatest();

    // Supabase Realtime Channel
    const channelId = `realtime-${table}-${Math.random().toString(36).substr(2, 9)}`;
    const channel = client
        .channel(channelId)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            () => {
                fetchLatest();
            }
        )
        .subscribe();

    // Backup polling (every 4 seconds) to ensure real-time fidelity even if replication is not yet toggled
    const pollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return; // pause in background tab
        fetchLatest();
    }, 4000);

    return () => {
        isSubscribed = false;
        clearInterval(pollInterval);
        channel.unsubscribe();
    };
}

// ==============================================================================
// 10. DATABASE BATCH & TRANSACTION COMPATIBILITY
// ==============================================================================
export interface Batch {
    set(docRef: DocRef, data: any, options?: { merge?: boolean }): Batch;
    update(docRef: DocRef, data: any): Batch;
    delete(docRef: DocRef): Batch;
    commit(): Promise<void>;
}

export function writeBatch(): Batch {
    const operations: Array<() => Promise<any>> = [];

    const batch: Batch = {
        set(docRef, data, options) {
            operations.push(() => setDoc(docRef, data, options));
            return batch;
        },
        update(docRef, data) {
            operations.push(() => updateDoc(docRef, data));
            return batch;
        },
        delete(docRef) {
            operations.push(() => deleteDoc(docRef));
            return batch;
        },
        async commit() {
            for (const op of operations) {
                await op();
            }
        },
    };

    return batch;
}

export async function runTransaction<T>(
    updateFunction: (transaction: {
        get: (docRef: DocRef) => Promise<DocumentSnapshot>;
        set: (docRef: DocRef, data: any, options?: any) => void;
        update: (docRef: DocRef, data: any) => void;
        delete: (docRef: DocRef) => void;
    }) => Promise<T>
): Promise<T> {
    const writes: Array<() => Promise<any>> = [];

    const transaction = {
        get: (docRef: DocRef) => fetchDocSnapshot(docRef, false),
        set: (docRef: DocRef, data: any, options?: any) => {
            writes.push(() => setDoc(docRef, data, options));
        },
        update: (docRef: DocRef, data: any) => {
            writes.push(() => updateDoc(docRef, data));
        },
        delete: (docRef: DocRef) => {
            writes.push(() => deleteDoc(docRef));
        },
    };

    const result = await updateFunction(transaction);
    for (const write of writes) {
        await write();
    }
    return result;
}

export const db = {
    collection: (name: string, ...subpaths: string[]): CollectionWrapper => {
        const colRef = collection(null, name, ...subpaths);
        return createCollectionWrapper(colRef);
    },
    runTransaction,
    batch: writeBatch,
};
