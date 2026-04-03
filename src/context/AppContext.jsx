import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseReady } from '../lib/supabase';

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

// ── Supabase ↔ local data mappers ───────────────────────────────────────────

const dbCustToLocal = (row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    tag: row.tag || '',
    category: row.primary_category || 'RETAIL',
    primary_category: row.primary_category || 'CASH',
    due_date: row.due_date || null,
    cashBalance:   parseFloat(row.retail_cash   || 0) + parseFloat(row.bullion_cash  || 0) + parseFloat(row.silver_cash  || 0) + parseFloat(row.chit_cash || 0),
    goldBalance:   parseFloat(row.retail_gold   || 0) + parseFloat(row.bullion_gold  || 0),
    silverBalance: parseFloat(row.bullion_silver || 0) + parseFloat(row.silver_silver || 0),
    retailCash:    parseFloat(row.retail_cash    || 0),
    retailGold:    parseFloat(row.retail_gold    || 0),
    bullionCash:   parseFloat(row.bullion_cash   || 0),
    bullionGold:   parseFloat(row.bullion_gold   || 0),
    bullionSilver: parseFloat(row.bullion_silver || 0),
    silverCash:    parseFloat(row.silver_cash    || 0),
    silverSilver:  parseFloat(row.silver_silver  || 0),
    chitCash:      parseFloat(row.chit_cash      || 0),
    createdAt: row.created_at,
});

const dbTxToLocal = (row) => ({
    id: row.id,
    cid: row.customer_id,
    type: row.type,
    direction: row.direction,
    category: row.category,
    sub_type: row.sub_type,
    metal_type: row.type !== 'CASH' ? row.type : '',
    chit_scheme: row.chit_scheme || '',
    bill_amount: parseFloat(row.bill_amount || 0),
    grams: parseFloat(row.grams || 0),
    date: row.date,
    time: row.time,
    jama: parseFloat(row.jama || 0),
    nave: parseFloat(row.nave || 0),
    description: row.description || '',
    added_by: row.added_by || 'Staff',
    images: row.images || [],
    whatsapp_sent: row.whatsapp_sent || false,
    currentBalance: parseFloat(row.current_balance || 0),
    newBalance: parseFloat(row.new_balance || 0),
    createdAt: new Date(row.created_at).getTime(),
});

const getInitialData = (key, def) => {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : def;
    } catch { return def; }
};

const newId = () => crypto.randomUUID();
const n = (v) => parseFloat(v || 0);
const r2 = (v) => Math.round(v * 100) / 100;    // round to 2 decimal places (cash ₹)
const r3 = (v) => Math.round(v * 1000) / 1000;  // round to 3 decimal places (grams)

// Maps category + type → per-category balance field name on the customer object.
// This is the single source of truth for balance isolation across categories.
export const getCatBalKey = (category, type) => {
    if (category === 'RETAIL') {
        if (type === 'CASH') return 'retailCash';
        if (type === 'GOLD') return 'retailGold';
        return null;
    }
    if (category === 'BULLION') {
        if (type === 'CASH')   return 'bullionCash';
        if (type === 'GOLD')   return 'bullionGold';
        if (type === 'SILVER') return 'bullionSilver';
        return null;
    }
    if (category === 'SILVER') {
        if (type === 'CASH')   return 'silverCash';
        if (type === 'SILVER') return 'silverSilver';
        return null;
    }
    if (category === 'CHIT') {
        if (type === 'CASH') return 'chitCash';
        return null;
    }
    return null;
};

const GRAMS_KEYS = new Set(['retailGold', 'bullionGold', 'bullionSilver', 'silverSilver']);

// Migration: populate per-category balance fields from transaction history for customers that pre-date this feature.
const migrateCustomers = (custs, txs) => {
    if (custs.length === 0) return custs;
    if (custs.every(c => c.retailCash !== undefined)) return custs; // already migrated
    return custs.map(c => {
        if (c.retailCash !== undefined) return c;
        const bals = { retailCash: 0, retailGold: 0, bullionCash: 0, bullionGold: 0, bullionSilver: 0, silverCash: 0, silverSilver: 0, chitCash: 0 };
        txs.filter(t => t.cid === c.id).forEach(t => {
            const key = getCatBalKey(t.category, t.type);
            if (key !== null) bals[key] += n(t.jama) - n(t.nave);
        });
        Object.keys(bals).forEach(k => {
            bals[k] = GRAMS_KEYS.has(k) ? r3(bals[k]) : r2(bals[k]);
        });
        return { ...c, ...bals };
    });
};

export const STORAGE_KEYS = [
    'bt_customers', 'bt_transactions', 'bt_auth', 'bt_chit_schemes'
];

const DEFAULT_CHIT_SCHEMES = ['CHIT', 'DIWALI FUND', 'GOLD SCHEME', 'SILVER SCHEME', 'MONTHLY SCHEME'];

