import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingDown, Clock, Camera, TrendingUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './Dashboard.css';

const fmt = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);

// ── Declared outside Dashboard so React doesn't re-create it on every render ──
const KPICard = ({ title, data, colorClass }) => (
    <div className={`kpi-card ${colorClass}`}>
        <div className="kpi-header">
            <h3>{title}</h3>
            <span className={`kpi-net ${data.net >= 0 ? 'text-green' : 'text-red'}`}>
                {data.net >= 0 ? '+' : ''}{data.fmt(data.net)}{data.label}
            </span>
        </div>
        <div className="kpi-body">
            <div className="kpi-sub">
                <span className="kpi-sub-label">Pending:</span>
                <span className="text-red">{data.fmt(Math.abs(data.pend))}{data.label}</span>
            </div>
            <div className="kpi-sub">
                <span className="kpi-sub-label">No Pending:</span>
                <span className={data.noPend >= 0 ? 'text-green' : 'text-red'}>
                    {data.noPend >= 0 ? '+' : ''}{data.fmt(data.noPend)}{data.label}
                </span>
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const navigate = useNavigate();
    const { customers, transactions } = useAppContext();

    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];

        // ── Outstanding balances per customer (for KPI cards) ─────────────────
        let rNet = 0, rPend = 0, rNoPend = 0;
        let bNet = 0, bPend = 0, bNoPend = 0;
        let sNet = 0, sPend = 0, sNoPend = 0;
        let cNet = 0, cPend = 0, cNoPend = 0;
        let duesCash = 0, duesGold = 0, duesSilver = 0;

        customers.forEach(c => {
            const isPending = c.due_date && c.due_date <= todayStr;
            const cash   = parseFloat(c.cashBalance   || 0);
            const gold   = parseFloat(c.goldBalance   || 0);
            const silver = parseFloat(c.silverBalance || 0);

            rNet += cash; bNet += gold; sNet += silver;

            if (cash   < 0 && isPending) rPend += cash;   else rNoPend += cash;
            if (gold   < 0 && isPending) bPend += gold;   else bNoPend += gold;
            if (silver < 0 && isPending) sPend += silver; else sNoPend += silver;

            if (cash   < 0) duesCash   += cash;
            if (gold   < 0) duesGold   += gold;
            if (silver < 0) duesSilver += silver;
        });

        // ── Gross flow totals from transactions (IN vs OUT) ───────────────────
        // These tell you WHAT CAME IN and WHAT WENT OUT across the business,
        // broken down by category and unit. Independent of customer balances.
        const flow = {
            cash:        { in: 0, out: 0 },   // ₹ — RETAIL + SILVER + CHIT
            bullionGold: { in: 0, out: 0 },   // g — BULLION GOLD
            bullionSilver: { in: 0, out: 0 }, // g — BULLION SILVER
            chit:        { in: 0, out: 0 },   // ₹ — CHIT only (subset of cash)
        };

        transactions.forEach(t => {
            const dir  = t.direction || (t.jama > 0 ? 'IN' : 'OUT'); // back-compat
            const amt  = t.jama > 0 ? parseFloat(t.jama) : parseFloat(t.nave);

            if (t.type === 'GOLD' && t.category === 'BULLION') {
                dir === 'IN' ? (flow.bullionGold.in  += amt) : (flow.bullionGold.out  += amt);
            } else if (t.type === 'SILVER' && t.category === 'BULLION') {
                dir === 'IN' ? (flow.bullionSilver.in += amt) : (flow.bullionSilver.out += amt);
            } else if (t.type === 'CASH') {
                dir === 'IN' ? (flow.cash.in  += amt) : (flow.cash.out  += amt);
                if (t.category === 'CHIT') {
                    dir === 'IN' ? (flow.chit.in  += amt) : (flow.chit.out  += amt);
                }
            }
        });

        // Chit net comes from chit transactions; general cash net from customers
        cNet = flow.chit.in - flow.chit.out;

        return {
            retail:  { net: rNet, pend: rPend, noPend: rNoPend, label: '₹',  fmt: fmt  },
            bullion: { net: bNet, pend: bPend, noPend: bNoPend, label: 'g',  fmt: fmtG },
            silver:  { net: sNet, pend: sPend, noPend: sNoPend, label: 'g',  fmt: fmtG },
            chit:    { net: cNet, pend: cPend, noPend: cNoPend, label: '₹',  fmt: fmt  },
            dues:    { cash: Math.abs(duesCash), gold: Math.abs(duesGold), silver: Math.abs(duesSilver) },
            flow,    // gross IN / OUT totals — used by flow summary strip
        };
    }, [customers, transactions]);

    const recentTransactions = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayTxs = transactions.filter(t => t.date === todayStr);
        const sorted = (arr) => [...arr].sort((a, b) => b.createdAt - a.createdAt);
        const list = todayTxs.length > 0
            ? sorted(todayTxs).slice(0, 5)
            : sorted(transactions).slice(0, 5);
        return { list, isTodayOnly: todayTxs.length > 0 };
    }, [transactions]);

    const getCustomerName = (cid) => {
        const c = customers.find(c => c.id === cid);
        return c ? c.name : 'Unknown';
    };

    return (
        <div className="dashboard-container animate-fade-in" style={{ paddingBottom: '90px' }}>
            <div className="dash-header">
                <div>
                    <h2 className="dash-title">Financial Position</h2>
                    <p className="dash-subtitle">Overview of current balances</p>
                </div>
            </div>

            <div className="kpi-grid">
                <KPICard title="Retail (Cash)" data={stats.retail} colorClass="kpi-retail" />
                <KPICard title="Bullion (Gold)" data={stats.bullion} colorClass="kpi-bullion" />
                <KPICard title="Silver" data={stats.silver} colorClass="kpi-silver" />
                <KPICard title="Chit Fund" data={stats.chit} colorClass="kpi-chit" />
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
                        <strong style={{ color: stats.dues.cash > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                            ₹{fmt(stats.dues.cash)}
                        </strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.dues.gold > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                            {fmtG(stats.dues.gold)}g Au
                        </strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: stats.dues.silver > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                            {fmtG(stats.dues.silver)}g Ag
                        </strong>
                    </span>
                </div>
                <div className="summary-item">
                    <TrendingUp size={18} className="text-green" />
                    <span style={{ fontSize: '0.82rem' }}>
                        On Books:&nbsp;
                        <strong style={{ color: stats.retail.net >= 0 ? '#10b981' : '#ef4444' }}>
                            ₹{fmt(Math.abs(stats.retail.net))}{stats.retail.net < 0 ? ' DR' : ' CR'}
                        </strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#eab308' }}>{fmtG(stats.bullion.net)}g Au</strong>
                        &nbsp;|&nbsp;
                        <strong style={{ color: '#94a3b8' }}>{fmtG(stats.silver.net)}g Ag</strong>
                    </span>
                </div>
            </div>

            <div className="dash-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                        <h3 className="section-title" style={{ margin: 0 }}>
                            {recentTransactions.isTodayOnly ? "Today's Transactions" : 'Recent Transactions'}
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {recentTransactions.isTodayOnly
                                ? `Last ${recentTransactions.list.length} entries today · tap row to open`
                                : 'No transactions today — showing last 5'}
                        </p>
                    </div>
                    {!recentTransactions.isTodayOnly && (
                        <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    )}
                </div>

                <div className="table-container glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Direction</th>
                                <th>Category</th>
                                <th>Customer</th>
                                <th>Amount</th>
                                <th>New Balance</th>
                                <th className="dash-col-by">By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTransactions.list.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                                        No transactions yet. Tap <strong>+ Add Transaction</strong> to begin.
                                    </td>
                                </tr>
                            ) : (
                                recentTransactions.list.map(t => {
                                    const isGot      = t.jama > 0;
                                    const isCash     = t.type === 'CASH';
                                    const amount     = isGot ? t.jama : t.nave;
                                    const amountFmt  = isCash
                                        ? `₹${fmt(amount)}`
                                        : `${fmtG(amount)} g`;
                                    const newBalFmt  = t.newBalance !== undefined
                                        ? (isCash ? `₹${fmt(t.newBalance)}` : `${fmtG(t.newBalance)} g`)
                                        : '—';

                                    // Category label: use new fields if present, fall back to legacy type
                                    const catLabel = t.category
                                        ? t.category + (t.sub_type && t.sub_type !== t.category ? ` · ${t.sub_type}` : '')
                                        : t.type;
                                    const schemeTag = t.chit_scheme ? ` (${t.chit_scheme})` : '';

                                    return (
                                        <tr
                                            key={t.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => navigate(`/customers/${t.cid}`)}
                                        >
                                            {/* Time */}
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {t.time ? t.time.substring(0, 5) : '—'}
                                            </td>

                                            {/* Direction */}
                                            <td>
                                                <span className={`dash-dir-badge ${isGot ? 'dash-dir-got' : 'dash-dir-gave'}`}>
                                                    {isGot
                                                        ? <><TrendingUp size={11} /> GOT</>
                                                        : <><TrendingDown size={11} /> GAVE</>}
                                                </span>
                                            </td>

                                            {/* Category */}
                                            <td>
                                                <span className={`tb-badge tb-${t.type.toLowerCase()}`}>
                                                    {catLabel}{schemeTag}
                                                </span>
                                            </td>

                                            {/* Customer */}
                                            <td style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                                {getCustomerName(t.cid)}
                                                {t.images?.length > 0 && (
                                                    <Camera size={11} style={{ marginLeft: '5px', color: '#60a5fa', verticalAlign: '-1px' }} />
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                    color: isGot ? '#10b981' : '#ef4444',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {isGot ? '+' : '−'}{amountFmt}
                                                {/* Show bill amount as sub-note for metal transactions */}
                                                {!isCash && t.bill_amount > 0 && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                        ₹{fmt(t.bill_amount)}
                                                    </div>
                                                )}
                                            </td>

                                            {/* New Balance */}
                                            <td
                                                style={{
                                                    fontWeight: 600,
                                                    color: (t.newBalance ?? 0) >= 0 ? '#10b981' : '#ef4444',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {newBalFmt}
                                            </td>

                                            {/* Added By */}
                                            <td className="dash-col-by" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {t.added_by || '—'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
