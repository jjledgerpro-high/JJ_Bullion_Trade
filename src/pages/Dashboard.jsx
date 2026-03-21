import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './Dashboard.css';

const fmt  = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);
const n    = (v) => parseFloat(v || 0);

const SubTypeRow = ({ label, got, gave, isGrams, metalColor }) => {
    const hasGot  = Math.abs(n(got))  > 0.0001;
    const hasGave = Math.abs(n(gave)) > 0.0001;
    if (!hasGot && !hasGave) return null;
    const fmtVal = (v) => isGrams ? `${fmtG(Math.abs(n(v)))}g` : `₹${fmt(Math.abs(n(v)))}`;
    return (
        <div className="kpi-subtype-block">
            <div className="kpi-subtype-label" style={{ color: metalColor || 'var(--text-muted)' }}>{label}</div>
            <div className="kpi-subtype-rows">
                {hasGot && (
                    <div className="kpi-sub">
                        <span className="kpi-sub-label">You Got</span>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmtVal(got)}{!isGrams ? ' CR' : ''}</span>
                    </div>
                )}
                {hasGave && (
                    <div className="kpi-sub">
                        <span className="kpi-sub-label">You Gave</span>
                        <span style={{ color: '#f43f5e', fontWeight: 700 }}>{fmtVal(gave)}{!isGrams ? ' DR' : ''}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { customers } = useAppContext();

    const stats = useMemo(() => {
        const mk = () => ({ got: 0, gave: 0 });
        const t = {
            retail:  { cash: mk(), gold: mk() },
            bullion: { cash: mk(), gold: mk(), silver: mk() },
            silver:  { cash: mk(), silver: mk() },
            chit:    { cash: mk() },
        };

        const acc = (slot, val) => {
            const v = n(val || 0);
            if (v > 0) slot.got  += v;
            else       slot.gave += v;
        };

        customers.forEach(c => {
            acc(t.retail.cash,    c.retailCash);
            acc(t.retail.gold,    c.retailGold);
            acc(t.bullion.cash,   c.bullionCash);
            acc(t.bullion.gold,   c.bullionGold);
            acc(t.bullion.silver, c.bullionSilver);
            acc(t.silver.cash,    c.silverCash);
            acc(t.silver.silver,  c.silverSilver);
            acc(t.chit.cash,      c.chitCash);

        });

        return t;
    }, [customers]);

    const KPICard = ({ cls, title, emoji, subtypes }) => (
        <div className={`kpi-card ${cls}`}>
            <div className="kpi-header">
                <h3>{emoji} {title}</h3>
            </div>
            <div className="kpi-body">
                {subtypes.map((s, i) => (
                    <SubTypeRow key={i} label={s.label} got={s.slot.got} gave={s.slot.gave} isGrams={s.isGrams} metalColor={s.metalColor} />
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
                    subtypes={[
                        { label: 'Cash', slot: stats.retail.cash, isGrams: false },
                        { label: 'Gold', slot: stats.retail.gold, isGrams: true, metalColor: '#fbbf24' },
                    ]}
                />
                <KPICard
                    cls="kpi-bullion"
                    title="Bullion"
                    emoji="🥇"
                    subtypes={[
                        { label: 'Cash',   slot: stats.bullion.cash,   isGrams: false },
                        { label: 'Gold',   slot: stats.bullion.gold,   isGrams: true, metalColor: '#fbbf24' },
                        { label: 'Silver', slot: stats.bullion.silver, isGrams: true, metalColor: '#94a3b8' },
                    ]}
                />
                <KPICard
                    cls="kpi-silver"
                    title="Silver"
                    emoji="🥈"
                    subtypes={[
                        { label: 'Cash',   slot: stats.silver.cash,   isGrams: false },
                        { label: 'Silver', slot: stats.silver.silver, isGrams: true, metalColor: '#94a3b8' },
                    ]}
                />
                <KPICard
                    cls="kpi-chit"
                    title="Chit"
                    emoji="📋"
                    subtypes={[
                        { label: 'Cash', slot: stats.chit.cash, isGrams: false },
                    ]}
                />
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
