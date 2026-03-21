import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

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
    const [transactions, setTransactions] = useState(() => getInitialData('bt_transactions', []));
    const [authSession,  setAuthSession]  = useState(() => getInitialData('bt_auth', null));
    const [chitSchemes,  setChitSchemes]  = useState(() => getInitialData('bt_chit_schemes', DEFAULT_CHIT_SCHEMES));

    useEffect(() => { localStorage.setItem('bt_customers',    JSON.stringify(customers));    }, [customers]);
    useEffect(() => { localStorage.setItem('bt_transactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { localStorage.setItem('bt_auth',         JSON.stringify(authSession));  }, [authSession]);
    useEffect(() => { localStorage.setItem('bt_chit_schemes', JSON.stringify(chitSchemes));  }, [chitSchemes]);

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

        return c;
    };

    const updateCustomer = (id, updates) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const updateCustomerDueDate = (customerId, newDueDate) => {
        setCustomers(prev => prev.map(c => {
            if (c.id !== customerId) return c;
            return { ...c, due_date: newDueDate };
        }));
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

        setTransactions(prev => prev.filter(t => t.id !== id));
    };

    const seedDummyData = () => {
        const now   = Date.now();
        const day1  = new Date(now - 7 * 86400000).toISOString().split('T')[0];
        const day2  = new Date(now - 5 * 86400000).toISOString().split('T')[0];
        const day3  = new Date(now - 3 * 86400000).toISOString().split('T')[0];
        const day4  = new Date(now - 1 * 86400000).toISOString().split('T')[0];
        const today = new Date(now).toISOString().split('T')[0];
        const dueOverdue = new Date(now - 2 * 86400000).toISOString().split('T')[0];

        const customers = [
            { id: 'seed-c1', name: 'Ramesh GoldWorks',  mobile: '9876543210', primary_category: 'GOLD',  cashBalance: 15000,  goldBalance: 10.50,  silverBalance: 0,      due_date: null,        createdAt: day1 },
            { id: 'seed-c2', name: 'Sita Sharma',        mobile: '9876543211', primary_category: 'CASH',  cashBalance: -8500,  goldBalance: 0,       silverBalance: 0,      due_date: dueOverdue,  createdAt: day1 },
            { id: 'seed-c3', name: 'Mehta Jewellers',    mobile: '9123456780', primary_category: 'GOLD',  cashBalance: 0,      goldBalance: -25.00,  silverBalance: 100.00, due_date: dueOverdue,  createdAt: day2 },
            { id: 'seed-c4', name: 'Priya Silver House', mobile: '9123456781', primary_category: 'SILVER',cashBalance: 5000,   goldBalance: 0,       silverBalance: 50.75,  due_date: null,        createdAt: day2 },
            { id: 'seed-c5', name: 'Arjun Traders',      mobile: '9988776655', primary_category: 'CASH',  cashBalance: -3200,  goldBalance: 0,       silverBalance: 0,      due_date: today,       createdAt: day3 },
        ];

        const tx = (id, cid, type, category, sub_type, jama, nave, curBal, newBal, date, time, desc, addedBy, ts) => ({
            id, cid,
            type, direction: jama > 0 ? 'IN' : 'OUT',
            category, sub_type,
            metal_type: type !== 'CASH' ? type : '',
            chit_scheme: '', bill_amount: 0,
            grams: type !== 'CASH' ? (jama > 0 ? jama : nave) : 0,
            date, time,
            jama, nave,
            description: desc,
            added_by: addedBy,
            images: [], whatsapp_sent: false,
            currentBalance: curBal, newBalance: newBal,
            createdAt: ts,
        });

        const transactions = [
            // Ramesh GoldWorks
            tx('t1',  'seed-c1', 'GOLD', 'BULLION', 'GOLD',  35.00, 0,     0,      35.00, day1, '09:00:00', 'Old gold taken',     'Owner', now - 7*86400000 + 1*3600000),
            tx('t2',  'seed-c1', 'GOLD', 'BULLION', 'GOLD',  0,     15.00, 35.00,  20.00, day2, '11:30:00', 'Gold returned',      'Staff', now - 5*86400000 + 2*3600000),
            tx('t3',  'seed-c1', 'CASH', 'RETAIL',  'CASH',  20000, 0,     0,      20000, day3, '10:00:00', 'Cash deposit',       'Owner', now - 3*86400000 + 1*3600000),
            tx('t4',  'seed-c1', 'GOLD', 'BULLION', 'GOLD',  5.50,  0,     20.00,  25.50, day3, '14:00:00', 'New gold in',        'Owner', now - 3*86400000 + 5*3600000),
            tx('t5',  'seed-c1', 'CASH', 'RETAIL',  'CASH',  0,     5000,  20000,  15000, day4, '16:00:00', 'Partial withdrawal', 'Staff', now - 1*86400000 + 7*3600000),
            tx('t6',  'seed-c1', 'GOLD', 'BULLION', 'GOLD',  0,     15.00, 25.50,  10.50, day4, '16:15:00', 'Gold given back',    'Staff', now - 1*86400000 + 7*3600000 + 900000),

            // Sita Sharma
            tx('t7',  'seed-c2', 'CASH', 'RETAIL',  'CASH',  0,     15000, 0,     -15000, day1, '10:00:00', 'Advance loan',       'Owner', now - 7*86400000 + 2*3600000),
            tx('t8',  'seed-c2', 'CASH', 'RETAIL',  'CASH',  6500,  0,    -15000, -8500,  day3, '12:00:00', 'Partial payment',    'Staff', now - 3*86400000 + 3*3600000),

            // Mehta Jewellers
            tx('t9',  'seed-c3', 'GOLD', 'BULLION', 'GOLD',  0,     50.00, 0,     -50.00, day2, '09:30:00', 'Bullion supplied',   'Owner', now - 5*86400000 + 1*3600000),
            tx('t10', 'seed-c3', 'GOLD', 'BULLION', 'GOLD',  25.00, 0,    -50.00, -25.00, day3, '11:00:00', 'Return partial',     'Owner', now - 3*86400000 + 2*3600000),
            tx('t11', 'seed-c3', 'SILVER','SILVER', 'SILVER',100.00,0,     0,     100.00, day2, '10:00:00', 'Silver deposit',     'Staff', now - 5*86400000 + 2*3600000),

            // Priya Silver House
            tx('t12', 'seed-c4', 'SILVER','SILVER', 'SILVER',75.00, 0,     0,      75.00, day2, '15:00:00', 'Silver brought in',  'Owner', now - 5*86400000 + 6*3600000),
            tx('t13', 'seed-c4', 'CASH',  'RETAIL', 'CASH',  8000,  0,     0,      8000,  day3, '09:00:00', 'Cash received',      'Staff', now - 3*86400000 + 0.5*3600000),
            tx('t14', 'seed-c4', 'SILVER','SILVER', 'SILVER',0,     24.25, 75.00,  50.75, day4, '13:00:00', 'Silver returned',    'Owner', now - 1*86400000 + 4*3600000),
            tx('t15', 'seed-c4', 'CASH',  'RETAIL', 'CASH',  0,     3000,  8000,   5000,  today,'10:30:00', 'Cash paid out',      'Owner', now - 2*3600000),

            // Arjun Traders
            tx('t16', 'seed-c5', 'CASH',  'RETAIL', 'CASH',  0,     5000,  0,     -5000,  day3, '11:00:00', 'Cash advance',       'Staff', now - 3*86400000 + 3*3600000),
            tx('t17', 'seed-c5', 'CASH',  'RETAIL', 'CASH',  1800,  0,    -5000, -3200,   today,'09:15:00', 'Partial repayment',  'Owner', now - 4*3600000),
        ];

        setCustomers(customers);
        setTransactions(transactions);
        return 'Dummy data loaded successfully!';
    };

    const value = {
        customers, transactions,
        authSession, setAuthSession,
        addCustomer, getCustomer, getCustomerByMobile, updateCustomer,
        addTransaction, deleteTransaction, updateCustomerDueDate,
        chitSchemes, addChitScheme, removeChitScheme,
        seedDummyData,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
