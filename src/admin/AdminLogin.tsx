import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAdminAuth } from './useAdminAuth';
import './admin.css';

export function AdminLogin() {
  const { signIn } = useAdminAuth();
  const [passwordGatePassed, setPasswordGatePassed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  const needsPasswordGate = !!adminPassword && !import.meta.env.DEV;

  const handlePasswordGate = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPassword) {
      setPasswordGatePassed(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  // Show password gate first if configured
  if (needsPasswordGate && !passwordGatePassed) {
    return (
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={handlePasswordGate}>
          <h1 className="admin-login-title">What Mile? Admin</h1>
          <input
            type="password"
            className="admin-input"
            placeholder="Admin password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            autoFocus
          />
          {error && <div className="admin-error">{error}</div>}
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </form>
      </div>
    );
  }

  // Show Supabase login
  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSignIn}>
        <h1 className="admin-login-title">What Mile? Admin</h1>
        <input
          type="email"
          className="admin-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          className="admin-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="admin-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
