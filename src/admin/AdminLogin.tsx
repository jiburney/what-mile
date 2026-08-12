import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAdminAuth } from './useAdminAuth';
import './admin.css';

export function AdminLogin() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
