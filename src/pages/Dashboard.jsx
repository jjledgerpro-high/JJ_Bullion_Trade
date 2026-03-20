import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingDown, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './Dashboard.css';

const fmt  = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(2);

const Dashboard = () => {
    const navigate = useNavigate();
    const { customers } = useAppContext();

    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        let duesCash = 0, duesGold = 0, duesSilver = 0;
        let rNet = 0, bNet = 0, sNet = 0;

        customers.forEach(c => {
            const cash   = parseFloat(c.cashBalance   || 0);
            const gold   = parseFloat(c.goldBalance   || 0);
            const silver = parseFloat(c.silverBalance || 0);

            rNet += cash; bNet += gold; sNet += silver;

            if (cash   < 0) duesCash   += cash;
            if (gold   < 0) duesGold   += gold;
            if (silver < 0) duesSilver += silver;
        });

        return { rNet, bNet, sNet, dues: { cash: Math.abs(duesCash), gold: Math.abs(duesGold), silver: Math.abs(duesSilver) } };
    }, [customers]);

    return (
        <div className="dashboard-container animate-fade-in" style={{ paddingBottom: '90px' }}>
            <div className="dash-header">
                <div>
                    <h2 className="dash-title">Financial Position</h2>
                    <p className="dash-subtitle">Overview of current balances</p>
                </div>
            </div>

            <div className="summary-banner glass-panel">
                <div className="summary-item">
                    <Users size={18} className="text-blue" />
                    <span>Total Customers: <strong>{customers.length}</strong></span>
                </div>
                <div className="summary-item">
                    <TrendingDown size={18} className="text-red" />
                    <span style={{ fontSize: '0.82rem' }}>
                        Owed to Shop:&nbsp;
                        <strong style={{ color: stats.dues.cash   > 0 ? '#ef4444' : 'var(--text-muted)' }}>₹{fmt(stats.dues.cash)}</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.dues.gold   > 0 ? '#ef4444' : 'var(--text-muted)' }}>{fmtG(stats.dues.gold)}g Au</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.dues.silver > 0 ? '#ef4444' : 'var(--text-muted)' }}>{fmtG(stats.dues.silver)}g Ag</strong>
                    </span>
                </div>
                <div className="summary-item">
                    <TrendingUp size={18} className="text-green" />
                    <span style={{ fontSize: '0.82rem' }}>
                        On Books:&nbsp;
                        <strong style={{ color: stats.rNet >= 0 ? '#10b981' : '#ef4444' }}>
                            ₹{fmt(Math.abs(stats.rNet))}{stats.rNet < 0 ? ' DR' : ' CR'}
                        </strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#eab308' }}>{fmtG(stats.bNet)}g Au</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#94a3b8' }}>{fmtG(stats.sNet)}g Ag</strong>
                    </span>
                </div>
            </div>

            {/* Quick-nav cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1.25rem' }}>
                {[
                    { label: 'Customers',    sub: `${customers.length} registered`,       path: '/customers',    color: '#6366f1' },
                    { label: 'Transactions', sub: 'Add a new entry',                       path: '/transactions', color: '#f59e0b' },
                    { label: 'Ledger',       sub: 'View all transactions',                 path: '/ledger',       color: '#10b981' },
                    { label: 'Dues',         sub: 'Pending collections',                   path: '/due',          color: '#ef4444' },
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
