'use client';

import { useState, useEffect } from 'react';

/**
 * Password gate — prompts once per browser session.
 * Stores the password in sessionStorage so it can be sent with API requests.
 * If no NEXT_PUBLIC_PASSWORD_REQUIRED flag is set, renders children immediately.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If already entered this session, skip
    const stored = sessionStorage.getItem('site-password');
    if (stored) {
      setAuthorized(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sessionStorage.setItem('site-password', input.trim());
    setAuthorized(true);
    setError(false);
  };

  if (checking) return null;

  if (authorized) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 px-6">
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Airbitrage</h1>
          <p className="text-sm text-[var(--text-tertiary)]">Enter password to continue</p>
        </div>

        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          placeholder="Password"
          autoFocus
          className="w-full px-3 py-2.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        />

        {error && (
          <p className="text-xs text-[var(--color-danger)]">Incorrect password</p>
        )}

        <button
          type="submit"
          className="w-full py-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          Enter
        </button>
      </form>
    </div>
  );
}
