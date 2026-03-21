import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Phone, CheckSquare, Square, AlertTriangle, Send, ArrowLeft, CalendarDays, User, X, Clock } from 'lucide-react';
import './DuePage.css';

const fmt  = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);
const n    = (v) => parseFloat(v || 0);

const getDaysFromToday = (dueDateStr) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr).setHours(0, 0, 0, 0);
    const now = new Date().setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
};

const StatusBadge = ({ days }) => {
    if (days === null) return null;
    if (days < 0)  return <span className="overdue-badge status-red"><AlertTriangle size={11} style={{ marginRight: 3, verticalAlign: -2 }} />{Math.abs(days)}d overdue</span>;
    if (days === 0) return <span className="overdue-badge status-yellow"><Clock size={11} style={{ marginRight: 3, verticalAlign: -2 }} />Due today</span>;
    if (days <= 7)  return <span className="overdue-badge status-yellow"><Clock size={11} style={{ marginRight: 3, verticalAlign: -2 }} />In {days}d</span>;
    return <span className="overdue-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}><Clock size={11} style={{ marginRight: 3, verticalAlign: -2 }} />In {days}d</span>;
};

const DuePage = () => {
    const { customers, updateCustomerDueDate } = useAppContext();
    const navigate = useNavigate();

    const [viewMode,    setViewMode]    = useState('customer');
    const [custFilter,  setCustFilter]  = useState(null);
    const [custSearch,  setCustSearch]  = useState('');
    const [showCustDD,  setShowCustDD]  = useState(false);
    const [globalFilter, setGlobalFilter] = useState('ALL');
    const [excludedIds, setExcludedIds] = useState(new Set());
    const [extendId,    setExtendId]    = useState(null);
    const [extendDate,  setExtendDate]  = useState('');
    const custRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (custRef.current && !custRef.current.contains(e.target)) setShowCustDD(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Customer dropdown suggestions
    const custSuggestions = useMemo(() => {
        if (!custSearch) return customers.filter(c => c.due_date).slice(0, 8);
        const q = custSearch.toLowerCase();
        return customers.filter(c =>
            (c.name.toLowerCase().includes(q) || (c.mobile || '').includes(q))
        ).slice(0, 8);
    }, [customers, custSearch]);

    // Global list — all customers with a due_date, filtered by direction
    const globalList = useMemo(() => {
        return customers
            .filter(c => {
                if (!c.due_date) return false;
                const cash = n(c.cashBalance), gold = n(c.goldBalance), silver = n(c.silverBalance);
                if (globalFilter === 'YOU_GAVE') return cash < 0 || gold < 0 || silver < 0;
                if (globalFilter === 'YOU_GOT')  return cash > 0 || gold > 0 || silver > 0;
                return cash !== 0 || gold !== 0 || silver !== 0;
            })
            .map(c => ({ ...c, days: getDaysFromToday(c.due_date) }))
            .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    }, [customers, globalFilter]);

    const selectedCustomer = custFilter ? customers.find(c => c.id === custFilter.id) : null;

    const getWhatsAppUrl = (c) => {
        const cashStr   = n(c.cashBalance)   < 0 ? `₹${fmt(Math.abs(n(c.cashBalance)))}` : '';
        const goldStr   = n(c.goldBalance)   < 0 ? `${fmtG(Math.abs(n(c.goldBalance)))}g gold` : '';
        const silverStr = n(c.silverBalance) < 0 ? `${fmtG(Math.abs(n(c.silverBalance)))}g silver` : '';
        const bals = [cashStr, goldStr, silverStr].filter(Boolean).join(' / ');
        const dueDateStr = c.due_date ? new Date(c.due_date).toLocaleDateString('en-IN') : 'N/A';
        const text = `Dear ${c.name},\nThis is a gentle reminder that your outstanding balance with JJ Jewellers is: ${bals}.\nKindly settle the same at your earliest convenience.\nDue Date: ${dueDateStr}\n— JJ Jewellers`;
        let mobile = c.mobile;
        if (!mobile.startsWith('91')) mobile = '91' + mobile;
        return `https://wa.me/${mobile}?text=${encodeURIComponent(text)}`;
    };

    const sendBulk = () => {
        const toSend = globalList.filter(c => !excludedIds.has(c.id));
        if (toSend.length === 0) return alert('Select at least one customer.');
        if (window.confirm(`Send WhatsApp to ${toSend.length} customers? Browser may block popups — will open first one.`)) {
            const target = toSend[0];
            window.open(getWhatsAppUrl(target), '_blank');
            setExcludedIds(prev => new Set(prev).add(target.id));
        }
    };

    const toggleAll = () => {
        if (excludedIds.size === globalList.length) setExcludedIds(new Set());
        else setExcludedIds(new Set(globalList.map(c => c.id)));
    };

    const handleExtend = () => {
        if (!extendDate) return;
        updateCustomerDueDate(extendId, extendDate);
        setExtendId(null);
        setExtendDate('');
    };

    // ── Balance row renderer ──────────────────────────────────────────────────
    const BalSection = ({ label, color, items }) => {
        if (items.length === 0) return null;
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color, marginBottom: '0.4rem' }}>{label}</div>
                <div className="due-balances">
                    {items.map((item, i) => (
                        <span key={i} className={`bal-tag ${item.cls}`}>{item.label}</span>
                    ))}
                </div>
            </div>
        );
    };

    const getBalSections = (c) => {
        const youGot  = [];
        const youGave = [];
        if (n(c.cashBalance)   > 0) youGot.push( { label: `₹${fmt(n(c.cashBalance))}`,           cls: 'tb-cash' });
        if (n(c.goldBalance)   > 0) youGot.push( { label: `${fmtG(n(c.goldBalance))}g Au`,        cls: 'tb-gold' });
        if (n(c.silverBalance) > 0) youGot.push( { label: `${fmtG(n(c.silverBalance))}g Ag`,      cls: 'tb-silver' });
        if (n(c.cashBalance)   < 0) youGave.push({ label: `₹${fmt(Math.abs(n(c.cashBalance)))}`,  cls: 'tb-cash' });
        if (n(c.goldBalance)   < 0) youGave.push({ label: `${fmtG(Math.abs(n(c.goldBalance)))}g Au`,   cls: 'tb-gold' });
        if (n(c.silverBalance) < 0) youGave.push({ label: `${fmtG(Math.abs(n(c.silverBalance)))}g Ag`, cls: 'tb-silver' });
        return { youGot, youGave };
    };

    return (
        <div className="due-container animate-fade-in" style={{ paddingBottom: '90px' }}>

            {/* Header */}
            <div className="due-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>Pending Dues</h2>
                        <p>
                            {viewMode === 'customer'
                                ? (custFilter ? custFilter.name : 'Select a customer')
                                : `${globalList.length} ${globalFilter === 'YOU_GAVE' ? 'you gave' : globalFilter === 'YOU_GOT' ? 'you got' : 'total'}`}
                        </p>
                    </div>
                </div>
                {viewMode === 'global' && (
                    <button className="bulk-send-btn" onClick={sendBulk} disabled={globalList.filter(c => !excludedIds.has(c.id)).length === 0}>
                        <Send size={16} /> Send ({globalList.filter(c => !excludedIds.has(c.id)).length})
                    </button>
                )}
            </div>

            {/* View mode tabs */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[{ key: 'customer', label: 'Customer' }, { key: 'global', label: 'Global' }].map(({ key, label }) => (
                    <button key={key} onClick={() => setViewMode(key)} style={{
                        padding: '0.45rem 1.1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600,
                        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                        background: viewMode === key ? '#6366f1' : 'rgba(255,255,255,0.07)',
                        color: viewMode === key ? '#fff' : 'var(--text-secondary)',
                    }}>{label}</button>
                ))}
            </div>

            {/* ── CUSTOMER VIEW ─────────────────────────────────────────────── */}
            {viewMode === 'customer' && (
                <>
                    {/* Customer search */}
                    <div ref={custRef} style={{ position: 'relative' }}>
                        {custFilter ? (
                            <div className="tx-cust-chip">
                                <User size={13} />
                                <span>{custFilter.name}</span>
                                <button onClick={() => { setCustFilter(null); setCustSearch(''); }} className="tx-cust-chip-x"><X size={12} /></button>
                            </div>
                        ) : (
                            <div className={`search-bar tx-cust-search ${showCustDD ? 'focused' : ''}`} style={{ marginBottom: 0 }}>
                                <User size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <input
                                    type="text"
                                    placeholder="Search customer by name or mobile..."
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
                                    <button key={c.id} className="tx-cust-dd-row"
                                        onMouseDown={e => { e.preventDefault(); setCustFilter({ id: c.id, name: c.name }); setCustSearch(''); setShowCustDD(false); }}>
                                        <span className="tx-cust-dd-name">{c.name}</span>
                                        <span className="tx-cust-dd-mob">{c.mobile}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!custFilter ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Select a customer to view their dues</div>
                        </div>
                    ) : selectedCustomer && (
                        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '14px' }}>
                            {/* Due date row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>Due Date</div>
                                    {selectedCustomer.due_date ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                                                {new Date(selectedCustomer.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                            <StatusBadge days={getDaysFromToday(selectedCustomer.due_date)} />
                                        </div>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No due date set</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <a href={getWhatsAppUrl(selectedCustomer)} target="_blank" rel="noopener noreferrer" className="wa-icon-btn" title="Send WhatsApp">
                                        <Phone size={16} />
                                    </a>
                                    <button className="wa-icon-btn" title="Set / extend due date"
                                        onClick={() => { setExtendId(selectedCustomer.id); setExtendDate(selectedCustomer.due_date || ''); }}
                                        style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                                        <CalendarDays size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Balance sections */}
                            {(() => {
                                const { youGot, youGave } = getBalSections(selectedCustomer);
                                return (
                                    <>
                                        <BalSection label="You Got (Customer owes you)" color="#ef4444" items={youGave} />
                                        <BalSection label="You Gave (You hold for customer)" color="#10b981" items={youGot} />
                                        {youGot.length === 0 && youGave.length === 0 && (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No outstanding balances.</div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </>
            )}

            {/* ── GLOBAL VIEW ───────────────────────────────────────────────── */}
            {viewMode === 'global' && (
                <>
                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[
                            { key: 'ALL',      label: 'All',      color: '#6366f1' },
                            { key: 'YOU_GAVE', label: 'You Gave', color: '#ef4444' },
                            { key: 'YOU_GOT',  label: 'You Got',  color: '#10b981' },
                        ].map(({ key, label, color }) => (
                            <button key={key} onClick={() => { setGlobalFilter(key); setExcludedIds(new Set()); }} style={{
                                padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem',
                                fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                background: globalFilter === key ? color : 'rgba(255,255,255,0.07)',
                                color: globalFilter === key ? '#fff' : 'var(--text-secondary)',
                            }}>{label}</button>
                        ))}
                    </div>

                    <div className="table-container glass-panel" style={{ padding: 0 }}>
                        <table className="ui-table due-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36, cursor: 'pointer' }} onClick={toggleAll}>
                                        {excludedIds.size === globalList.length && globalList.length > 0
                                            ? <Square size={17} className="text-muted" />
                                            : <CheckSquare size={17} className="text-blue" />}
                                    </th>
                                    <th>Customer</th>
                                    <th>You Gave</th>
                                    <th>You Got</th>
                                    <th>Due Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {globalList.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No dues found.</td></tr>
                                ) : globalList.map(c => {
                                    const { youGot, youGave } = getBalSections(c);
                                    const isExcluded = excludedIds.has(c.id);
                                    return (
                                        <tr key={c.id} className={isExcluded ? 'row-excluded' : ''}>
                                            <td onClick={() => {
                                                setExcludedIds(prev => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; });
                                            }} style={{ cursor: 'pointer' }}>
                                                {isExcluded ? <Square size={17} className="text-muted" /> : <CheckSquare size={17} className="text-blue" />}
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.mobile}</div>
                                            </td>
                                            <td>
                                                <div className="due-balances">
                                                    {youGave.length > 0 ? youGave.map((b, i) => <span key={i} className={`bal-tag ${b.cls}`}>{b.label}</span>) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="due-balances">
                                                    {youGot.length > 0 ? youGot.map((b, i) => <span key={i} className={`bal-tag ${b.cls}`}>{b.label}</span>) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                                                </div>
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                                    {new Date(c.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                <StatusBadge days={c.days} />
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <a href={getWhatsAppUrl(c)} target="_blank" rel="noopener noreferrer"
                                                        className={`wa-icon-btn ${isExcluded ? 'disabled' : ''}`}
                                                        onClick={e => { if (isExcluded) e.preventDefault(); else setExcludedIds(prev => new Set(prev).add(c.id)); }}>
                                                        <Phone size={15} />
                                                    </a>
                                                    <button className="wa-icon-btn" title="Extend due date"
                                                        onClick={() => { setExtendId(c.id); setExtendDate(c.due_date || ''); }}
                                                        style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                                                        <CalendarDays size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Extend / Set Due Date Modal */}
            {extendId && (() => {
                const cust = customers.find(c => c.id === extendId);
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
                        onClick={() => setExtendId(null)}>
                        <div className="glass-panel" onClick={e => e.stopPropagation()}
                            style={{ width: '100%', maxWidth: '360px', padding: '1.5rem', borderRadius: '18px' }}>
                            <h3 style={{ margin: '0 0 0.25rem' }}>Set Due Date</h3>
                            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cust?.name}</p>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Due Date</label>
                                <input
                                    type="date"
                                    value={extendDate}
                                    onChange={e => setExtendDate(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit', fontSize: '1rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => setExtendId(null)}
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>
                                    Cancel
                                </button>
                                <button onClick={handleExtend} disabled={!extendDate}
                                    style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', background: extendDate ? '#6366f1' : 'rgba(99,102,241,0.3)', border: 'none', color: '#fff', cursor: extendDate ? 'pointer' : 'default', fontWeight: 600 }}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default DuePage;
