import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui/Primitives';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ui/Toast';
import { Database, Trash2, ArrowLeft } from 'lucide-react';

const Settings = () => {
    const { seedDummyData } = useAppContext();
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleSeed = () => {
        const msg = seedDummyData();
        toast.success(msg);
    };

    const handleClearData = () => {
        // Clear both old and new storage keys
        const keys = [
            'bt_customers', 'bt_transactions', 'bt_retail', 'bt_bullion', 'bt_silver', 'bt_chit',
            'bullionTracker_customers', 'bullionTracker_transactions', 'bullionTracker_retail',
            'bullionTracker_bullion', 'bullionTracker_silver', 'bullionTracker_chit',
        ];
        keys.forEach(k => localStorage.removeItem(k));
        toast.info('All data cleared. Reload the app to reset.');
    };

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

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
                        <h3 style={{ marginBottom: '0.5rem', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Trash2 size={16} /> Danger Zone
                        </h3>
                        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Permanently clear all stored data from this device. This cannot be undone.
                        </p>
                        <Button variant="danger" onClick={handleClearData}>
                            Clear All Data
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Settings;
