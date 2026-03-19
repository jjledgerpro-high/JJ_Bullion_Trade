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

export const STORAGE_KEYS = [
    'bt_customers', 'bt_transactions', 'bt_auth', 'bt_chit_schemes'
];

const DEFAULT_CHIT_SCHEMES = ['CHIT', 'DIWALI FUND', 'GOLD SCHEME', 'SILVER SCHEME', 'MONTHLY SCHEME'];

export const AppProvider = ({ children }) => {
    const [customers,    setCustomers]    = useState(() => getInitialData('bt_customers', []));
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

                initialTxs.push({
                    id: newId(),
                    cid: cId,
                    type: type,
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

                if (type === 'CASH') c.cashBalance = initialVal;
                if (type === 'GOLD') c.goldBalance = initialVal;
                if (type === 'SILVER') c.silverBalance = initialVal;
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

    const _updateBalances = (customerId, { cash = 0, gold = 0, silver = 0 }) => {
        setCustomers(prev => prev.map(c => {
            if (c.id !== customerId) return c;
            return {
                ...c,
                cashBalance: parseFloat((n(c.cashBalance) + cash).toFixed(3)),
                goldBalance: parseFloat((n(c.goldBalance) + gold).toFixed(3)),
                silverBalance: parseFloat((n(c.silverBalance) + silver).toFixed(3)),
            };
        }));
    };

    const addTransaction = (data) => {
        const c = customers.find(x => x.id === data.customerId);
        let prevBal = 0;

        if (data.type === 'CASH') prevBal = n(c?.cashBalance);
        else if (data.type === 'GOLD') prevBal = n(c?.goldBalance);
        else if (data.type === 'SILVER') prevBal = n(c?.silverBalance);

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

        _updateBalances(tx.cid, { cash: cashDelta, gold: goldDelta, silver: silverDelta });

        setTransactions(prev => prev.filter(t => t.id !== id));
    };

    const seedDummyData = () => {
        const d2 = new Date(Date.now() - 86400000).toISOString();
        const d3 = new Date(Date.now() - 172800000).toISOString();

        setCustomers([
            { id: 'seed-1', name: 'Ramesh GoldWorks', mobile: '9876543210', primary_category: 'GOLD', cashBalance: 0, goldBalance: 25.5, silverBalance: 0, createdAt: d3 },
            { id: 'seed-2', name: 'Sita Sharma', mobile: '9876543211', primary_category: 'CASH', cashBalance: -10000, goldBalance: 0, silverBalance: 0, due_date: d2, createdAt: d2 },
        ]);
        setTransactions([
            { id: 't1', cid: 'seed-1', type: 'GOLD', date: d3.split('T')[0], time: '10:00:00', jama: 25.5, nave: 0, description: 'Initial deposit', added_by: 'Owner', images: [], whatsapp_sent: false, createdAt: Date.now() - 172800000 },
            { id: 't2', cid: 'seed-2', type: 'CASH', date: d2.split('T')[0], time: '14:30:00', jama: 0, nave: 10000, description: 'Cash advance', added_by: 'Owner', images: [], whatsapp_sent: false, createdAt: Date.now() - 86400000 },
        ]);
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
