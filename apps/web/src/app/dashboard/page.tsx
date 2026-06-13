'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import { SessionResponse } from '@vsp/shared';
import {
  Video, History, Power, Copy, Check, ExternalLink, Download, Film, RefreshCw, LogOut
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, setUser, setActiveSession } = useAppStore();

  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [createdSession, setCreatedSession] = useState<SessionResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'CUSTOMER') {
      router.push('/login');
      return;
    }
    fetchSessionHistory();
  }, [user]);

  const fetchSessionHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<SessionResponse[]>('/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Failed to load session history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const data = await api.post<SessionResponse>('/sessions');
      setCreatedSession(data);
    } catch (err) {
      alert('Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCall = async (sessionId: string) => {
    try {
      const joinData = await api.post<{ livekitToken: string; participantId: string }>(
        `/sessions/${sessionId}/join-agent`
      );
      
      setActiveSession(sessionId, joinData.livekitToken, joinData.participantId);
      router.push(`/call/${sessionId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to join session');
    }
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/login');
  };

  const inviteUrl = createdSession
    ? `${window.location.origin}/join/${createdSession.inviteToken}`
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-[#070913] text-white">
      {/* Background mesh glow */}
      <div className="bg-mesh" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0f132a]/40 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 text-white font-bold text-lg">
                V
              </div>
              <span className="font-semibold text-lg tracking-wide glow-text-purple">
                Video Support Hub
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200">{user?.email}</p>
                <p className="text-xs text-slate-500 font-semibold">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Create Session Section */}
        <section className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Launch Customer Support Session
            </h2>
            <p className="text-slate-400 text-sm max-w-xl">
              Create a call link instantly, send it to a customer, and conduct a visual support query with real-time video, audio, text messaging, and screen controls.
            </p>
          </div>
          <div>
            <button
              onClick={handleCreateSession}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 font-bold text-white glow-btn-purple transition-all disabled:opacity-50"
            >
              <Video className="h-5 w-5" />
              {loading ? 'Creating Session...' : 'Create Support Call'}
            </button>
          </div>
        </section>

        {/* Invite Link Modal overlay if session created */}
        {createdSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg glass-panel-glow p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-white">Call Session Ready</h3>
                <button
                  onClick={() => setCreatedSession(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-slate-300 text-sm">
                  Send this invite link to the customer so they can join the support call:
                </p>

                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                  <span className="truncate text-sm text-violet-400 font-mono flex-1">
                    {inviteUrl}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-900"
                    title="Copy Link"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Invite Token: </span>
                  <span className="font-mono text-cyan-400">{createdSession.inviteToken}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleLaunchCall(createdSession.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 py-3 font-semibold text-white glow-btn-purple"
                >
                  <Video className="h-4 w-4" />
                  Launch Call Screen
                </button>
                <button
                  onClick={() => setCreatedSession(null)}
                  className="px-5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sessions History / Library */}
        <section className="glass-panel p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-violet-400" />
              <h3 className="text-xl font-bold">Session History & Recordings</h3>
            </div>
            <button
              onClick={fetchSessionHistory}
              disabled={historyLoading}
              className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-900"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {historyLoading ? 'Loading logs...' : 'No call sessions created yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#0f132a]/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Session ID</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created At</th>
                    <th className="px-6 py-4">Recordings</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400 max-w-[150px] truncate">
                        {sess.id}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            sess.status === 'ACTIVE'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : sess.status === 'CREATED'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}
                        >
                          {sess.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(sess.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        {/* If session has ready recordings, show download. Placeholder support. */}
                        <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Film className="h-4 w-4 text-slate-500" />
                          Auto-Archived
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {sess.status !== 'ENDED' ? (
                          <button
                            onClick={() => handleLaunchCall(sess.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-violet-600/20 border border-violet-600/30 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/30 transition-all"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Resume
                          </button>
                        ) : (
                          <span className="text-slate-500 text-xs">Archived</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
