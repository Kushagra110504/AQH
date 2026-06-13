'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import { Role } from '@vsp/shared';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((state) => state.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; role: Role };
      }>('/auth/login', { email, password });

      setUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        token: data.accessToken,
      });

      // Redirect based on role
      if (data.user.role === Role.ADMIN) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#070913] px-4">
      {/* Background Mesh Glow */}
      <div className="bg-mesh" />

      <div className="w-full max-w-md glass-panel-glow p-8 space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-white font-bold text-xl shadow-lg shadow-violet-500/20">
            V
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white glow-text-purple">
            Video Support
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Agent & Operations Login Portal
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="agent@vsp.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-3 font-semibold text-white glow-btn-purple disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            Evaluation: Admin (admin@vsp.com / AdminPass123!) <br />
            Agent (agent@vsp.com / AgentPass123!)
          </p>
        </div>
      </div>
    </div>
  );
}
