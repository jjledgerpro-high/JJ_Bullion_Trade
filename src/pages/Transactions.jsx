import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Search, Camera, Trash2, ArrowLeft, Download, TrendingUp, TrendingDown, X, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './Transactions.css';

const fmt  = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);

// ── Category tab config ────────────────────────────────────────────────────────
const TABS = [
    { key: 'ALL',     label: 'All' },
    { key: 'RETAIL',  label: 'Retail',  subs: ['ALL', 'CASH', 'METAL'] },
    { key: 'BULLION', label: 'Bullion', subs: ['ALL', 'GOLD', 'SILVER'] },
    { key: 'SILVER',  label: 'Silver',  subs: ['ALL', 'CASH', 'METAL'] },
    { key: 'CHIT',    label: 'Chit' },
];

// sub-type sheets config per category for customer export
const EXPORT_SHEETS = {
    RETAIL:  [
        { key: 'CASH',  label: 'Cash',  isGrams: false, typeFilter: (t) => t.sub_type === 'CASH' },
        { key: 'METAL', label: 'Metal', isGrams: true,  typeFilter: (t) => t.sub_type === 'METAL' },
    ],
    BULLION: [
        { key: 'CASH',   label: 'Cash',   isGrams: false, typeFilter: (t) => t.sub_type === 'CASH' },
        { key: 'GOLD',   label: 'Gold',   isGrams: true,  typeFilter: (t) => t.type === 'GOLD' && t.sub_type !== 'CASH' },
        { key: 'SILVER', label: 'Silver', isGrams: true,  typeFilter: (t) => t.type === 'SILVER' },
    ],
    SILVER: [
        { key: 'CASH',   label: 'Cash',   isGrams: false, typeFilter: (t) => t.sub_type === 'CASH' },
        { key: 'SILVER', label: 'Silver', isGrams: true,  typeFilter: (t) => t.sub_type === 'SILVER' || t.sub_type === 'METAL' },
    ],
    CHIT: [
        { key: 'CASH', label: 'Cash', isGrams: false, typeFilter: () => true },
    ],
};

const matchesTab = (t, tab, sub) => {
    if (tab === 'ALL') return true;
    if (t.category !== tab) return false;
    if (!sub || sub === 'ALL') return true;
    return (t.sub_type || '').toUpperCase() === sub;
};

const txAmount = (t) => {
    const isGrams = t.category === 'BULLION';
    const val = t.jama > 0 ? t.jama : t.nave;
    return isGrams ? `${fmtG(val)}g` : `₹${fmt(val)}`;
};

const balFmt = (t) => {
    const isGrams = t.category === 'BULLION';
    return isGrams ? (v) => `${fmtG(v)}g` : (v) => `₹${fmt(v)}`;
};

// ── Build customer statement sheets ───────────────────────────────────────────
const buildCustomerSheets = (custTxs, categories) => {
    const sheets = [];

    categories.forEach(catKey => {
        const catTxs = custTxs.filter(t => t.category === catKey);
        if (catTxs.length === 0) return;

        const sheetDefs = EXPORT_SHEETS[catKey] || [];
        sheetDefs.forEach(({ key, label, isGrams, typeFilter }) => {
            const rows = catTxs
                .filter(typeFilter)
                .sort((a, b) => a.createdAt - b.createdAt);

            if (rows.length === 0) return;

            // Compute running balance
            let running = 0;
            const unit  = isGrams ? 'g' : '₹';
            const gotH  = isGrams ? `You GOT (${unit})` : `You GOT (${unit})`;
            const gaveH = isGrams ? `You GAVE (${unit})` : `You GAVE (${unit})`;
            const balH  = `Balance (${unit})`;

            const data = rows.map(t => {
                const got  = parseFloat(t.jama || 0);
                const gave = parseFloat(t.nave || 0);
                running += got - gave;
                const row = {
                    'Date':     t.date,
                    'Time':     t.time ? t.time.substring(0, 5) : '',
                    [gotH]:     got  > 0 ? (isGrams ? fmtG(got)  : fmt(got))  : '',
                    [gaveH]:    gave > 0 ? (isGrams ? fmtG(gave) : fmt(gave)) : '',
                    [balH]:     isGrams ? fmtG(running) : fmt(running),
                    'Note':     t.description || '',
                };
                if (!isGrams && t.bill_amount > 0) row['Bill Amount (₹)'] = fmt(t.bill_amount);
                if (catKey === 'CHIT' && t.chit_scheme) row['Scheme'] = t.chit_scheme;
                return row;
            });

            // Summary row
            const totalGot  = rows.reduce((s, t) => s + parseFloat(t.jama || 0), 0);
            const totalGave = rows.reduce((s, t) => s + parseFloat(t.nave || 0), 0);
            const net       = totalGot - totalGave;
            data.push({
                'Date': 'TOTAL',
                'Time': '',
                [gotH]:  isGrams ? fmtG(totalGot)  : fmt(totalGot),
                [gaveH]: isGrams ? fmtG(totalGave) : fmt(totalGave),
                [balH]:  isGrams ? fmtG(net)       : fmt(net),
                'Note':  '',
            });

            sheets.push({ name: `${catKey} · ${label}`, data });
        });
    });

    return sheets;
};

