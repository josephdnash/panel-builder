import { useState } from 'react';
import { auth } from '../utils/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AuthScreen() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleAuthAction = async () => {
        setError('');
        if (!email || !password) {
            setError("Please enter an email and password.");
            return;
        }
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError("Please enter your email address above first.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            setError("Password reset email sent! Check your inbox."); 
        } catch (err) {
            setError(err.message.replace('Firebase: ', ''));
        }
    };

    return (
        <div className="fullscreen-overlay">
            <div className="auth-box">
                <h1 style={{ marginTop: 0, fontSize: '28px', color: 'white' }}>{isSignUp ? 'Create Account' : 'Log In'}</h1>
                <p style={{ color: '#a1a1aa', marginBottom: '24px' }}>Sign in to access your saved layouts.</p>

                {error && <div className="error-msg" style={{ color: error.includes('sent') ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

                <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#27272a', color: 'white' }}/>
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#27272a', color: 'white' }}/>
                
                <button onClick={handleAuthAction} style={{ width: '100%', padding: '12px', background: 'var(--accent-blue)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '16px' }}>
                    {isSignUp ? 'SIGN UP' : 'LOG IN'}
                </button>
                
                <div className="auth-toggle" onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#a1a1aa', fontSize: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: '8px' }}>
                    {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                </div>
                
                {!isSignUp && <div className="auth-forgot" onClick={handleResetPassword} style={{ color: '#a1a1aa', fontSize: '14px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px' }}>Forgot Password?</div>}

                <div className="auth-divider" style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: '#52525b', fontSize: '12px' }}>
                    <hr style={{ flex: 1, borderColor: '#3f3f46' }} />
                    <span style={{ padding: '0 10px' }}>OR</span>
                    <hr style={{ flex: 1, borderColor: '#3f3f46' }} />
                </div>

                <button className="google-btn" onClick={handleGoogleSignIn} style={{ width: '100%', padding: '12px', background: 'white', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}