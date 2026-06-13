'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../lib/api';
import {
  Activity, Cpu, Layers, XCircle, RefreshCw, LogOut, Users, HardDrive
} from 'lucide-react';

interface SystemMetrics {
  cpuUsagePercent: number;
  memoryUsageMB: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
}

interface AdminDashboardData {
  activeSessions: number;
  activeParticipants: number;
  totalSessions: number;
  systemMetrics: SystemMetrics;
}

interface ActiveSessionDetails {
  id: string;
  status: string;
  createdAt: string;
  createdBy: { email: string };
  participants: Array<{ id: string; role: string }>;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, setUser } = useAppStore();

  const [metrics, setMetrics] = useState<AdminDashboardData | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/login');
      return;
    }

    fetchAdminData();
    // Poll metrics every 5 seconds
    const interval = setInterval(fetchAdminData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const metricsData = await api.get<AdminDashboardData>('/admin/dashboard-metrics');
      const sessionsData = await api.get<ActiveSessionDetails[]>('/admin/sessions');
      
      setMetrics(metricsData);
      setActiveSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    const confirmTerminate = window.confirm(
      'Are you sure you want to FORCE terminate this session? Everyone connected will be immediately disconnected.'
    );
    if (!confirmTerminate) return;

    setTerminatingId(sessionId);
    try {
      await api.post(`/admin/sessions/${sessionId}/terminate`);
      alert('Session terminated successfully.');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to terminate session.');
    } finally {
      setTerminatingId(null);
    }
  };

  const handleLogout = () => {
    setUser(null);
    router.push('/login');
  };

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#070913] text-white">
      {/* Background Mesh Glow */}
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
                Admin Console
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200">{user?.email}</p>
                <p className="text-xs text-red-400 font-bold tracking-wide">SYSTEM ADMINISTRATOR</p>
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
        {/* Title and stats refresh */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-violet-400" />
            Live System Monitoring
          </h2>
          <button
            onClick={() => {
              setLoading(true);
              fetchAdminData().finally(() => setLoading(false));
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Now
          </button>
        </div>

        {/* System metrics cards */}
        {metrics && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-panel p-5 space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Sessions</span>
                <Layers className="h-5 w-5 text-violet-400" />
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{metrics.activeSessions}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Realtime calls</p>
            </div>

            <div className="glass-panel p-5 space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Callers</span>
                <Users className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{metrics.activeParticipants}</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Presence streams</p>
            </div>

            <div className="glass-panel p-5 space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Server CPU Load</span>
                <Cpu className="h-5 w-5 text-violet-400" />
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{metrics.systemMetrics.cpuUsagePercent}%</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg core load</p>
            </div>

            <div className="glass-panel p-5 space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Node Memory</span>
                <HardDrive className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-white tracking-tight">{metrics.systemMetrics.memoryUsageMB} MB</p>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Heap allocation</p>
            </div>
          </div>
        )}

        {/* Active Session Management table */}
        <section className="glass-panel p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <Layers className="h-5 w-5 text-violet-400" />
            <h3 className="text-xl font-bold">Manage Active Sessions</h3>
          </div>

          {activeSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No support sessions are currently active.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#0f132a]/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Session ID</th>
                    <th className="px-6 py-4">Created By</th>
                    <th className="px-6 py-4">Joined Participants</th>
                    <th className="px-6 py-4">Session Age</th>
                    <th className="px-6 py-4 text-right">Emergency Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {activeSessions.map((sess) => {
                    const elapsed = Math.round(
                      (new Date().getTime() - new Date(sess.createdAt).getTime()) / 1000 / 60
                    );

                    return (
                      <tr key={sess.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-400 max-w-[180px] truncate">
                          {sess.id}
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-medium">
                          {sess.createdBy.email}
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {sess.participants.length} connected
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {elapsed} minutes
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleTerminateSession(sess.id)}
                            disabled={terminatingId === sess.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/10 border border-red-600/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {terminatingId === sess.id ? 'Terminating...' : 'Force Terminate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