export const AppProvider = ({ children }) => {
    const [customers,    setCustomers]    = useState(() => {
        const custs = getInitialData('bt_customers', []);
        const txs   = getInitialData('bt_transactions', []);
        return migrateCustomers(custs, txs);
    });
    const [transactions,        setTransactions]        = useState(() => getInitialData('bt_transactions', []));
    const [deletedTransactions, setDeletedTransactions] = useState(() => getInitialData('bt_deleted_transactions', []));
    const [authSession,         setAuthSession]         = useState(() => getInitialData('bt_auth', null));
    const [chitSchemes,         setChitSchemes]         = useState(() => getInitialData('bt_chit_schemes', DEFAULT_CHIT_SCHEMES));

    // Supabase session context (set once authenticated)
    const dbOrgId       = useRef(null);
    const dbUserId      = useRef(null);
    const channelRef    = useRef(null);
    const handlingSession = useRef(false); // guard against concurrent handleSession calls
    const [orgId, setOrgId] = useState(null);

    useEffect(() => { localStorage.setItem('bt_customers',            JSON.stringify(customers));           }, [customers]);
    useEffect(() => { localStorage.setItem('bt_transactions',         JSON.stringify(transactions));        }, [transactions]);
    useEffect(() => { localStorage.setItem('bt_deleted_transactions', JSON.stringify(deletedTransactions)); }, [deletedTransactions]);
    useEffect(() => { localStorage.setItem('bt_auth',                 JSON.stringify(authSession));         }, [authSession]);
    useEffect(() => { localStorage.setItem('bt_chit_schemes',         JSON.stringify(chitSchemes));         }, [chitSchemes]);

    // ── Push local customers + transactions up to a fresh Supabase org ───────
    const pushLocalToSupabase = useCallback(async (orgId, userId, localCusts, localTxs, displayName = 'owner') => {
        console.log(`[Supabase] Migrating ${localCusts.length} customers, ${localTxs.length} transactions to cloud…`);

        for (const c of localCusts) {
            const { error } = await supabase.from('customers').insert({
                id: c.id, org_id: orgId,
                name: c.name, mobile: c.mobile,
                primary_category: c.primary_category || 'CASH',
                due_date: c.due_date || null,
                retail_cash: c.retailCash || 0, retail_gold: c.retailGold || 0,
                bullion_cash: c.bullionCash || 0, bullion_gold: c.bullionGold || 0,
                bullion_silver: c.bullionSilver || 0,
                silver_cash: c.silverCash || 0, silver_silver: c.silverSilver || 0,
                chit_cash: c.chitCash || 0,
            });
            if (error && error.code !== '23505') // ignore duplicate key
                console.error('[Supabase] migrate customer:', error);
        }

        for (const tx of localTxs) {
            const { error } = await supabase.from('transactions').insert({
                id: tx.id, org_id: orgId,
                customer_id: tx.cid,
                category: tx.category, sub_type: tx.sub_type,
                type: tx.type, direction: tx.direction,
                jama: tx.jama, nave: tx.nave,
                grams: tx.grams || 0, bill_amount: tx.bill_amount || 0,
                chit_scheme: tx.chit_scheme || '',
                description: tx.description || '',
                date: tx.date, time: tx.time,
                added_by: displayName,
                images: tx.images || [],
                current_balance: tx.currentBalance || 0,
                new_balance: tx.newBalance || 0,
            });
            if (error && error.code !== '23505')
                console.error('[Supabase] migrate tx:', error);
        }
        console.log('[Supabase] Migration complete.');
    }, []);

    // ── Load all data from Supabase for a given org ──────────────────────────
    const loadFromSupabase = useCallback(async (orgId, userId, displayName = 'owner') => {
        const [{ data: custs, error: ce }, { data: txs, error: te }, { data: profiles }] = await Promise.all([
            supabase.from('customers').select('*').eq('org_id', orgId).order('created_at'),
            supabase.from('transactions').select('*').eq('org_id', orgId).is('deleted_at', null).order('date').order('time'),
            supabase.from('profiles').select('id, display_name, role').eq('org_id', orgId),
        ]);

        if (ce) { console.error('[Supabase] load customers:', ce); return; }
        if (te) { console.error('[Supabase] load transactions:', te); return; }

        // Build UUID → display name map so "By" column shows names not UUIDs
        const uuidNameMap = {};
        (profiles || []).forEach(p => { uuidNameMap[p.id] = p.display_name || p.role || 'staff'; });
        const txToLocal = (tx) => ({ ...dbTxToLocal(tx), added_by: uuidNameMap[tx.added_by] || tx.added_by });

        if (custs.length === 0) {
            // Supabase is empty — check if localStorage has data to migrate up
            const localCusts = getInitialData('bt_customers', []);
            const localTxs   = getInitialData('bt_transactions', []);
            if (localCusts.length > 0) {
                await pushLocalToSupabase(orgId, userId, localCusts, localTxs, displayName);
                // Re-fetch after migration
                const { data: fresh } = await supabase.from('customers').select('*').eq('org_id', orgId).order('created_at');
                const { data: freshTx } = await supabase.from('transactions').select('*').eq('org_id', orgId).is('deleted_at', null).order('date').order('time');
                if (fresh)   { setCustomers(fresh.map(dbCustToLocal)); localStorage.setItem('bt_customers', JSON.stringify(fresh.map(dbCustToLocal))); }
                if (freshTx) { setTransactions(freshTx.map(txToLocal)); localStorage.setItem('bt_transactions', JSON.stringify(freshTx.map(txToLocal))); }
            }
            // else: both empty — nothing to do
            return;
        }

        // Supabase has data — use it as source of truth
        const localCusts = custs.map(dbCustToLocal);
        const localTxs   = txs.map(txToLocal);
        setCustomers(localCusts);
        setTransactions(localTxs);
        localStorage.setItem('bt_customers',    JSON.stringify(localCusts));
        localStorage.setItem('bt_transactions', JSON.stringify(localTxs));
    }, [pushLocalToSupabase]);

    // ── Effect 1: Auth listener — runs ONCE, never re-runs ───────────────────
    //   Handles session events only. Does NOT set up Realtime channel here.
    //   Setting orgId state here is what triggers Effect 2 below.
    useEffect(() => {
        if (!isSupabaseReady()) return;

        const EMAIL_ROLE = {
            'owner@jjledger.com': 'owner',
            'staff@jjledger.com': 'staff',
            'view@jjledger.com':  'view',
        };

        // Guard: only one handleSession runs at a time — prevents race between
        // INITIAL_SESSION and TOKEN_REFRESHED both trying to initialize concurrently.
        const handleSession = async (session, force = false) => {
            if (!session) { console.log('[Auth] handleSession: skipped — no session'); return; }
            if (handlingSession.current && !force) {
                console.warn('[Auth] handleSession: BLOCKED by guard — this event will be lost!', { force });
                return;
            }
            if (force && handlingSession.current) {
                console.warn('[Auth] handleSession: force-clearing stale guard for SIGNED_IN');
            }
            handlingSession.current = true;
            console.log('[Auth] handleSession: starting for', session.user.email);
            try {
                dbUserId.current = session.user.id;

                const { data: profile, error: profErr } = await supabase
                    .from('profiles')
                    .select('org_id, role, display_name')
                    .eq('id', session.user.id)
                    .single();
                console.log('[Auth] profile fetch result — org_id:', profile?.org_id, 'role:', profile?.role, 'error:', profErr?.message);

                if (profile?.org_id) {
                    dbOrgId.current = profile.org_id;
                    const displayName = profile.display_name || profile.role || 'staff';
                    setAuthSession({ role: profile.role || 'staff', displayName, orgId: profile.org_id });
                    setOrgId(profile.org_id);
                    loadFromSupabase(profile.org_id, session.user.id, displayName);
                    console.log('[Auth] handleSession: complete — org_id set, data loading');
                } else {
                    const role = EMAIL_ROLE[session.user.email] || 'staff';
                    if (profErr) console.warn('[Auth] Profile fetch error:', profErr.message);
                    console.warn('[Auth] No org_id on profile — localStorage mode.');
                    setAuthSession({ role });
                }
            } finally {
                handlingSession.current = false;
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] event:', event, '| has session:', !!session, '| dbOrgId set:', !!dbOrgId.current, '| guard:', handlingSession.current);
            if (event === 'INITIAL_SESSION') {
                await handleSession(session);
            } else if (event === 'SIGNED_IN') {
                // Explicit sign-in always takes priority — force-clear stale guard
                // so a background TOKEN_REFRESHED never blocks the login spinner
                await handleSession(session, true);
            } else if (event === 'TOKEN_REFRESHED') {
                if (!dbOrgId.current) await handleSession(session);
                else if (session) { dbUserId.current = session.user.id; console.log('[Auth] TOKEN_REFRESHED — userId updated, channel untouched'); }
            } else if (event === 'SIGNED_OUT') {
                console.log('[Auth] SIGNED_OUT — clearing state');
                dbOrgId.current  = null;
                dbUserId.current = null;
                setOrgId(null);
                setAuthSession(null);
            }
        });

        return () => { subscription.unsubscribe(); };
    }, []); // ← empty — this listener is set up once and never rebuilt

    // ── Effect 2: Realtime channel + poll + visibility — runs only when orgId changes ──
    //   orgId changes on login (set) and logout (null). Channel is NEVER rebuilt
    //   during normal usage (data loads, token refreshes, tab switches).
    useEffect(() => {
        if (!orgId) return; // logged out — nothing to do

        let debounceTimer;
        const scheduleReload = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
            }, 600);
        };

        // Realtime subscription — filter by org_id so Supabase routes events directly
        // without per-event RLS verification (which throttles and drops events without it)
        const channel = supabase
            .channel(`org-${orgId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` },
                scheduleReload)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'customers', filter: `org_id=eq.${orgId}` },
                scheduleReload)
            .subscribe((status) => {
                console.log('[Realtime] channel status:', status);
                if (status === 'SUBSCRIBED') {
                    // Fresh connection — reload to catch anything missed during connection setup
                    if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Channel unhealthy — poll immediately; Supabase auto-reconnects,
                    // next SUBSCRIBED fires another reload to close any gap
                    console.warn('[Realtime] channel unhealthy, polling for missed events');
                    if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
                }
            });
        channelRef.current = channel;

        // Poll every 30s — guaranteed fallback for UPDATE/DELETE events
        // (Supabase drops those when REPLICA IDENTITY is DEFAULT)
        const pollInterval = setInterval(() => {
            if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
        }, 30000);

        // Reload on tab/window focus — catches cross-device changes instantly
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && dbOrgId.current)
                loadFromSupabase(dbOrgId.current, dbUserId.current);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Reload when network comes back — mobile switching WiFi↔cellular, phone waking
        const handleOnline = () => {
            if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
        };
        window.addEventListener('online', handleOnline);

        // PWA fallback — 'focus' fires on iOS PWA where visibilitychange can be unreliable
        const handleFocus = () => {
            if (dbOrgId.current) loadFromSupabase(dbOrgId.current, dbUserId.current);
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearTimeout(debounceTimer);
            clearInterval(pollInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleFocus);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [orgId, loadFromSupabase]);

    const addChitScheme = (name) => {
        const trimmed = name.trim().toUpperCase();
        if (!trimmed) return;
        setChitSchemes(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    };

    const removeChitScheme = (name) => {
        if (DEFAULT_CHIT_SCHEMES.includes(name)) return; // protect defaults
        setChitSchemes(prev => prev.filter(s => s !== name));
    };

    const getCustomer = useCallback((id) => customers.find(c => c.id === id), [customers]);
    const getCustomerByMobile = useCallback((mobile) => customers.find(c => c.mobile === mobile), [customers]);

    const addCustomer = (data) => {
        const cId = newId();
        const c = {
            id: cId,
            name: data.name,
            mobile: data.mobile,
            tag: data.tag || '',
            category: data.category || 'RETAIL',
            primary_category: data.primary_category || 'CASH',
            due_date: data.due_date || null,
            cashBalance: 0,
            goldBalance: 0,
            silverBalance: 0,
            // Per-category isolated balances
            retailCash: 0, retailGold: 0,
            bullionCash: 0, bullionGold: 0, bullionSilver: 0,
            silverCash: 0, silverSilver: 0,
            chitCash: 0,
            createdAt: new Date().toISOString()
        };

        const initialTxs = [];
        const dStr = data.date || new Date().toISOString().split('T')[0];
        const tStr = data.time ? `${data.time}:00` : new Date().toTimeString().split(' ')[0];

        ['CASH', 'GOLD', 'SILVER'].forEach(type => {
            const initialVal = n(data[`initial${type}`]);
            if (initialVal !== 0) {
                const isJama = initialVal > 0;
                const amt = Math.abs(initialVal);
                const catMap = { CASH: 'RETAIL', GOLD: 'BULLION', SILVER: 'SILVER' };

                initialTxs.push({
                    id: newId(),
                    cid: cId,
                    type: type,
                    direction: isJama ? 'IN' : 'OUT',
                    category: catMap[type],
                    sub_type: type,
                    metal_type: type !== 'CASH' ? type : '',
                    chit_scheme: '',
                    bill_amount: 0,
                    grams: type !== 'CASH' ? amt : 0,
                    date: dStr,
                    time: tStr,
                    jama: isJama ? amt : 0,
                    nave: isJama ? 0 : amt,
                    description: 'Opening Balance',
                    added_by: 'Owner',
                    images: data.initialImages || [],
                    whatsapp_sent: false,
                    currentBalance: 0,
                    newBalance: initialVal,
                    createdAt: Date.now()
                });

                if (type === 'CASH')   { c.cashBalance = initialVal;   c.retailCash   = initialVal; }
                if (type === 'GOLD')   { c.goldBalance = initialVal;   c.bullionGold  = initialVal; }
                if (type === 'SILVER') { c.silverBalance = initialVal; c.silverSilver = initialVal; }
            }
        });

        setCustomers(prev => [...prev, c]);

        if (initialTxs.length > 0) {
            setTransactions(prev => [...prev, ...initialTxs]);
        }

        // ── Sync to Supabase (fire-and-forget) ─────────────────────────────
        if (isSupabaseReady() && dbOrgId.current) {
            const orgId = dbOrgId.current;
            supabase.from('customers').insert({
                id: c.id,
                org_id: orgId,
                name: c.name,
                mobile: c.mobile,
                primary_category: c.primary_category,
                due_date: c.due_date || null,
            }).then(({ error }) => {
                if (error) console.error('[Supabase] addCustomer:', error);
            });

            for (const tx of initialTxs) {
                supabase.rpc('add_transaction', {
                    p_org_id:      orgId,
                    p_customer_id: tx.cid,
                    p_category:    tx.category,
                    p_sub_type:    tx.sub_type,
                    p_type:        tx.type,
                    p_jama:        tx.jama,
                    p_nave:        tx.nave,
                    p_grams:       tx.grams,
                    p_bill_amount: tx.bill_amount || 0,
                    p_chit_scheme: tx.chit_scheme || '',
                    p_description: tx.description || '',
                    p_date:        tx.date,
                    p_time:        tx.time,
                    p_added_by:    dbUserId.current,
                    p_images:      tx.images || [],
                    p_current_bal: tx.currentBalance,
                    p_new_bal:     tx.newBalance,
                    p_due_date:    null,
                }).then(({ error }) => {
                    if (error) console.error('[Supabase] addCustomer initialTx:', error);
                });
            }
        }

        return c;
    };

    const updateCustomer = (id, updates) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

        // Sync to Supabase
        if (isSupabaseReady() && dbOrgId.current) {
            const dbUpdates = {};
            if (updates.name    !== undefined) dbUpdates.name    = updates.name;
            if (updates.mobile  !== undefined) dbUpdates.mobile  = updates.mobile;
            if (updates.mobile2 !== undefined) dbUpdates.mobile2 = updates.mobile2;
            if (Object.keys(dbUpdates).length) {
                supabase.from('customers')
                    .update({ ...dbUpdates, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .then(({ error }) => { if (error) console.error('[Supabase] updateCustomer:', error); });
            }
        }
    };

    const updateCustomerDueDate = (customerId, newDueDate) => {
        setCustomers(prev => prev.map(c => {
            if (c.id !== customerId) return c;
            return { ...c, due_date: newDueDate };
        }));

        if (isSupabaseReady() && dbOrgId.current) {
            supabase.from('customers')
                .update({ due_date: newDueDate, updated_at: new Date().toISOString() })
                .eq('id', customerId)
                .then(({ error }) => {
                    if (error) console.error('[Supabase] updateDueDate:', error);
                });
        }
    };

    const _updateBalances = (customerId, { cash = 0, gold = 0, silver = 0, category = '' }) => {
        setCustomers(prev => prev.map(c => {
            if (c.id !== customerId) return c;
            const updates = {};
            if (cash !== 0) {
                updates.cashBalance = r2(n(c.cashBalance) + cash);
                const key = getCatBalKey(category, 'CASH');
                if (key) updates[key] = r2(n(c[key] || 0) + cash);
            }
            if (gold !== 0) {
                updates.goldBalance = r3(n(c.goldBalance) + gold);
                const key = getCatBalKey(category, 'GOLD');
                if (key) updates[key] = r3(n(c[key] || 0) + gold);
            }
            if (silver !== 0) {
                updates.silverBalance = r3(n(c.silverBalance) + silver);
                const key = getCatBalKey(category, 'SILVER');
                if (key) updates[key] = r3(n(c[key] || 0) + silver);
            }
            return { ...c, ...updates };
        }));
    };

    const addTransaction = (data) => {
        const c = customers.find(x => x.id === data.customerId);
        let prevBal = 0;

        // Use the category-isolated balance as the baseline for this transaction
        const catKey = getCatBalKey(data.category, data.type);
        if (catKey && c?.[catKey] !== undefined) {
            prevBal = n(c[catKey]);
        } else if (data.type === 'CASH') {
            prevBal = n(c?.cashBalance);
        } else if (data.type === 'GOLD') {
            prevBal = n(c?.goldBalance);
        } else if (data.type === 'SILVER') {
            prevBal = n(c?.silverBalance);
        }

        const jama = n(data.jama);
        const nave = n(data.nave);
        const delta = jama - nave;

        // direction is explicit: IN = shop received, OUT = shop gave
        const direction = jama > 0 ? 'IN' : 'OUT';

        const entry = {
            id: newId(),
            cid: data.customerId,
            type: data.type || 'CASH',
            direction,                                    // 'IN' | 'OUT'
            category:    data.category    || 'RETAIL',
            sub_type:    data.sub_type    || 'CASH',
            metal_type:  data.metal_type  || '',
            chit_scheme: data.chit_scheme || '',
            bill_amount: parseFloat(data.bill_amount || 0),
            grams:       parseFloat(data.grams       || 0),
            date: data.date || new Date().toISOString().split('T')[0],
            time: data.time || new Date().toTimeString().split(' ')[0],
            jama,
            nave,
            description: data.description || '',
            added_by: data.added_by || 'Staff',
            images: data.images || [],
            whatsapp_sent: data.whatsapp_sent || false,
            currentBalance: prevBal,
            newBalance: prevBal + delta,
            createdAt: Date.now()
        };

        setTransactions(prev => [...prev, entry]);

        let cashDelta = 0, goldDelta = 0, silverDelta = 0;

        if (entry.type === 'CASH') cashDelta = delta;
        else if (entry.type === 'GOLD') goldDelta = delta;
        else if (entry.type === 'SILVER') silverDelta = delta;

        _updateBalances(data.customerId, {
            cash: cashDelta,
            gold: goldDelta,
            silver: silverDelta,
            category: entry.category,
        });

        // Update due date if provided in transaction
        if (data.due_date) {
            updateCustomerDueDate(data.customerId, data.due_date);
        }

        // ── Sync to Supabase (fire-and-forget) ─────────────────────────────
        if (isSupabaseReady() && dbOrgId.current) {
            supabase.rpc('add_transaction', {
                p_org_id:      dbOrgId.current,
                p_customer_id: entry.cid,
                p_category:    entry.category,
                p_sub_type:    entry.sub_type,
                p_type:        entry.type,
                p_jama:        entry.jama,
                p_nave:        entry.nave,
                p_grams:       entry.grams,
                p_bill_amount: entry.bill_amount || 0,
                p_chit_scheme: entry.chit_scheme || '',
                p_description: entry.description || '',
                p_date:        entry.date,
                p_time:        entry.time,
                p_added_by:    dbUserId.current,
                p_images:      entry.images || [],
                p_current_bal: entry.currentBalance,
                p_new_bal:     entry.newBalance,
                p_due_date:    data.due_date || null,
            }).then(({ error }) => {
                if (error) console.error('[Supabase] addTransaction:', error);
            });
        }

        return entry;
    };

    const deleteTransaction = (id) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        // reverse the balance change
        const delta = tx.nave - tx.jama; // inverted
        let cashDelta = 0, goldDelta = 0, silverDelta = 0;
        if (tx.type === 'CASH') cashDelta = delta;
        else if (tx.type === 'GOLD') goldDelta = delta;
        else if (tx.type === 'SILVER') silverDelta = delta;

        _updateBalances(tx.cid, { cash: cashDelta, gold: goldDelta, silver: silverDelta, category: tx.category });

        // Keep a local copy with deletion timestamp (persists to localStorage)
        const deletedAt = new Date().toISOString();
        setDeletedTransactions(prev => [{ ...tx, deleted_at: deletedAt }, ...prev].slice(0, 200));

        setTransactions(prev => prev.filter(t => t.id !== id));

        // Soft-delete in Supabase
        if (dbOrgId.current) {
            supabase.from('transactions')
                .update({ deleted_at: deletedAt })
                .eq('id', id)
                .then(({ error }) => { if (error) console.error('[Supabase] deleteTransaction:', error); });
        }
    };

    const seedDummyData = () => {
        const now = Date.now();
        const d   = (offset) => new Date(now + offset * 86400000).toISOString().split('T')[0];

        const day1 = d(-14); const day2 = d(-12); const day3 = d(-10);
        const day4 = d(-7);  const day5 = d(-5);  const day6 = d(-3);
        const day7 = d(-1);  const today = d(0);
        const dueOverdue  = d(-2);
        const dueUpcoming = d(5);
        const dueFuture   = d(15);

        // tx helper — curBal/newBal are the running balance for that category+type
        const tx = (id, cid, type, category, sub_type, jama, nave, curBal, newBal, date, time, desc, addedBy, ts, chit = '') => ({
            id, cid,
            type, direction: jama > 0 ? 'IN' : 'OUT',
            category, sub_type,
            metal_type: type !== 'CASH' ? type : '',
            chit_scheme: chit, bill_amount: 0,
            grams: type !== 'CASH' ? (jama > 0 ? jama : nave) : 0,
            date, time, jama, nave,
            description: desc,
            added_by: addedBy,
            images: [], whatsapp_sent: false,
            currentBalance: curBal, newBalance: newBal,
            createdAt: ts,
        });

        // ─── 15 customers covering every category / subtype / direction ────────
        // Per-category balance fields mirror the net of the transactions below.
        // Aggregate cashBalance = sum of all *Cash fields; goldBalance = retailGold+bullionGold;
        // silverBalance = bullionSilver+silverSilver  (for legacy display / export).
        const mk = (rc=0,rg=0,bc=0,bg=0,bs=0,sc=0,ss=0,cc=0) => ({
            retailCash:rc, retailGold:rg,
            bullionCash:bc, bullionGold:bg, bullionSilver:bs,
            silverCash:sc, silverSilver:ss,
            chitCash:cc,
            cashBalance: rc+bc+sc+cc,
            goldBalance: rg+bg,
            silverBalance: bs+ss,
        });

        const customers = [
            // ── Pure-category customers (1 category each) ──────────────────────
            // C1  Combo 1+2  : RETAIL CASH IN + OUT
            { id:'sd-c1',  name:'Ramesh Kumar',      mobile:'9800000001', createdAt:day1, ...mk(12000),          due_date:null,        primary_category:'CASH'   },
            // C2  Combo 3+4  : RETAIL GOLD IN + OUT
            { id:'sd-c2',  name:'Lakshmi Devi',      mobile:'9800000002', createdAt:day1, ...mk(0,15),           due_date:null,        primary_category:'GOLD'   },
            // C3  Combo 5+6  : BULLION CASH IN + OUT
            { id:'sd-c3',  name:'Suresh Bullion',    mobile:'9800000003', createdAt:day2, ...mk(0,0,20000),      due_date:null,        primary_category:'CASH'   },
            // C4  Combo 7+8  : BULLION GOLD IN + OUT
            { id:'sd-c4',  name:'Ganesh Traders',    mobile:'9800000004', createdAt:day2, ...mk(0,0,0,60),       due_date:dueOverdue,  primary_category:'GOLD'   },
            // C5  Combo 9+10 : BULLION SILVER IN + OUT
            { id:'sd-c5',  name:'Kavitha Silver',    mobile:'9800000005', createdAt:day2, ...mk(0,0,0,0,300),    due_date:null,        primary_category:'SILVER' },
            // C6  Combo 11+12: SILVER CASH IN + OUT (net negative — they owe us)
            { id:'sd-c6',  name:'Murugan Co',        mobile:'9800000006', createdAt:day3, ...mk(0,0,0,0,0,-5000),due_date:dueOverdue,  primary_category:'CASH'   },
            // C7  Combo 13+14: SILVER SILVER IN + OUT
            { id:'sd-c7',  name:'Devi Silver Works', mobile:'9800000007', createdAt:day3, ...mk(0,0,0,0,0,0,650),due_date:null,        primary_category:'SILVER' },
            // C8  Combo 15+16: CHIT CASH IN (installments) + CHIT CASH OUT (payout)
            { id:'sd-c8',  name:'Annamalai Chit',    mobile:'9800000008', createdAt:day4, ...mk(0,0,0,0,0,0,0,-15000), due_date:today, primary_category:'CASH'   },

            // ── Multi-category customers ────────────────────────────────────────
            // C9  : Retail Cash + Bullion Gold + Silver Silver (all IN)
            { id:'sd-c9',  name:'Vijay Multi',       mobile:'9800000009', createdAt:day4, ...mk(10000,0,0,50,0,0,200), due_date:dueUpcoming, primary_category:'GOLD' },
            // C10 : Retail Cash OUT + Bullion Cash IN + Chit Cash IN
            { id:'sd-c10', name:'Priya Jewellers',   mobile:'9800000010', createdAt:day4, ...mk(-12000,0,25000,0,0,0,0,3000), due_date:null, primary_category:'CASH' },
            // C11 : Retail Gold IN + Bullion Silver OUT + Silver Cash IN
            { id:'sd-c11', name:'Karthik Gold',      mobile:'9800000011', createdAt:day5, ...mk(0,30,0,0,-150,8000), due_date:dueUpcoming, primary_category:'GOLD' },
            // C12 : All DR — Bullion Gold OUT + Silver Silver OUT + Chit Cash OUT
            { id:'sd-c12', name:'Meena Metals',      mobile:'9800000012', createdAt:day5, ...mk(0,0,0,-20,0,0,-80,-2000), due_date:dueFuture, primary_category:'GOLD' },
            // C13 : Bullion Cash IN/OUT + Bullion Silver IN (bullion-only)
            { id:'sd-c13', name:'Raja Bullion',      mobile:'9800000013', createdAt:day5, ...mk(0,0,25000,0,750), due_date:null, primary_category:'CASH' },
            // C14 : Retail Cash IN/OUT + Bullion Gold IN
            { id:'sd-c14', name:'Sathya Trades',     mobile:'9800000014', createdAt:day6, ...mk(20000,0,0,15),    due_date:dueFuture, primary_category:'CASH' },
            // C15 : Chit Cash (3 installments) + Silver Cash IN
            { id:'sd-c15', name:'Nalini Chits',      mobile:'9800000015', createdAt:day6, ...mk(0,0,0,0,0,5000,0,6000), due_date:null, primary_category:'CASH' },
        ];

        // ── All 16 combinations in the transactions ────────────────────────────
        // Format: tx(id, cid, type, category, sub_type, jama, nave, curBal, newBal, date, time, desc, addedBy, ts, chitScheme)
        // Combinations:  1=RETAIL+CASH+IN  2=RETAIL+CASH+OUT  3=RETAIL+GOLD+IN  4=RETAIL+GOLD+OUT
        //                5=BULLION+CASH+IN  6=BULLION+CASH+OUT  7=BULLION+GOLD+IN  8=BULLION+GOLD+OUT
        //                9=BULLION+SILVER+IN  10=BULLION+SILVER+OUT  11=SILVER+CASH+IN  12=SILVER+CASH+OUT
        //                13=SILVER+SILVER+IN  14=SILVER+SILVER+OUT  15=CHIT+CASH+IN  16=CHIT+CASH+OUT
        const transactions = [

            // ── C1: Ramesh Kumar — RETAIL CASH (combo 1 IN, combo 2 OUT) ──────
            tx('sd-t1',  'sd-c1', 'CASH',  'RETAIL',  'CASH',    20000, 0,      0,      20000,  day3,'10:00:00','Cash deposit',            'Owner', now-10*86400000+1*3600000),
            tx('sd-t2',  'sd-c1', 'CASH',  'RETAIL',  'CASH',    0,     8000,   20000,  12000,  day7,'14:30:00','Partial withdrawal',       'Staff', now-1*86400000+5*3600000),

            // ── C2: Lakshmi Devi — RETAIL GOLD (combo 3 IN, combo 4 OUT) ──────
            // RETAIL gold → sub_type='METAL', type='GOLD'
            tx('sd-t3',  'sd-c2', 'GOLD',  'RETAIL',  'METAL',   25,    0,      0,      25,     day4,'09:30:00','Old gold deposit',        'Owner', now-7*86400000+1*3600000),
            tx('sd-t4',  'sd-c2', 'GOLD',  'RETAIL',  'METAL',   0,     10,     25,     15,     day7,'11:00:00','Gold partially given back','Owner', now-1*86400000+2*3600000),

            // ── C3: Suresh Bullion — BULLION CASH (combo 5 IN, combo 6 OUT) ───
            tx('sd-t5',  'sd-c3', 'CASH',  'BULLION', 'CASH',    50000, 0,      0,      50000,  day2,'10:00:00','Bullion payment received', 'Owner', now-12*86400000+1*3600000),
            tx('sd-t6',  'sd-c3', 'CASH',  'BULLION', 'CASH',    0,     30000,  50000,  20000,  day5,'15:00:00','Cash returned to customer','Staff', now-5*86400000+6*3600000),

            // ── C4: Ganesh Traders — BULLION GOLD (combo 7 IN, combo 8 OUT) ───
            tx('sd-t7',  'sd-c4', 'GOLD',  'BULLION', 'GOLD',    100,   0,      0,      100,    day2,'09:00:00','Bullion gold received',    'Owner', now-12*86400000+0.5*3600000),
            tx('sd-t8',  'sd-c4', 'GOLD',  'BULLION', 'GOLD',    0,     40,     100,    60,     day6,'16:00:00','Partial gold returned',    'Staff', now-3*86400000+7*3600000),

            // ── C5: Kavitha Silver — BULLION SILVER (combo 9 IN, combo 10 OUT) ─
            tx('sd-t9',  'sd-c5', 'SILVER','BULLION', 'SILVER',  500,   0,      0,      500,    day2,'11:00:00','Silver bullion deposited', 'Owner', now-12*86400000+2*3600000),
            tx('sd-t10', 'sd-c5', 'SILVER','BULLION', 'SILVER',  0,     200,    500,    300,    day6,'10:00:00','Silver returned',          'Staff', now-3*86400000+1*3600000),

            // ── C6: Murugan Co — SILVER CASH (combo 11 IN, combo 12 OUT; net DR) ─
            tx('sd-t11', 'sd-c6', 'CASH',  'SILVER',  'CASH',    15000, 0,      0,      15000,  day3,'09:00:00','Silver fund deposit',      'Staff', now-10*86400000+0.5*3600000),
            tx('sd-t12', 'sd-c6', 'CASH',  'SILVER',  'CASH',    0,     20000,  15000,  -5000,  day7,'12:00:00','Cash advance given',       'Owner', now-1*86400000+3*3600000),

            // ── C7: Devi Silver Works — SILVER SILVER (combo 13 IN, combo 14 OUT) ─
            tx('sd-t13', 'sd-c7', 'SILVER','SILVER',  'SILVER',  1000,  0,      0,      1000,   day3,'14:00:00','Silver bars received',     'Owner', now-10*86400000+5*3600000),
            tx('sd-t14', 'sd-c7', 'SILVER','SILVER',  'SILVER',  0,     350,    1000,   650,    day6,'11:30:00','Silver bars returned',     'Staff', now-3*86400000+2*3600000),

            // ── C8: Annamalai Chit — CHIT CASH (combo 15 IN×2, combo 16 OUT) ──
            tx('sd-t15', 'sd-c8', 'CASH',  'CHIT',    'CASH',    5000,  0,      0,      5000,   day4,'10:00:00','Monthly installment 1',    'Staff', now-7*86400000+1*3600000,  'MONTHLY SCHEME'),
            tx('sd-t16', 'sd-c8', 'CASH',  'CHIT',    'CASH',    5000,  0,      5000,   10000,  day5,'10:00:00','Monthly installment 2',    'Staff', now-5*86400000+1*3600000,  'MONTHLY SCHEME'),
            tx('sd-t17', 'sd-c8', 'CASH',  'CHIT',    'CASH',    0,     25000,  10000,  -15000, day7,'09:00:00','Chit payout disbursed',    'Owner', now-1*86400000+0.5*3600000,'MONTHLY SCHEME'),

            // ── C9: Vijay Multi — Retail Cash + Bullion Gold + Silver Silver ───
            tx('sd-t18', 'sd-c9', 'CASH',  'RETAIL',  'CASH',    10000, 0,      0,      10000,  day4,'11:00:00','Cash deposit',             'Owner', now-7*86400000+2*3600000),
            tx('sd-t19', 'sd-c9', 'GOLD',  'BULLION', 'GOLD',    50,    0,      0,      50,     day4,'11:30:00','Gold bullion received',    'Owner', now-7*86400000+2.5*3600000),
            tx('sd-t20', 'sd-c9', 'SILVER','SILVER',  'SILVER',  200,   0,      0,      200,    day5,'10:00:00','Silver deposit',           'Staff', now-5*86400000+1*3600000),

            // ── C10: Priya Jewellers — Retail Cash OUT + Bullion Cash + Chit ───
            tx('sd-t21', 'sd-c10','CASH',  'RETAIL',  'CASH',    0,     12000,  0,      -12000, day3,'13:00:00','Cash advance to customer', 'Owner', now-10*86400000+4*3600000),
            tx('sd-t22', 'sd-c10','CASH',  'BULLION', 'CASH',    25000, 0,      0,      25000,  day5,'09:30:00','Bullion payment received', 'Staff', now-5*86400000+0.5*3600000),
            tx('sd-t23', 'sd-c10','CASH',  'CHIT',    'CASH',    3000,  0,      0,      3000,   day7,'10:00:00','Diwali fund installment',  'Staff', now-1*86400000+1*3600000,  'DIWALI FUND'),

            // ── C11: Karthik Gold — Retail Gold IN + Bullion Silver OUT + Silver Cash IN ─
            tx('sd-t24', 'sd-c11','GOLD',  'RETAIL',  'METAL',   30,    0,      0,      30,     day4,'09:00:00','Old gold deposited',       'Owner', now-7*86400000+0.5*3600000),
            tx('sd-t25', 'sd-c11','SILVER','BULLION', 'SILVER',  0,     150,    0,      -150,   day5,'14:00:00','Silver advance given',     'Owner', now-5*86400000+5*3600000),
            tx('sd-t26', 'sd-c11','CASH',  'SILVER',  'CASH',    8000,  0,      0,      8000,   day6,'11:00:00','Silver fund payment',      'Staff', now-3*86400000+2*3600000),

            // ── C12: Meena Metals — All DR (Bullion Gold OUT + Silver Silver OUT + Chit Cash OUT) ─
            tx('sd-t27', 'sd-c12','GOLD',  'BULLION', 'GOLD',    0,     20,     0,      -20,    day5,'10:30:00','Gold advance given',       'Owner', now-5*86400000+1.5*3600000),
            tx('sd-t28', 'sd-c12','SILVER','SILVER',  'SILVER',  0,     80,     0,      -80,    day5,'11:00:00','Silver advance given',     'Owner', now-5*86400000+2*3600000),
            tx('sd-t29', 'sd-c12','CASH',  'CHIT',    'CASH',    0,     2000,   0,      -2000,  day6,'14:00:00','Gold scheme advance',      'Staff', now-3*86400000+5*3600000,  'GOLD SCHEME'),

            // ── C13: Raja Bullion — Bullion Cash IN/OUT + Bullion Silver IN ────
            tx('sd-t30', 'sd-c13','CASH',  'BULLION', 'CASH',    40000, 0,      0,      40000,  day3,'09:00:00','Bullion cash deposit',     'Owner', now-10*86400000+0.5*3600000),
            tx('sd-t31', 'sd-c13','CASH',  'BULLION', 'CASH',    0,     15000,  40000,  25000,  day6,'10:00:00','Cash returned',            'Staff', now-3*86400000+1*3600000),
            tx('sd-t32', 'sd-c13','SILVER','BULLION', 'SILVER',  750,   0,      0,      750,    day4,'15:00:00','Bulk silver bars received','Owner', now-7*86400000+6*3600000),

            // ── C14: Sathya Trades — Retail Cash IN/OUT + Bullion Gold IN ─────
            tx('sd-t33', 'sd-c14','CASH',  'RETAIL',  'CASH',    30000, 0,      0,      30000,  day2,'09:00:00','Cash deposit',             'Owner', now-12*86400000+0.5*3600000),
            tx('sd-t34', 'sd-c14','CASH',  'RETAIL',  'CASH',    0,     10000,  30000,  20000,  day5,'11:00:00','Cash withdrawal',          'Staff', now-5*86400000+2*3600000),
            tx('sd-t35', 'sd-c14','GOLD',  'BULLION', 'GOLD',    15,    0,      0,      15,     day6,'14:00:00','Gold received for trade',  'Owner', now-3*86400000+5*3600000),

            // ── C15: Nalini Chits — Chit 3 installments + Silver Cash ─────────
            tx('sd-t36', 'sd-c15','CASH',  'CHIT',    'CASH',    2000,  0,      0,      2000,   day4,'10:00:00','Silver scheme install. 1', 'Staff', now-7*86400000+1*3600000,  'SILVER SCHEME'),
            tx('sd-t37', 'sd-c15','CASH',  'CHIT',    'CASH',    2000,  0,      2000,   4000,   day5,'10:00:00','Silver scheme install. 2', 'Staff', now-5*86400000+1*3600000,  'SILVER SCHEME'),
            tx('sd-t38', 'sd-c15','CASH',  'CHIT',    'CASH',    2000,  0,      4000,   6000,   day7,'10:00:00','Silver scheme install. 3', 'Staff', now-1*86400000+1*3600000,  'SILVER SCHEME'),
            tx('sd-t39', 'sd-c15','CASH',  'SILVER',  'CASH',    5000,  0,      0,      5000,   day6,'14:00:00','Silver fund payment',      'Owner', now-3*86400000+5*3600000),
        ];

        setCustomers(customers);
        setTransactions(transactions);
        return 'Dummy data loaded — 15 customers, all 16 transaction combinations seeded!';
    };

    const signOut = useCallback(() => {
        // Clear local state immediately — UI shows login screen right away, no freeze
        dbOrgId.current  = null;
        dbUserId.current = null;
        setOrgId(null);
        setAuthSession(null);
        // Invalidate server session in background (no await) — SIGNED_OUT event will fire
        // but state is already null so it becomes a safe no-op
        supabase.auth.signOut().catch(e => console.error('[Auth] signOut server error:', e));
    }, []);

    const value = {
        customers, transactions, deletedTransactions,
        authSession, setAuthSession,
        orgId,
        signOut,
        addCustomer, getCustomer, getCustomerByMobile, updateCustomer,
        addTransaction, deleteTransaction, updateCustomerDueDate,
        chitSchemes, addChitScheme, removeChitScheme,
        seedDummyData,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
