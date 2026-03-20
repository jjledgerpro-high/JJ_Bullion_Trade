import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Phone, CheckSquare, Square, AlertTriangle, Send, ArrowLeft, CalendarDays } from 'lucide-react';
import './DuePage.css';

const fmt = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(2);

const getDaysOverdue = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr).getTime();
    const now = new Date().setHours(0, 0, 0, 0);
    const diff = now - due;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const DuePage = () => {
    const { customers, updateCustomerDueDate } = useAppContext();
    const navigate = useNavigate();
    const [excludedIds, setExcludedIds] = useState(new Set());
    const [extendId,    setExtendId]    = useState(null);   // customer id being extended
    const [extendDate,  setExtendDate]  = useState('');

    const pendingList = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        return customers.filter(c => {
            if (!c.due_date) return false;
            if (c.due_date > todayStr) return false;

            // Pending means at least one balance is < 0
            return (parseFloat(c.cashBalance) < 0 ||
                parseFloat(c.goldBalance) < 0 ||
                parseFloat(c.silverBalance) < 0);
        }).map(c => {
            return {
                ...c,
                daysOverdue: getDaysOverdue(c.due_date)
            };
        }).sort((a, b) => b.daysOverdue - a.daysOverdue); // most overdue first
    }, [customers]);

    const handleToggleExclude = (id) => {
        setExcludedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (excludedIds.size === pendingList.length) {
            setExcludedIds(new Set()); // include all
        } else {
            setExcludedIds(new Set(pendingList.map(c => c.id))); // exclude all
        }
    };

    const getWhatsAppUrl = (c) => {
        const cashStr = parseFloat(c.cashBalance) < 0 ? `₹${fmt(Math.abs(c.cashBalance))}` : '';
        const goldStr = parseFloat(c.goldBalance) < 0 ? `${fmtG(Math.abs(c.goldBalance))}g gold` : '';
        const silverStr = parseFloat(c.silverBalance) < 0 ? `${fmtG(Math.abs(c.silverBalance))}g silver` : '';

        const bals = [cashStr, goldStr, silverStr].filter(Boolean).join(' / ');
        const dueDateStr = c.due_date ? new Date(c.due_date).toLocaleDateString() : 'N/A';

        const text = `Dear ${c.name},\nThis is a gentle reminder that your outstanding balance with JJ Jewellers is: ${bals}.\nKindly settle the same at your earliest convenience.\nDue Date: ${dueDateStr}\n— JJ Jewellers`;

        let targetMobile = c.mobile;
        if (!targetMobile.startsWith('91')) targetMobile = '91' + targetMobile;

        return `https://wa.me/${targetMobile}?text=${encodeURIComponent(text)}`;
    };

    const sendBulk = () => {
        const toSend = pendingList.filter(c => !excludedIds.has(c.id));
        if (toSend.length === 0) return alert("Select at least one customer.");

        if (window.confirm(`You are about to send messages to ${toSend.length} customers. The browser may block multiple popups, so it will open the first one. Please click "Send All" again after sending the first message.`)) {
            // A realistic simple approach for PWA is just opening the first one, then moving them to excluded.
            const target = toSend[0];
            window.open(getWhatsAppUrl(target), '_blank');
            setExcludedIds(prev => new Set(prev).add(target.id));
        }
    };

    const handleExtend = () => {
        if (!extendDate) return;
        updateCustomerDueDate(extendId, extendDate);
        setExtendId(null);
        setExtendDate('');
    };

    return (
        <div className="due-container animate-fade-in" style={{ paddingBottom: '90px' }}>
            <div className="due-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2>Pending Dues</h2>
                        <p>{pendingList.length} customers overdue</p>
                    </div>
                </div>
                <button className="bulk-send-btn" onClick={sendBulk} disabled={pendingList.filter(c => !excludedIds.has(c.id)).length === 0}>
                    <Send size={16} /> Send Selected ({pendingList.filter(c => !excludedIds.has(c.id)).length})
                </button>
            </div>

            <div className="table-container glass-panel" style={{ padding: 0 }}>
                <table className="ui-table due-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px', cursor: 'pointer' }} onClick={toggleAll}>
                                {excludedIds.size === pendingList.length && pendingList.length > 0 ? (
                                    <Square size={18} className="text-muted" />
                                ) : (
                                    <CheckSquare size={18} className="text-blue" />
                                )}
                            </th>
                            <th>Customer</th>
                            <th>Balances Pending</th>
                            <th>Overdue</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingList.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No pending dues!
                                </td>
                            </tr>
                        ) : (
                            pendingList.map(c => {
                                const isExcluded = excludedIds.has(c.id);
                                const isRed = c.daysOverdue >= 7;
                                const isYellow = c.daysOverdue >= 1 && c.daysOverdue < 7;

                                let statusClass = 'status-normal';
                                if (isRed) statusClass = 'status-red';
                                else if (isYellow) statusClass = 'status-yellow';

                                return (
                                    <tr key={c.id} className={isExcluded ? 'row-excluded' : ''}>
                                        <td onClick={() => handleToggleExclude(c.id)} style={{ cursor: 'pointer' }}>
                                            {isExcluded ? (
                                                <Square size={18} className="text-muted" />
                                            ) : (
                                                <CheckSquare size={18} className="text-blue" />
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.mobile}</div>
                                        </td>
                                        <td>
                                            <div className="due-balances">
                                                {parseFloat(c.cashBalance) < 0 && <span className="bal-tag tb-cash">₹{fmt(Math.abs(c.cashBalance))}</span>}
                                                {parseFloat(c.goldBalance) < 0 && <span className="bal-tag tb-gold">{fmtG(Math.abs(c.goldBalance))}g</span>}
                                                {parseFloat(c.silverBalance) < 0 && <span className="bal-tag tb-silver">{fmtG(Math.abs(c.silverBalance))}g</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <div className={`overdue-badge ${statusClass}`}>
                                                {isRed || isYellow ? <AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} /> : null}
                                                {c.daysOverdue} {c.daysOverdue === 1 ? 'day' : 'days'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Since {new Date(c.due_date).toLocaleDateString()}</div>
                                        </td>
                                        <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                            <a
                                                href={getWhatsAppUrl(c)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`wa-icon-btn ${isExcluded ? 'disabled' : ''}`}
                                                onClick={(e) => {
                                                    if (isExcluded) e.preventDefault();
                                                    else setExcludedIds(prev => new Set(prev).add(c.id));
                                                }}
                                            >
                                                <Phone size={16} />
                                            </a>
                                            <button
                                                className="wa-icon-btn"
                                                title="Extend due date"
                                                onClick={() => { setExtendId(c.id); setExtendDate(c.due_date || ''); }}
                                                style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.35)', color: '#a5b4fc' }}
                                            >
                                                <CalendarDays size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {/* Extend Due Date Modal */}
            {extendId && (() => {
                const cust = customers.find(c => c.id === extendId);
                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
                        onClick={() => setExtendId(null)}>
                        <div className="glass-panel slide-up" onClick={e => e.stopPropagation()}
                            style={{ width: '100%', maxWidth: '360px', padding: '1.5rem', borderRadius: '18px' }}>
                            <h3 style={{ margin: '0 0 0.25rem' }}>Extend Due Date</h3>
                            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cust?.name}</p>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>New Due Date</label>
                                <input
                                    type="date"
                                    value={extendDate}
                                    min={new Date().toISOString().split('T')[0]}
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
                                    Save Extension
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
