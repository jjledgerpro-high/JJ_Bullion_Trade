import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './Dashboard.css';

const fmt  = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);
const n    = (v) => parseFloat(v || 0);

const BalLine = ({ label, value, isGrams, color }) => {
    const abs = Math.abs(n(value));
    const cr  = n(value) >= 0;
    const display = isGrams ? `${fmtG(abs)}g` : `₹${fmt(abs)}`;
    return (
        <div className="kpi-sub">
            <span className="kpi-sub-label">{label}</span>
            <span style={{ color: color || (cr ? '#22c55e' : '#f43f5e'), fontWeight: 700 }}>
                {display} {!isGrams && (cr ? 'CR' : 'DR')}
            </span>
        </div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { customers } = useAppContext();

    const stats = useMemo(() => {
        const t = {
            retail:  { cash: 0, gold: 0 },
            bullion: { cash: 0, gold: 0, silver: 0 },
            silver:  { cash: 0, silver: 0 },
            chit:    { cash: 0 },
            total:   { cash: 0, gold: 0, silver: 0 },
            duesCash: 0, duesGold: 0, duesSilver: 0,
        };

        customers.forEach(c => {
            t.retail.cash    += n(c.retailCash    || 0);
            t.retail.gold    += n(c.retailGold    || 0);
            t.bullion.cash   += n(c.bullionCash   || 0);
            t.bullion.gold   += n(c.bullionGold   || 0);
            t.bullion.silver += n(c.bullionSilver || 0);
            t.silver.cash    += n(c.silverCash    || 0);
            t.silver.silver  += n(c.silverSilver  || 0);
            t.chit.cash      += n(c.chitCash      || 0);

            t.total.cash   += n(c.cashBalance   || 0);
            t.total.gold   += n(c.goldBalance   || 0);
            t.total.silver += n(c.silverBalance || 0);

            if (n(c.cashBalance)   < 0) t.duesCash   += n(c.cashBalance);
            if (n(c.goldBalance)   < 0) t.duesGold   += n(c.goldBalance);
            if (n(c.silverBalance) < 0) t.duesSilver += n(c.silverBalance);
        });

        return t;
    }, [customers]);

    const KPICard = ({ cls, title, emoji, rows }) => (
        <div className={`kpi-card ${cls}`}>
            <div className="kpi-header">
                <h3>{emoji} {title}</h3>
            </div>
            <div className="kpi-body">
                {rows.map((r, i) => (
                    <BalLine key={i} label={r.label} value={r.value} isGrams={r.isGrams} color={r.color} />
                ))}
            </div>
        </div>
    );

    return (
        <div className="dashboard-container animate-fade-in" style={{ paddingBottom: '90px' }}>
            <div className="dash-header">
                <div>
                    <h2 className="dash-title">Financial Position</h2>
                    <p className="dash-subtitle">{customers.length} customers · all categories</p>
                </div>
            </div>

            {/* Per-category KPI cards */}
            <div className="kpi-grid">
                <KPICard
                    cls="kpi-retail"
                    title="Retail"
                    emoji="🏪"
                    rows={[
                        { label: 'Cash',  value: stats.retail.cash, isGrams: false },
                        { label: 'Gold',  value: stats.retail.gold, isGrams: true, color: '#fbbf24' },
                    ]}
                />
                <KPICard
                    cls="kpi-bullion"
                    title="Bullion"
                    emoji="🥇"
                    rows={[
                        { label: 'Cash',   value: stats.bullion.cash,   isGrams: false },
                        { label: 'Gold',   value: stats.bullion.gold,   isGrams: true, color: '#fbbf24' },
                        { label: 'Silver', value: stats.bullion.silver, isGrams: true, color: '#94a3b8' },
                    ]}
                />
                <KPICard
                    cls="kpi-silver"
                    title="Silver"
                    emoji="🥈"
                    rows={[
                        { label: 'Cash',   value: stats.silver.cash,   isGrams: false },
                        { label: 'Silver', value: stats.silver.silver, isGrams: true, color: '#94a3b8' },
                    ]}
                />
                <KPICard
                    cls="kpi-chit"
                    title="Chit"
                    emoji="📋"
                    rows={[
                        { label: 'Cash', value: stats.chit.cash, isGrams: false },
                    ]}
                />
            </div>

            {/* Overall owed-to-shop summary */}
            <div className="summary-banner glass-panel">
                <div className="summary-item">
                    <Users size={18} className="text-blue" />
                    <span>Total Customers: <strong>{customers.length}</strong></span>
                </div>
                <div className="summary-item">
                    <TrendingDown size={18} className="text-red" />
                    <span style={{ fontSize: '0.82rem' }}>
                        Owed to Shop:&nbsp;
                        <strong style={{ color: stats.duesCash   < 0 ? '#ef4444' : 'var(--text-muted)' }}>₹{fmt(Math.abs(stats.duesCash))}</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.duesGold   < 0 ? '#ef4444' : 'var(--text-muted)' }}>{fmtG(Math.abs(stats.duesGold))}g Au</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.duesSilver < 0 ? '#ef4444' : 'var(--text-muted)' }}>{fmtG(Math.abs(stats.duesSilver))}g Ag</strong>
                    </span>
                </div>
                <div className="summary-item">
                    <TrendingUp size={18} className="text-green" />
                    <span style={{ fontSize: '0.82rem' }}>
                        Net Books:&nbsp;
                        <strong style={{ color: stats.total.cash >= 0 ? '#10b981' : '#ef4444' }}>
                            ₹{fmt(Math.abs(stats.total.cash))}{stats.total.cash < 0 ? ' DR' : ' CR'}
                        </strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#eab308' }}>{fmtG(stats.total.gold)}g Au</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#94a3b8' }}>{fmtG(stats.total.silver)}g Ag</strong>
                    </span>
                </div>
            </div>

            {/* Quick-nav cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                    { label: 'Customers',    sub: `${customers.length} registered`,  path: '/customers',    color: '#6366f1' },
                    { label: 'Transactions', sub: 'Add a new entry',                  path: '/transactions', color: '#f59e0b' },
                    { label: 'Ledger',       sub: 'View all transactions',            path: '/ledger',       color: '#10b981' },
                    { label: 'Dues',         sub: 'Pending collections',              path: '/due',          color: '#ef4444' },
                ].map(({ label, sub, path, color }) => (
                    <div
                        key={path}
                        onClick={() => navigate(path)}
                        className="glass-panel"
                        style={{
                            padding: '1rem',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            borderLeft: `3px solid ${color}`,
                            transition: 'transform 0.15s',
                        }}
                    >
                        <div style={{ fontWeight: 700, fontSize: '1rem', color }}>{label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>{sub}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
