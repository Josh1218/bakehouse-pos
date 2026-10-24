import { useState } from 'react';
import { Croissant, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          /failed to fetch|network/i.test(signInError.message)
            ? 'Cannot reach Supabase. Check your internet connection.'
            : signInError.message
        );
      }
    } catch {
      setError('Cannot reach Supabase. Check your internet connection.');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-[100dvh] bg-stone-50 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4"
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
            <Croissant className="w-7 h-7 text-stone-900" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Bakehouse POS</h1>
          <p className="text-sm text-stone-500">Sign in to continue</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-stone-900 font-semibold py-2.5 rounded-lg transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
