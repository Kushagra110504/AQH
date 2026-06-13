'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../../store/useAppStore';
import { api } from '../../../lib/api';
import { Role } from '@vsp/shared';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function JoinPage({ params }: PageProps) {
  const router = useRouter();
  const { token } = use(params);
  const { setUser, setActiveSession } = useAppStore();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.post<{
        accessToken: string;
        livekitToken: string;
        participantId: string;
        sessionId: string;
      }>('/sessions/join-customer', {
        name,
        inviteToken: token,
      });

      // Set customer credentials in local Zustand store
      setUser({
        id: data.participantId,
        email: `${name.replace(/\s+/g, '').toLowerCase()}@customer.vsp`,
        role: Role.CUSTOMER,
        token: data.accessToken,
      });

      setActiveSession(data.sessionId, data.livekitToken, data.participantId);
      router.push(`/call/${data.sessionId}`);
    } catch (err: any) {
      setError(err.message || 'Unable to join call. The link might be expired or invalid.');
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
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white glow-text-cyan">
            Join Support Call
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Your support agent is waiting for you in the call room
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="Enter your name (e.g. John Doe)"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 py-3 font-semibold text-white glow-btn-cyan disabled:opacity-50"
          >
            {loading ? 'Entering Call Room...' : 'Enter Call Room'}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            No app installations required. Live video will open directly in your web browser.
          </p>
        </div>
      </div>
    </div>
  );
}
