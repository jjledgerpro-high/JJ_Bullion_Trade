import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './AddTransactionPage.css';

/* ── Config ──────────────────────────────────────────────────────────────── */
const CATEGORIES = [
    {
        key: 'RETAIL', label: 'Retail', emoji: '🏪',
        desc: 'Cash & metal transactions',
        color: '#6366f1', dim: 'rgba(99,102,241,0.15)', glow: 'rgba(99,102,241,0.35)',
    },
    {
        key: 'BULLION', label: 'Bullion', emoji: '🥇',
        desc: 'Gold & silver bullion trading',
        color: '#f59e0b', dim: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.35)',
    },
    {
        key: 'SILVER', label: 'Silver', emoji: '🥈',
        desc: 'Cash & silver transactions',
        color: '#94a3b8', dim: 'rgba(148,163,184,0.15)', glow: 'rgba(148,163,184,0.35)',
    },
    {
        key: 'CHIT', label: 'Chit', emoji: '📋',
        desc: 'Chit fund & scheme installments',
        color: '#10b981', dim: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.35)',
    },
];

// sub_type → display label, balance type, input unit
const SUBTYPES = {
    RETAIL: [
        { key: 'CASH',  label: 'Cash',  type: 'CASH',   unit: '₹',   isGrams: false },
        { key: 'METAL', label: 'Metal', type: 'GOLD',   unit: 'g',   isGrams: true, hasBill: true },
    ],
    BULLION: [
        { key: 'CASH',   label: 'Cash',   type: 'CASH',   unit: '₹', isGrams: false },
        { key: 'GOLD',   label: 'Gold',   type: 'GOLD',   unit: 'g', isGrams: true },
        { key: 'SILVER', label: 'Silver', type: 'SILVER', unit: 'g', isGrams: true },
    ],
    SILVER: [
        { key: 'CASH',   label: 'Cash',   type: 'CASH',   unit: '₹', isGrams: false },
        { key: 'SILVER', label: 'Silver', type: 'SILVER', unit: 'g', isGrams: true },
    ],
    CHIT: [
        { key: 'CASH', label: 'Cash', type: 'CASH', unit: '₹', isGrams: false },
    ],
};

const fmt  = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtG = (v) => parseFloat(v || 0).toFixed(3);
const n    = (v) => parseFloat(v || 0);

/* ── Helper: balance label ────────────────────────────────────────────────── */
const getBalance = (customer, type) => {
    if (!customer) return 0;
    if (type === 'CASH')   return n(customer.cashBalance);
    if (type === 'GOLD')   return n(customer.goldBalance);
    if (type === 'SILVER') return n(customer.silverBalance);
    return 0;
};

const fmtBal = (val, isGrams) =>
    isGrams ? `${fmtG(val)}g` : `₹${fmt(val)}`;

/* ─────────────────────────────────────────────────────────────────────────── */

