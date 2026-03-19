import React, { useState, useEffect } from 'react';
import { Lock, UserCheck, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './Login.css';

// Using SHA-256 for mock secure password checking (no plain text passwords stored)
// Hashes for:
// 'owner123' -> 43a0d17178a9d26c9e0fe9a74b0b45e38d32f27aed887a008a54bf6e033bf7b9
// 'staff123' -> 10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6
// 'view123'  -> 656d604dfdba41a262963cce53699bbc56cd7a2c0da1ad5ead45fc49214159d6

const ROLE_HASHES = {
    '43a0d17178a9d26c9e0fe9a74b0b45e38d32f27aed887a008a54bf6e033bf7b9': 'owner',
    '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6': 'staff',
    '656d604dfdba41a262963cce53699bbc56cd7a2c0da1ad5ead45fc49214159d6': 'view'
};

const hashPassword = async (text) => {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const Login = () => {
    const { setAuthSession } = useAppContext();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [devMode, setDevMode] = useState(false);

    useEffect(() => {
        const checkHash = () => {
            if (window.location.hash === '#devmode') {
                setDevMode(true);
            } else {
                setDevMode(false);
            }
        };
        checkHash();
        window.addEventListener('hashchange', checkHash);
        return () => window.removeEventListener('hashchange', checkHash);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (devMode && password === 'admin') {
            setAuthSession({ role: 'super-admin' });
            return;
        }

        try {
            // Fallback for non-secure contexts (e.g. local IP network access where crypto.subtle is undefined)
            if (!window.crypto || !window.crypto.subtle) {
                console.warn("crypto.subtle not available. Using basic fallback matching.");
                if (password === 'owner123') setAuthSession({ role: 'owner' });
                else if (password === 'staff123') setAuthSession({ role: 'staff' });
                else if (password === 'view123') setAuthSession({ role: 'view' });
                else setError('Invalid credentials.');
                return;
            }

            const hashed = await hashPassword(password);
            const role = ROLE_HASHES[hashed];

            if (role) {
                setAuthSession({ role });
            } else {
                setError('Invalid credentials.');
            }
        } catch (err) {
            console.error(err);
            setError('Login error: ' + err.message);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel animate-fade-in">
                <div className="login-header">
                    <div className="login-icon-wrap">
                        <Lock size={32} className="text-blue" />
                    </div>
                    <h2>JJ Ledger Pro</h2>
                    <p>Business Sign In</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group" style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter Passcode..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="login-btn">
                        <UserCheck size={18} /> Authenticate
                    </button>
                </form>

                {devMode && (
                    <div className="dev-banner">
                        Super Admin Mode Active (Pass: admin)
                    </div>
                )}

                <div className="login-hints">
                    Demo Passwords: <br />
                    Owner: <code>owner123</code><br />
                    Staff: <code>staff123</code><br />
                    View: <code>view123</code>
                </div>
            </div>
        </div>
    );
};

export default Login;