// ── Component ─────────────────────────────────────────────────────────────────
const Transactions = () => {
    const { transactions, customers, deleteTransaction, authSession } = useAppContext();
    const navigate = useNavigate();

    const [searchQ,    setSearchQ]    = useState('');
    const [activeTab,  setActiveTab]  = useState('ALL');
    const [activeSub,  setActiveSub]  = useState('ALL');
    const [custFilter, setCustFilter] = useState(null);   // {id, name} or null
    const [custSearch, setCustSearch] = useState('');
    const [showCustDD, setShowCustDD] = useState(false);
    const custRef = useRef(null);

    const isOwner = authSession?.role === 'owner' || authSession?.role === 'super-admin';

    // Close customer dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (custRef.current && !custRef.current.contains(e.target)) setShowCustDD(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Enrich transactions
    const enriched = useMemo(() =>
        transactions.map(t => {
            const c = customers.find(x => x.id === t.cid);
            return { ...t, customerName: c?.name || 'Unknown', customerMobile: c?.mobile || '' };
        }),
    [transactions, customers]);

    // Customer dropdown suggestions
    const custSuggestions = useMemo(() => {
        if (!custSearch) return customers.slice(0, 8);
        const q = custSearch.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.mobile || '').includes(q)
        ).slice(0, 8);
    }, [customers, custSearch]);

    // Filter
    const filtered = useMemo(() => {
        let list = enriched.filter(t => matchesTab(t, activeTab, activeSub));
        if (custFilter) list = list.filter(t => t.cid === custFilter.id);
        if (searchQ) {
            const q = searchQ.toLowerCase();
            list = list.filter(t =>
                t.customerName.toLowerCase().includes(q) ||
                t.customerMobile.includes(q) ||
                (t.description || '').toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => a.createdAt - b.createdAt);
    }, [enriched, activeTab, activeSub, custFilter, searchQ]);

    // Stats
    const tabStats = useMemo(() => {
        const base = enriched.filter(t => {
            if (!matchesTab(t, activeTab, activeSub)) return false;
            if (custFilter && t.cid !== custFilter.id) return false;
            return true;
        });
        let cashIn = 0, cashOut = 0, gramsIn = 0, gramsOut = 0;

        base.forEach(t => {
            const isGrams = t.category === 'BULLION';
            const isIn    = t.jama > 0;
            const val     = isIn ? parseFloat(t.jama) : parseFloat(t.nave);
            if (isGrams) { isIn ? (gramsIn += val) : (gramsOut += val); }
            else         { isIn ? (cashIn  += val) : (cashOut  += val); }
        });

        const retailGoldIn   = base.filter(t => t.category === 'RETAIL'  && t.sub_type === 'METAL' && t.jama > 0).reduce((s, t) => s + parseFloat(t.grams || 0), 0);
        const bullionGoldIn  = base.filter(t => t.category === 'BULLION' && t.type === 'GOLD'   && t.jama > 0).reduce((s, t) => s + parseFloat(t.jama), 0);
        const bullionSilvIn  = base.filter(t => t.category === 'BULLION' && t.type === 'SILVER' && t.jama > 0).reduce((s, t) => s + parseFloat(t.jama), 0);

        return { cashIn, cashOut, gramsIn, gramsOut, retailGoldIn, bullionGoldIn, bullionSilvIn };
    }, [enriched, activeTab, activeSub, custFilter]);

    // ── Global Export ──────────────────────────────────────────────────────────
    const handleGlobalExport = () => {
        const today = new Date().toISOString().slice(0, 10);
        const rupeeTxs = enriched.filter(t => t.category !== 'BULLION');
        const sheet1 = rupeeTxs.map(t => ({
            'Date': t.date, 'Time': t.time, 'Category': t.category || '',
            'Sub-type': t.sub_type || '', 'Chit Scheme': t.chit_scheme || '',
            'Customer': t.customerName, 'Mobile': t.customerMobile,
            'YOU GOT (₹)': t.jama > 0 ? fmt(t.jama) : '',
            'YOU GAVE (₹)': t.nave > 0 ? fmt(t.nave) : '',
            'Bill Amount (₹)': t.bill_amount ? fmt(t.bill_amount) : '',
            'Grams': t.grams ? fmtG(t.grams) : '',
            'Description': t.description || '', 'Added By': t.added_by || '',
            'Curr Balance': t.currentBalance !== undefined ? fmt(t.currentBalance) : '',
            'New Balance':  t.newBalance     !== undefined ? fmt(t.newBalance)     : '',
        }));

        const gramsTxs = enriched.filter(t =>
            t.category === 'BULLION' ||
            ((t.category === 'RETAIL' || t.category === 'SILVER') && t.sub_type === 'METAL')
        );
        const sheet2 = gramsTxs.map(t => ({
            'Date': t.date, 'Time': t.time, 'Category': t.category || '',
            'Metal Type': t.metal_type || (t.type === 'GOLD' ? 'GOLD' : t.type === 'SILVER' ? 'SILVER' : ''),
            'Customer': t.customerName, 'Mobile': t.customerMobile,
            'YOU GOT (g)': t.jama > 0 ? fmtG(t.jama) : '',
            'YOU GAVE (g)': t.nave > 0 ? fmtG(t.nave) : '',
            'Bill Amount (₹)': t.bill_amount ? fmt(t.bill_amount) : '',
            'Description': t.description || '', 'Added By': t.added_by || '',
        }));

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(sheet1);
        XLSX.utils.book_append_sheet(wb, ws1, 'Rupee Transactions');
        const ws2 = XLSX.utils.json_to_sheet(sheet2);
        XLSX.utils.book_append_sheet(wb, ws2, 'Gold-Silver Grams');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/octet-stream' }), `JJ_Ledger_${today}.xlsx`);
    };

    // ── Customer Statement Export ──────────────────────────────────────────────
    const handleCustomerExport = () => {
        if (!custFilter) return;
        const today = new Date().toISOString().slice(0, 10);
        const custTxs = enriched
            .filter(t => t.cid === custFilter.id)
            .sort((a, b) => a.createdAt - b.createdAt);

        // Decide which categories to export
        const cats = activeTab === 'ALL'
            ? ['RETAIL', 'BULLION', 'SILVER', 'CHIT']
            : [activeTab];

        const sheetDefs = buildCustomerSheets(custTxs, cats);

        if (sheetDefs.length === 0) {
            alert('No transactions found for this customer.');
            return;
        }

        const wb = XLSX.utils.book_new();
        sheetDefs.forEach(({ name, data }) => {
            const ws = XLSX.utils.json_to_sheet(data);
            // Bold the last (total) row by setting a wide col
            ws['!cols'] = [{ wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 14 }];
            XLSX.utils.book_append_sheet(wb, ws, name);
        });

        const safeName = custFilter.name.replace(/[^a-z0-9]/gi, '_');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Statement_${safeName}_${today}.xlsx`);
    };

    const handleDelete = (id) => {
        if (window.confirm('Delete this transaction? The balance change will be reversed.')) {
            deleteTransaction(id);
        }
    };

    const handleTabChange = (tab) => { setActiveTab(tab); setActiveSub('ALL'); };

    const selectCustomer = (c) => {
        setCustFilter({ id: c.id, name: c.name });
        setCustSearch('');
        setShowCustDD(false);
    };

    const clearCustFilter = () => { setCustFilter(null); setCustSearch(''); };

    const currentTab = TABS.find(t => t.key === activeTab);

    return (
        <div className="tx-container animate-fade-in" style={{ paddingBottom: '90px' }}>

            {/* Header */}
            <div className="tx-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ margin: 0 }}>
                            Global Ledger
                            {custFilter && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#22c55e', marginLeft: '0.5rem' }}>
                                    · {custFilter.name}
                                </span>
                            )}
                        </h2>
                        <p style={{ margin: 0 }}>{filtered.length} of {transactions.length} transactions</p>
                    </div>
                </div>

                {/* Export button — switches based on custFilter */}
                {custFilter ? (
                    <button
                        onClick={handleCustomerExport}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.5rem 1rem', background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.35)', borderRadius: '8px',
                            color: '#a5b4fc', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        }}
                    >
                        <Download size={16} /> Export Statement
                    </button>
                ) : (
                    <button
                        onClick={handleGlobalExport}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.15)',
                            border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px',
                            color: '#10b981', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                        }}
                    >
                        <Download size={16} /> Export
                    </button>
                )}
            </div>

            {/* Category Tabs */}
            <div className="tx-cat-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`tx-cat-tab ${activeTab === tab.key ? `tx-cat-active-${tab.key.toLowerCase()}` : ''}`}
                        onClick={() => handleTabChange(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-type pills */}
            {currentTab?.subs && (
                <div className="tx-sub-pills">
                    {currentTab.subs.map(s => (
                        <button
                            key={s}
                            className={`tx-sub-pill ${activeSub === s ? 'tx-sub-active' : ''}`}
                            onClick={() => setActiveSub(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats bar */}
            <div className="tx-stats-bar glass-panel">
                <div className="tx-stat">
                    <span className="tx-stat-label">Entries</span>
                    <span className="tx-stat-val">{filtered.length}</span>
                </div>
                {activeTab !== 'BULLION' && (
                    <>
                        <div className="tx-stat">
                            <span className="tx-stat-label">You Got (₹)</span>
                            <span className="tx-stat-val text-green">₹{fmt(tabStats.cashIn)}</span>
                        </div>
                        <div className="tx-stat">
                            <span className="tx-stat-label">You Gave (₹)</span>
                            <span className="tx-stat-val text-red">₹{fmt(tabStats.cashOut)}</span>
                        </div>
                    </>
                )}
                {(activeTab === 'BULLION' || activeTab === 'ALL') && (
                    <>
                        <div className="tx-stat">
                            <span className="tx-stat-label">Bullion Got (g)</span>
                            <span className="tx-stat-val" style={{ color: '#eab308' }}>{fmtG(tabStats.gramsIn)}g</span>
                        </div>
                        <div className="tx-stat">
                            <span className="tx-stat-label">Bullion Gave (g)</span>
                            <span className="tx-stat-val text-red">{fmtG(tabStats.gramsOut)}g</span>
                        </div>
                    </>
                )}
            </div>

            {/* Filters */}
            <div className="tx-filters glass-panel">

                {/* Customer filter */}
                <div ref={custRef} style={{ position: 'relative' }}>
                    {custFilter ? (
                        <div className="tx-cust-chip">
                            <User size={13} />
                            <span>{custFilter.name}</span>
                            <button onClick={clearCustFilter} className="tx-cust-chip-x"><X size={12} /></button>
                        </div>
                    ) : (
                        <div
                            className={`search-bar tx-cust-search ${showCustDD ? 'focused' : ''}`}
                            style={{ marginBottom: 0 }}
                        >
                            <User size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder="Filter by customer..."
                                value={custSearch}
                                onChange={e => { setCustSearch(e.target.value); setShowCustDD(true); }}
                                onFocus={() => setShowCustDD(true)}
                            />
                        </div>
                    )}

                    {showCustDD && !custFilter && (
                        <div className="tx-cust-dropdown glass-panel">
                            {custSuggestions.length === 0 ? (
                                <div className="tx-cust-dd-empty">No customers found</div>
                            ) : custSuggestions.map(c => (
                                <button
                                    key={c.id}
                                    className="tx-cust-dd-row"
                                    onMouseDown={e => { e.preventDefault(); selectCustomer(c); }}
                                >
                                    <span className="tx-cust-dd-name">{c.name}</span>
                                    <span className="tx-cust-dd-mob">{c.mobile}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Text search */}
                <div className="search-bar">
                    <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="Search by name, mobile, note..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                </div>
            </div>

            {/* Table — only shown when a customer is selected */}
            {!custFilter && (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select a customer above to view their transactions</div>
                </div>
            )}
            {custFilter && <div className="table-container glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>Date / Time</th>
                            <th>Dir</th>
                            <th>Category</th>
                            <th>Customer</th>
                            <th>Amount</th>
                            {activeTab !== 'BULLION' && <th>Grams</th>}
                            <th>Curr Bal</th>
                            <th>New Bal</th>
                            <th>By</th>
                            {isOwner && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={isOwner ? 10 : 9} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                    No transactions found.
                                </td>
                            </tr>
                        ) : filtered.map(t => {
                            const isGot    = t.jama > 0;
                            const isGrams  = t.category === 'BULLION';
                            const bFmt     = balFmt(t);
                            const catLabel = [t.category, t.sub_type].filter(Boolean).join(' · ');
                            const schemeTag = t.chit_scheme ? ` (${t.chit_scheme})` : '';
                            const metalTag  = t.metal_type  ? ` ${t.metal_type}` : '';

                            return (
                                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${t.cid}`)}>
                                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                        {t.date}<br />
                                        <span style={{ fontSize: '0.7rem' }}>{t.time ? t.time.substring(0, 5) : ''}</span>
                                    </td>
                                    <td>
                                        <span className={`dash-dir-badge ${isGot ? 'dash-dir-got' : 'dash-dir-gave'}`}>
                                            {isGot ? <><TrendingUp size={10} /> GOT</> : <><TrendingDown size={10} /> GAVE</>}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`tb-badge tb-${(t.category || t.type || '').toLowerCase()}`}>
                                            {catLabel || t.type}{metalTag}{schemeTag}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                        {t.customerName}
                                        {t.description && (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                {t.description}
                                            </div>
                                        )}
                                        {t.images?.length > 0 && (
                                            <Camera size={11} style={{ marginLeft: '4px', color: '#60a5fa', verticalAlign: '-1px' }} />
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 700, color: isGot ? '#10b981' : '#ef4444', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                                        {isGot ? '+' : '−'}{txAmount(t)}
                                        {!isGrams && t.bill_amount > 0 && (
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                Bill ₹{fmt(t.bill_amount)}
                                            </div>
                                        )}
                                    </td>
                                    {activeTab !== 'BULLION' && (
                                        <td style={{ fontSize: '0.82rem', color: '#eab308' }}>
                                            {t.grams ? `${fmtG(t.grams)}g` : '—'}
                                        </td>
                                    )}
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                        {t.currentBalance !== undefined ? bFmt(t.currentBalance) : '—'}
                                    </td>
                                    <td style={{ fontWeight: 600, color: (t.newBalance ?? 0) >= 0 ? '#10b981' : '#ef4444', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        {t.newBalance !== undefined ? bFmt(t.newBalance) : '—'}
                                    </td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t.added_by || '—'}
                                    </td>
                                    {isOwner && (
                                        <td onClick={e => e.stopPropagation()}>
                                            <button className="btn-delete-icon" onClick={() => handleDelete(t.id)} title="Delete">
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>}
        </div>
    );
};

export default Transactions;