const AddTransactionPage = () => {
    const { customers, chitSchemes, addTransaction, authSession } = useAppContext();
    const navigate = useNavigate();

    const [step,     setStep]     = useState(1);   // 1 | 2 | 3
    const [category, setCategory] = useState(null);
    const [customer, setCustomer] = useState(null);

    // Step 2
    const [searchQ, setSearchQ] = useState('');

    // Step 3 form
    const [op,          setOp]          = useState('got');
    const [subType,     setSubType]     = useState('CASH');
    const [scheme,      setScheme]      = useState('');
    const [amount,      setAmount]      = useState('');
    const [billAmount,  setBillAmount]  = useState('');
    const [date,        setDate]        = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [saved,       setSaved]       = useState(false);
    const [saving,      setSaving]      = useState(false);

    /* ── Derived ── */
    const catCfg   = CATEGORIES.find(c => c.key === category);
    const subtypes = category ? SUBTYPES[category] : [];
    const subCfg   = subtypes.find(s => s.key === subType) || subtypes[0];
    const isChit   = category === 'CHIT';

    const prevBalance = useMemo(() => getBalance(customer, subCfg?.type), [customer, subCfg]);
    const delta       = useMemo(() => {
        const val = n(amount);
        return op === 'got' ? val : -val;
    }, [amount, op]);
    const newBalance  = prevBalance + delta;

    /* ── Filtered customers ── */
    const filteredCusts = useMemo(() => {
        const q = searchQ.toLowerCase();
        if (!q) return customers;
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.mobile || '').includes(q)
        );
    }, [customers, searchQ]);

    /* ── Navigation helpers ── */
    const goCategory = (cat) => {
        setCategory(cat);
        setSubType(SUBTYPES[cat][0].key);
        setStep(2);
    };

    const goCustomer = (c) => {
        setCustomer(c);
        setStep(3);
        setSearchQ('');
    };

    const handleBack = () => {
        if (step === 3) { setCustomer(null); resetForm(); setStep(2); }
        else if (step === 2) { setCategory(null); setStep(1); }
        else navigate('/');
    };

    const resetForm = () => {
        setOp('got'); setAmount(''); setBillAmount('');
        setDescription(''); setSaved(false); setSaving(false);
        setScheme('');
    };

    /* ── Save ── */
    const canSave = n(amount) > 0 && (!isChit || scheme);

    const handleSave = () => {
        if (!canSave) return;
        setSaving(true);

        const val  = n(amount);
        const jama = op === 'got'  ? val : 0;
        const nave = op === 'gave' ? val : 0;

        addTransaction({
            customerId:  customer.id,
            type:        subCfg.type,
            category,
            sub_type:    subType,
            jama,
            nave,
            grams:       subCfg.isGrams ? val : 0,
            bill_amount: n(billAmount),
            date,
            time:        new Date().toTimeString().split(' ')[0],
            description,
            chit_scheme: isChit ? scheme : '',
            added_by:    authSession?.role || 'Staff',
        });

        setSaved(true);
        setTimeout(() => {
            // Stay on customer — let user add another
            resetForm();
            setSaved(false);
        }, 1000);
    };

    /* ── Step 1: Category ── */
    if (step === 1) return (
        <div className="atp-page animate-fade-in">
            <div className="atp-top-bar">
                <button className="atp-back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="atp-page-title">Add Transaction</h2>
                    <p className="atp-page-sub">Select a category to begin</p>
                </div>
            </div>

            <div className="atp-cat-grid">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        className="atp-cat-card"
                        style={{ '--cat-c': cat.color, '--cat-dim': cat.dim, '--cat-glow': cat.glow }}
                        onClick={() => goCategory(cat.key)}
                    >
                        <span className="atp-cat-emoji">{cat.emoji}</span>
                        <span className="atp-cat-name">{cat.label}</span>
                        <span className="atp-cat-desc">{cat.desc}</span>
                        <ChevronRight size={16} className="atp-cat-arrow" />
                    </button>
                ))}
            </div>
        </div>
    );

    /* ── Step 2: Customer ── */
    if (step === 2) return (
        <div className="atp-page animate-fade-in">
            <div className="atp-top-bar">
                <button className="atp-back-btn" onClick={handleBack}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h2 className="atp-page-title" style={{ color: catCfg?.color }}>
                        {catCfg?.emoji} {catCfg?.label}
                    </h2>
                    <p className="atp-page-sub">Select customer</p>
                </div>
            </div>

            <div className="search-bar" style={{ marginBottom: '1rem' }}>
                <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                    type="text"
                    placeholder="Search by name or mobile..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="atp-cust-list">
                {filteredCusts.length === 0 ? (
                    <div className="atp-empty">No customers found.</div>
                ) : filteredCusts.map(c => (
                    <button key={c.id} className="atp-cust-row" onClick={() => goCustomer(c)}>
                        <div className="atp-cust-info">
                            <span className="atp-cust-name">{c.name}</span>
                            <span className="atp-cust-mobile">{c.mobile}</span>
                        </div>
                        <div className="atp-cust-bals">
                            {n(c.cashBalance) !== 0 && (
                                <span className={`atp-bal-chip ${n(c.cashBalance) >= 0 ? 'green' : 'red'}`}>
                                    ₹{fmt(c.cashBalance)}
                                </span>
                            )}
                            {n(c.goldBalance) !== 0 && (
                                <span className="atp-bal-chip gold">
                                    {fmtG(c.goldBalance)}g Au
                                </span>
                            )}
                            {n(c.silverBalance) !== 0 && (
                                <span className="atp-bal-chip silver">
                                    {fmtG(c.silverBalance)}g Ag
                                </span>
                            )}
                        </div>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                ))}
            </div>
        </div>
    );

    /* ── Step 3: Form ── */
    return (
        <div className="atp-page animate-fade-in">
            {/* Header */}
            <div className="atp-top-bar">
                <button className="atp-back-btn" onClick={handleBack}>
                    <ArrowLeft size={18} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className="atp-page-title" style={{ color: catCfg?.color }}>
                        {catCfg?.emoji} {catCfg?.label}
                    </h2>
                    <p className="atp-page-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {customer.name} · {customer.mobile}
                    </p>
                </div>
            </div>

            <div className="atp-form-card">

                {/* You Got / You Gave */}
                <div className="atp-op-tabs">
                    <button
                        className={`atp-op-tab ${op === 'got' ? 'atp-op-got' : ''}`}
                        onClick={() => setOp('got')}
                    >
                        <span className="atp-op-main">YOU GOT</span>
                        <span className="atp-op-sub">Customer paid you</span>
                    </button>
                    <button
                        className={`atp-op-tab ${op === 'gave' ? 'atp-op-gave' : ''}`}
                        onClick={() => setOp('gave')}
                    >
                        <span className="atp-op-main">YOU GAVE</span>
                        <span className="atp-op-sub">You paid customer</span>
                    </button>
                </div>

                {/* Sub-type pills */}
                {subtypes.length > 1 && (
                    <div className="atp-form-section">
                        <label className="atp-label">Type</label>
                        <div className="atp-sub-pills">
                            {subtypes.map(s => (
                                <button
                                    key={s.key}
                                    className={`atp-sub-pill ${subType === s.key ? 'atp-sub-active' : ''}`}
                                    style={subType === s.key ? { '--cat-c': catCfg?.color, '--cat-dim': catCfg?.dim } : {}}
                                    onClick={() => { setSubType(s.key); setAmount(''); setBillAmount(''); }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Chit scheme */}
                {isChit && (
                    <div className="atp-form-section">
                        <label className="atp-label">Scheme</label>
                        <div className="atp-scheme-pills">
                            {chitSchemes.map(s => (
                                <button
                                    key={s}
                                    className={`atp-scheme-pill ${scheme === s ? 'atp-scheme-active' : ''}`}
                                    onClick={() => setScheme(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Amount input */}
                <div className="atp-form-section">
                    <label className="atp-label">
                        {subCfg?.isGrams ? 'Weight (grams)' : 'Amount (₹)'}
                    </label>
                    <div className="atp-input-wrap">
                        {!subCfg?.isGrams && (
                            <span className="atp-unit-badge atp-badge-rs">₹</span>
                        )}
                        <input
                            type="number"
                            inputMode="decimal"
                            placeholder={subCfg?.isGrams ? '0.000' : '0.00'}
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="atp-amount-input"
                        />
                        {subCfg?.isGrams && (
                            <span className="atp-unit-badge atp-badge-g">g</span>
                        )}
                    </div>
                </div>

                {/* Bill amount — only for RETAIL METAL */}
                {subCfg?.hasBill && (
                    <div className="atp-form-section">
                        <label className="atp-label">Bill Amount (₹) <span style={{ fontWeight: 400, textTransform: 'none' }}>optional</span></label>
                        <div className="atp-input-wrap">
                            <span className="atp-unit-badge atp-badge-rs">₹</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={billAmount}
                                onChange={e => setBillAmount(e.target.value)}
                                className="atp-amount-input"
                            />
                        </div>
                    </div>
                )}

                {/* Balance bar */}
                {subCfg && n(amount) > 0 && (
                    <div className="atp-balance-bar">
                        <div className="atp-bal-col">
                            <span className="atp-bal-label">Current</span>
                            <span className="atp-bal-val">{fmtBal(prevBalance, subCfg.isGrams)}</span>
                        </div>
                        <div className="atp-bal-arrow">
                            <span className={`atp-delta-chip ${delta >= 0 ? 'up' : 'down'}`}>
                                {delta >= 0 ? '+' : ''}{fmtBal(delta, subCfg.isGrams)}
                            </span>
                        </div>
                        <div className="atp-bal-col atp-bal-right">
                            <span className="atp-bal-label">New Balance</span>
                            <span className={`atp-new-bal ${newBalance >= 0 ? 'green' : 'red'}`}>
                                {fmtBal(newBalance, subCfg.isGrams)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Date */}
                <div className="atp-form-section">
                    <label className="atp-label">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="atp-date-input"
                    />
                </div>

                {/* Description */}
                <div className="atp-form-section">
                    <label className="atp-label">Note <span style={{ fontWeight: 400, textTransform: 'none' }}>optional</span></label>
                    <input
                        type="text"
                        placeholder="Add a note..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="atp-text-input"
                    />
                </div>

                {/* Save button */}
                <button
                    className={`atp-save-btn ${saved ? 'atp-saved' : ''}`}
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    style={{ '--cat-c': catCfg?.color, '--cat-glow': catCfg?.glow }}
                >
                    {saved ? (
                        <><CheckCircle2 size={18} /> Saved!</>
                    ) : (
                        `Save Transaction`
                    )}
                </button>

            </div>
        </div>
    );
};

export default AddTransactionPage;
