'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, type MonitorItem, type UserProfile } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form thêm monitor mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadData = useCallback(async (authToken: string) => {
    try {
      const [userRes, monitorsRes] = await Promise.all([
        api.getMe(authToken),
        api.getMonitors(authToken),
      ]);
      setUser(userRes.data);
      setMonitors(monitorsRes.data);
    } catch {
      localStorage.removeItem('pingpulse_token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const savedToken = localStorage.getItem('pingpulse_token');
    if (!savedToken) {
      router.push('/login');
      return;
    }
    setToken(savedToken);
    loadData(savedToken);
  }, [loadData, router]);

  const handleLogout = () => {
    localStorage.removeItem('pingpulse_token');
    router.push('/login');
  };

  const handleCheckNow = async (id: number) => {
    if (!token) return;
    setPingingId(id);
    try {
      const res = await api.checkNow(token, id);
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                status: res.data.monitor.status,
                checks: [res.data.check],
              }
            : m
        )
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Kiểm tra thất bại');
    } finally {
      setPingingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('Bạn có chắc muốn xóa monitor này?')) return;
    setDeletingId(id);
    try {
      await api.deleteMonitor(token, id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setFormSubmitting(true);

    try {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      await api.createMonitor(token, {
        name: name.trim(),
        url: formattedUrl,
      });

      // Reload monitors
      const res = await api.getMonitors(token);
      setMonitors(res.data);
      setName('');
      setUrl('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Tạo monitor thất bại');
    } finally {
      setFormSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Đang tải PingPulse Dashboard...</span>
        </div>
      </div>
    );
  }

  const upCount = monitors.filter((m) => m.status === 'up').length;
  const downCount = monitors.filter((m) => m.status === 'down').length;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar username={user?.username} onLogout={handleLogout} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Header Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Bảng điều khiển Giám sát
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Theo dõi tình trạng hoạt động và độ trễ website theo thời gian thực
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={monitors.length >= 5}
            className="self-start sm:self-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-zinc-950 font-semibold text-sm transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
          >
            <span>+</span> Thêm Website {monitors.length >= 5 ? '(Đã đạt tối đa 5)' : ''}
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Tổng số website</div>
            <div className="text-2xl font-bold text-white mt-1">
              {monitors.length} <span className="text-xs text-zinc-500 font-normal">/ 5 tối đa</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs font-medium text-emerald-400">Đang hoạt động (UP)</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{upCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs font-medium text-rose-400">Bị sự cố (DOWN)</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{downCount}</div>
          </div>
        </div>

        {/* Form thêm Monitor mới */}
        {showAddForm && (
          <div className="mb-8 p-6 rounded-xl bg-zinc-900/80 border border-emerald-500/30 shadow-xl animate-in fade-in">
            <h2 className="text-lg font-semibold text-white mb-3">Thêm website mới cần theo dõi</h2>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateMonitor} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Tên website</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Google Search"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">URL (Địa chỉ web)</label>
                <input
                  type="text"
                  required
                  placeholder="https://google.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm transition-colors"
                >
                  {formSubmitting ? 'Đang thêm...' : 'Lưu Website'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Danh sách Monitor */}
        <div className="space-y-3">
          {monitors.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
              <p className="text-zinc-400 text-sm">Chưa có website nào được theo dõi.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
              >
                + Thêm website đầu tiên
              </button>
            </div>
          ) : (
            monitors.map((item) => {
              const latestCheck = item.checks[0];
              const isUp = item.status === 'up';
              const isDown = item.status === 'down';
              const isUnknown = !isUp && !isDown;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    {/* Status Dot */}
                    <div
                      className={`w-3 h-3 rounded-full mt-1 sm:mt-0 flex-shrink-0 ${
                        isUp
                          ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                          : isDown
                          ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                          : 'bg-zinc-600'
                      }`}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-base">{item.name}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            isUp
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isDown
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-400 hover:text-emerald-400 underline-offset-2 hover:underline truncate block max-w-xs sm:max-w-md mt-0.5"
                      >
                        {item.url}
                      </a>
                    </div>
                  </div>

                  {/* Right side: Latency + Checked time + Action buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-800/60">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-zinc-200">
                        {latestCheck?.latency_ms !== null && latestCheck?.latency_ms !== undefined
                          ? `${latestCheck.latency_ms} ms`
                          : '-- ms'}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {latestCheck?.checked_at
                          ? new Date(latestCheck.checked_at).toLocaleTimeString('vi-VN')
                          : 'Chưa check'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCheckNow(item.id)}
                        disabled={pingingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                      >
                        {pingingId === item.id ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>Đang ping...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>Check Now</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Xóa Monitor"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
