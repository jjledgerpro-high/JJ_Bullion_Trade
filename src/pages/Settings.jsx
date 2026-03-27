import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui/Primitives';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Database, Trash2, ArrowLeft } from 'lucide-react';

const Settings = () => {
    const { seedDummyData, authSession } = useAppContext();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isOwner = authSession?.role === 'owner' || authSession?.role === 'super-admin';

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    const handleSeed = () => {
        const msg = seedDummyData();
        toast.success(msg);
    };

    const handleClearData = () => {
        if (deleteInput !== 'DELETE') return;
        const keys = [
            'bt_customers', 'bt_transactions', 'bt_retail', 'bt_bullion', 'bt_silver', 'bt_chit',
            'bullionTracker_customers', 'bullionTracker_transactions', 'bullionTracker_retail',
            'bullionTracker_bullion', 'bullionTracker_silver', 'bullionTracker_chit',
        ];
        keys.forEach(k => localStorage.removeItem(k));
        setShowDeleteConfirm(false);
        setDeleteInput('');
        toast.info('All data cleared. Reload the app to reset.');
    };

    const closeConfirm = () => { setShowDeleteConfirm(false); setDeleteInput(''); };

    return (
        <div className="module-container animate-fade-in" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <Card className="glass-card" style={{ padding: '2rem' }}>
                <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    Application Settings
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div>
                        <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={16} /> Development Tools
                        </h3>
                        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Populate the app with sample customers, trades, and bills to explore the ledger functions.
                            This will overwrite existing data.
                        </p>
                        <Button variant="primary" onClick={handleSeed}>
                            Load Dummy Data
                        </Button>
                    </div>

                    {isOwner && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
                            <h3 style={{ marginBottom: '0.5rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Trash2 size={16} /> Danger Zone
                            </h3>
                            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Permanently clear all stored data from this device. This cannot be undone.
                            </p>
                            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                                Clear All Data
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div
                    className="popup-overlay animate-fade-in"
                    onClick={closeConfirm}
                    style={{ zIndex: 1100 }}
                >
                    <div
                        className="glass-panel slide-up"
                        onClick={e => e.stopPropagation()}
                        style={{ maxWidth: '380px', width: '90%', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                            <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Delete All Data?</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                This will permanently delete all customers and transactions from this device. <strong>This cannot be undone.</strong>
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                Type <span style={{ fontFamily: 'monospace', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>DELETE</span> to confirm:
                            </p>
                            <input
                                type="text"
                                value={deleteInput}
                                onChange={e => setDeleteInput(e.target.value)}
                                placeholder="Type DELETE here"
                                autoFocus
                                style={{
                                    width: '100%', padding: '0.6rem 0.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${deleteInput === 'DELETE' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '8px', color: 'var(--text-primary)',
                                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleClearData}
                                disabled={deleteInput !== 'DELETE'}
                                style={{
                                    flex: 1, padding: '0.65rem',
                                    background: deleteInput === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.2)',
                                    border: '1px solid rgba(239,68,68,0.4)',
                                    borderRadius: '8px',
                                    color: deleteInput === 'DELETE' ? '#fff' : 'rgba(239,68,68,0.5)',
                                    cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed',
                                    fontSize: '0.875rem', fontWeight: 700
                                }}
                            >
                                Confirm Delete
                            </button>
                            <button
                                onClick={closeConfirm}
                                style={{
                                    flex: 1, padding: '0.65rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem', fontWeight: 500
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
