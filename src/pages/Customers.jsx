import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Check, Search, ArrowLeft, Download, Pencil, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './Customers.css';

const fmt = (v) => parseFloat(v || 0).toFixed(2);
const fmtG = (v) => parseFloat(v || 0).toFixed(3);

// ── Edit Modal ────────────────────────────────────────────────────────────────
const EditCustomerModal = ({ customer, onSave, onClose }) => {
    const [name, setName] = useState(customer.name);
    const [mobile, setMobile] = useState(customer.mobile);
    const [errors, setErrors] = useState({});

    const handleSave = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Name is required';
        if (!mobile || mobile.length !== 10) errs.mobile = 'Valid 10-digit mobile required';
        if (Object.keys(errs).length) return setErrors(errs);
        onSave({ name: name.trim(), mobile });
    };

    return (
        <div className="popup-overlay animate-fade-in" style={{ zIndex: 1050 }}>
            <div className="popup-content slide-up" style={{ maxWidth: '420px', borderRadius: '20px' }}>
                <div className="popup-header">
                    <h3>Edit Customer</h3>
                    <button className="icon-btn" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="popup-body">
                    <div className="form-group">
                        <label>Mobile No</label>
                        <input
                            type="tel"
                            value={mobile}
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            inputMode="numeric"
                            autoFocus
                        />
                        {errors.mobile && <span className="cust-error">{errors.mobile}</span>}
                    </div>
                    <div className="form-group">
                        <label>Customer Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                        {errors.name && <span className="cust-error">{errors.name}</span>}
                    </div>
                </div>
                <div className="popup-footer">
                    <button className="btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="btn-save" onClick={handleSave}>
                        <Check size={16} /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const Customers = () => {
    const { customers, addCustomer, updateCustomer, getCustomerByMobile } = useAppContext();
    const { toast } = useToast();
    const navigate = useNavigate();

    // Add form
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [errors, setErrors] = useState({});

    // Search & edit
    const [searchQuery, setSearchQuery] = useState('');
    const [editCustomer, setEditCustomer] = useState(null);

    const handleMobileChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
        setMobile(val);
        if (val && val.length !== 10) {
            setErrors(prev => ({ ...prev, mobile: 'Must be 10 digits' }));
        } else {
            setErrors(prev => { const n = { ...prev }; delete n.mobile; return n; });
        }
    };

    const handleSave = () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Customer name is required';
        if (!mobile) errs.mobile = 'Mobile number is required';
        else if (mobile.length !== 10) errs.mobile = 'Must be 10 digits';
        if (Object.keys(errs).length) { setErrors(errs); return toast.error('Fix errors before saving.'); }

        if (getCustomerByMobile(mobile)) {
            setErrors({ mobile: 'Mobile number already exists' });
            return toast.warning('Duplicate mobile number.');
        }

        addCustomer({ name: name.trim(), mobile, category: 'RETAIL', primary_category: 'CASH' });
        toast.success(`${name.trim()} saved successfully!`);
        setName(''); setMobile(''); setErrors({});
    };

    const handleEditSave = (id, updates) => {
        updateCustomer(id, updates);
        setEditCustomer(null);
        toast.success('Customer updated.');
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = () => {
        if (customers.length === 0) return toast.info('No customers to export.');
        const rows = customers.map(c => ({
            'Name': c.name,
            'Mobile': c.mobile,
            'Cash Balance (₹)': fmt(c.cashBalance),
            'Gold Balance (g)': fmtG(c.goldBalance),
            'Silver Balance (g)': fmtG(c.silverBalance),
            'Due Date': c.due_date ? new Date(c.due_date).toLocaleDateString() : '',
            'Registered On': c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        const today = new Date().toISOString().slice(0, 10);
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/octet-stream' }), `JJ_Customers_${today}.xlsx`);
        toast.success('Exported successfully.');
    };

    // Only show results when there is a search query
    const searchResults = searchQuery.trim()
        ? customers.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.mobile.includes(searchQuery)
        )
        : [];

    return (
        <div className="customers-container animate-fade-in" style={{ paddingBottom: '80px' }}>

            {/* ── Header ── */}
            <div className="cust-page-header">
                <button className="icon-btn" onClick={() => navigate('/')} style={{ color: 'var(--text-secondary)' }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Customer Management</h2>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {customers.length} customer{customers.length !== 1 ? 's' : ''} registered
                    </p>
                </div>
                <button className="cust-export-btn" onClick={handleExport} title="Export customers to Excel">
                    <Download size={15} /> Export
                </button>
            </div>

            {/* ── Add New Customer ── */}
            <div className="cust-form-card">
                <div className="cust-form-title">Add New Customer</div>
                <div className="cust-form-body">
                    <div className="amount-grid">
                        <div className="form-group">
                            <label>Mobile No</label>
                            <input
                                type="tel"
                                placeholder="10-digit number"
                                value={mobile}
                                onChange={handleMobileChange}
                                maxLength={10}
                                inputMode="numeric"
                            />
                            {errors.mobile && <span className="cust-error">{errors.mobile}</span>}
                        </div>
                        <div className="form-group">
                            <label>Customer Name</label>
                            <input
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={e => {
                                    setName(e.target.value);
                                    if (e.target.value.trim()) setErrors(p => { const n = { ...p }; delete n.name; return n; });
                                }}
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                            />
                            {errors.name && <span className="cust-error">{errors.name}</span>}
                        </div>
                    </div>
                </div>
                <div className="cust-form-footer">
                    <button className="btn-save" style={{ flex: 1 }} onClick={handleSave}>
                        <Check size={18} /> Save Customer
                    </button>
                </div>
            </div>

            {/* ── Search Customers ── */}
            <div style={{ marginTop: '1.5rem' }}>
                <div className="search-bar">
                    <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="Search by name or mobile..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Results — only shown when typing */}
                {searchQuery.trim() ? (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {searchResults.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.9rem' }}>
                                No customers match "<strong>{searchQuery}</strong>"
                            </div>
                        ) : (
                            <>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, margin: '0 0 0.25rem' }}>
                                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                                </p>
                                {searchResults.map(c => (
                                    <div key={c.id} className="cust-list-item">
                                        {/* Name + mobile — click to open ledger */}
                                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                                            <div style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>{c.mobile}</div>
                                        </div>

                                        {/* Balances */}
                                        <div style={{ textAlign: 'right', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer', marginRight: '0.5rem' }} onClick={() => navigate(`/customers/${c.id}`)}>
                                            {c.cashBalance !== 0 && (
                                                <span style={{ color: parseFloat(c.cashBalance) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                    ₹{fmt(Math.abs(c.cashBalance))} {parseFloat(c.cashBalance) >= 0 ? 'CR' : 'DR'}
                                                </span>
                                            )}
                                            {parseFloat(c.goldBalance) !== 0 && (
                                                <span style={{ color: '#eab308', fontWeight: 600 }}>
                                                    {fmtG(Math.abs(c.goldBalance))}g Au {parseFloat(c.goldBalance) >= 0 ? 'CR' : 'DR'}
                                                </span>
                                            )}
                                            {parseFloat(c.silverBalance) !== 0 && (
                                                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                                                    {fmtG(Math.abs(c.silverBalance))}g Ag {parseFloat(c.silverBalance) >= 0 ? 'CR' : 'DR'}
                                                </span>
                                            )}
                                            {c.cashBalance === 0 && c.goldBalance === 0 && c.silverBalance === 0 && (
                                                <span style={{ color: 'var(--text-muted)' }}>Settled</span>
                                            )}
                                        </div>

                                        {/* Edit */}
                                        <button
                                            className="cust-edit-btn"
                                            onClick={e => { e.stopPropagation(); setEditCustomer(c); }}
                                            title="Edit customer"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '1.25rem' }}>
                        Type a name or mobile number to search
                    </p>
                )}
            </div>

            {/* ── Edit Modal ── */}
            {editCustomer && (
                <EditCustomerModal
                    customer={editCustomer}
                    onSave={(updates) => handleEditSave(editCustomer.id, updates)}
                    onClose={() => setEditCustomer(null)}
                />
            )}
        </div>
    );
};

export default Customers;
