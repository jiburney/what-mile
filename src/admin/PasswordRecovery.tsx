import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import './admin.css';

// Catches Supabase's password-recovery redirect. The dashboard's "reset
// password" action always lands the user at the project's Site URL root
// with a #access_token=...&type=recovery fragment — it does not support a
// custom landing path — so this has to be checked before routing, not as a
// normal /admin/* route. See main.tsx.
export function PasswordRecovery() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // supabase-js parses the recovery token from the URL hash automatically
    // on client creation (detectSessionInUrl defaults to true) and fires
    // this event once that session is established. Don't show the form
    // until that's actually happened, or updateUser() below has nothing
    // to act on.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // If the event already fired before this component mounted (React
    // StrictMode double-invoke, or a slow mount), fall back to checking
    // for a session directly.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1 className="admin-login-title">Password updated</h1>
          <p style={{ color: 'var(--stone)', marginBottom: '20px', textAlign: 'center' }}>
            Your password has been changed.
          </p>
          <a href="/admin" className="btn-primary" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Go to Admin Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <div style={{ textAlign: 'center', color: 'var(--stone)' }}>
            Verifying reset link...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1 className="admin-login-title">Set a new password</h1>
        <input
          type="password"
          className="admin-input"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          minLength={8}
        />
        <input
          type="password"
          className="admin-input"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && <div className="admin-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
