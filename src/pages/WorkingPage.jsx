import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Card, Button } from '../components/ui/Primitives';
import { ArrowLeft, Camera } from 'lucide-react';
import './WorkingPage.css';

const fmt = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);

const WorkingPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { customers, transactions } = useAppContext();
    const [selectedTx, setSelectedTx] = useState(null);

    const customer = useMemo(() => customers.find(c => c.id === id), [customers, id]);

    // Default filter to primary category, fallback to 'ALL' if we prefer
    // BRD WP-03: filtered and displayed based on primary business category
    const [typeFilter, setTypeFilter] = useState(customer?.primary_category || 'ALL');

    if (!customer) {
        return (
            <div className="working-container">
                <p>Customer not found.</p>
                <Button onClick={() => navigate('/customers')}>Go Back</Button>
            </div>
        );
    }

    const customerTxs = useMemo(() => {
        let list = transactions.filter(t => t.cid === id);
        if (typeFilter !== 'ALL') {
            list = list.filter(t => t.type === typeFilter);
        }
        // WP-02: Sort ascending time order (oldest at top)
        list = list.sort((a, b) => a.createdAt - b.createdAt);

        // Calculate running balances for the selected type
        // Wait: Running balance should be across all time for this customer.
        // It's calculated iteratively.
        let runBal = 0;
        return list.map(t => {
            if (t.type === typeFilter || typeFilter === 'ALL') {
                runBal += (t.jama - t.nave);
            }
            return { ...t, currentBalance: runBal };
        });
    }, [transactions, id, typeFilter]);

    return (
        <div className="working-container animate-fade-in" style={{ paddingBottom: '90px' }}>
            {/* Header WP-01 */}
            <div className="working-header glass-panel">
                <button className="back-btn" onClick={() => navigate('/customers')}>
                    <ArrowLeft size={20} />
                </button>
                <div className="working-customer-info">
                    <h2 className="customer-name">{customer.name}</h2>
                    <span className="customer-mobile">{customer.mobile}</span>
                </div>
            </div>

            {/* Total Balances */}
            <div className="working-balances">
                <div className={`bal-card ${customer.cashBalance >= 0 ? 'bal-positive' : 'bal-negative'}`}>
                    <span className="bal-label">Cash (₹)</span>
                    <span className="bal-value">{customer.cashBalance >= 0 ? '+' : ''}{fmt(customer.cashBalance)}</span>
                </div>
                <div className={`bal-card ${customer.goldBalance >= 0 ? 'bal-positive' : 'bal-negative'}`}>
                    <span className="bal-label">Gold (g)</span>
                    <span className="bal-value">{customer.goldBalance >= 0 ? '+' : ''}{fmtG(customer.goldBalance)}</span>
                </div>
                <div className={`bal-card ${customer.silverBalance >= 0 ? 'bal-positive' : 'bal-negative'}`}>
                    <span className="bal-label">Silver (g)</span>
                    <span className="bal-value">{customer.silverBalance >= 0 ? '+' : ''}{fmtG(customer.silverBalance)}</span>
                </div>
            </div>

            {/* Filters WP-03 */}
            <div className="working-filters">
                {['ALL', 'CASH', 'GOLD', 'SILVER'].map(f => (
                    <button
                        key={f}
                        className={`filter-pill ${typeFilter === f ? 'active' : ''}`}
                        onClick={() => setTypeFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Transactions List WP-02 */}
            <div className="working-ledger" style={{ marginTop: '1rem' }}>
                <div className="table-container glass-panel" style={{ padding: 0 }}>
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>JAMA<br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>(Given)</span></th>
                                <th>NAVE<br /><span style={{ fontSize: '10px', fontWeight: 'normal' }}>(Received)</span></th>
                                <th>Balance<br />{typeFilter !== 'ALL' ? `(${typeFilter})` : ''}</th>
                                <th>Receipt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerTxs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        No transactions found for {typeFilter}.
                                    </td>
                                </tr>
                            ) : (
                                customerTxs.map((t, idx) => (
                                    <tr key={t.id} onClick={() => setSelectedTx(t)} style={{ cursor: 'pointer' }}>
                                        <td>{t.date} <br /><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.time}</span></td>
                                        <td><span className={`tb-badge tb-${t.type.toLowerCase()}`}>{t.type}</span></td>
                                        <td className="text-green" style={{ fontWeight: 600 }}>{t.jama > 0 ? (t.type === 'CASH' ? fmt(t.jama) : fmtG(t.jama)) : '-'}</td>
                                        <td className="text-red" style={{ fontWeight: 600 }}>{t.nave > 0 ? (t.type === 'CASH' ? fmt(t.nave) : fmtG(t.nave)) : '-'}</td>
                                        <td className={t.currentBalance >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                                            {t.currentBalance >= 0 ? '+' : ''}{t.type === 'CASH' ? fmt(t.currentBalance) : fmtG(t.currentBalance)}
                                        </td>
                                        <td>{t.images && t.images.length > 0 ? <Camera size={16} className="text-blue" /> : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* WP-05: Transaction Detail Modal */}
            {selectedTx && (
                <div
                    className="popup-overlay animate-fade-in"
                    onClick={() => setSelectedTx(null)}
                    style={{ zIndex: 1000 }}
                >
                    <div
                        className="glass-panel slide-up"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '420px',
                            width: '90%',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            padding: '1.5rem',
                            borderRadius: '16px',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Transaction Details</h3>
                            <button
                                onClick={() => setSelectedTx(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Type</span>
                                <span className={`tb-badge tb-${selectedTx.type.toLowerCase()}`}>{selectedTx.type}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Date</span>
                                <span>{selectedTx.date} {selectedTx.time}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>JAMA (Given)</span>
                                <span className="text-green" style={{ fontWeight: 600 }}>
                                    {selectedTx.jama > 0 ? (selectedTx.type === 'CASH' ? fmt(selectedTx.jama) : fmtG(selectedTx.jama)) : '-'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>NAVE (Received)</span>
                                <span className="text-red" style={{ fontWeight: 600 }}>
                                    {selectedTx.nave > 0 ? (selectedTx.type === 'CASH' ? fmt(selectedTx.nave) : fmtG(selectedTx.nave)) : '-'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Running Balance</span>
                                <span className={selectedTx.currentBalance >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 600 }}>
                                    {selectedTx.type === 'CASH' ? fmt(selectedTx.currentBalance) : fmtG(selectedTx.currentBalance)}
                                </span>
                            </div>
                            {selectedTx.description && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Note</span>
                                    <span>{selectedTx.description}</span>
                                </div>
                            )}
                            {selectedTx.added_by && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Added By</span>
                                    <span>{selectedTx.added_by}</span>
                                </div>
                            )}
                        </div>

                        {/* Full-size receipt images */}
                        {selectedTx.images && selectedTx.images.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Receipt Photos</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedTx.images.map((img, i) => (
                                        <a key={i} href={img.url} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={img.url}
                                                alt={`Receipt ${i + 1}`}
                                                style={{
                                                    width: '100%',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                            />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkingPage;
