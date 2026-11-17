'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type MonitorItem,
  type UserProfile,
  type PaginationInfo,
  type MonitorStats,
  type CheckRecord,
} from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form thêm monitor mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Modal xem chi tiết Monitor (Stats + Checks Cursor Pagination)
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorItem | null>(null);
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null);
  const [monitorChecks, setMonitorChecks] = useState<CheckRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingMoreChecks, setLoadingMoreChecks] = useState(false);

  const loadMonitors = async (authToken: string, targetPage = 1) => {
    try {
      const res = await api.getMonitors(authToken, targetPage, 10);
      setMonitors(res.data.items);
      setPagination(res.data.pagination);
      setPage(res.data.pagination.page);
    } catch (err: unknown) {
      console.error('Lỗi tải danh sách monitors:', err);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('pingpulse_token');
    if (!savedToken) {
      router.push('/login');
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        const [userRes, monitorsRes] = await Promise.all([
          api.getMe(savedToken),
          api.getMonitors(savedToken, 1, 10),
        ]);
        if (isMounted) {
          setToken(savedToken);
          setUser(userRes.data);
          setMonitors(monitorsRes.data.items);
          setPagination(monitorsRes.data.pagination);
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('pingpulse_token');
          router.push('/login');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [router]);

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
      if (token) {
        await loadMonitors(token, page);
      }
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
      await loadMonitors(token, 1);
      setName('');
      setUrl('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Tạo monitor thất bại');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Mở Drawer chi tiết Monitor
  const handleOpenDetail = async (monitor: MonitorItem) => {
    setSelectedMonitor(monitor);
    setLoadingDetails(true);
    setMonitorStats(null);
    setMonitorChecks([]);
    setNextCursor(null);
    setHasNextPage(false);

    if (!token) return;
    try {
      const [statsRes, checksRes] = await Promise.all([
        api.getMonitorStats(token, monitor.id).catch(() => null),
        api.getMonitorChecks(token, monitor.id, undefined, 10).catch(() => null),
      ]);
      if (statsRes) setMonitorStats(statsRes.data);
      if (checksRes) {
        setMonitorChecks(checksRes.data.items);
        setNextCursor(checksRes.data.pagination.nextCursor);
        setHasNextPage(checksRes.data.pagination.hasNextPage);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  // Tải thêm checks cũ hơn (Cursor Pagination)
  const handleLoadMoreChecks = async () => {
    if (!token || !selectedMonitor || !nextCursor || loadingMoreChecks) return;
    setLoadingMoreChecks(true);
    try {
      const res = await api.getMonitorChecks(token, selectedMonitor.id, nextCursor, 10);
      setMonitorChecks((prev) => [...prev, ...res.data.items]);
      setNextCursor(res.data.pagination.nextCursor);
      setHasNextPage(res.data.pagination.hasNextPage);
    } catch (err: unknown) {
      console.error('Lỗi tải thêm checks:', err);
    } finally {
      setLoadingMoreChecks(false);
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
              Theo dõi tình trạng hoạt động và độ trễ website theo thời gian thực (Tuần 3: Index & Pagination)
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={monitors.length >= 5}
            className="self-start sm:self-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-zinc-950 font-semibold text-sm transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <span>+</span> Thêm Website {monitors.length >= 5 ? '(Đã đạt tối đa 5)' : ''}
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs font-medium text-zinc-400">Tổng số website</div>
            <div className="text-2xl font-bold text-white mt-1">
              {pagination?.total ?? monitors.length} <span className="text-xs text-zinc-500 font-normal">website</span>
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
                  className="flex-1 py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm transition-colors cursor-pointer"
                >
                  {formSubmitting ? 'Đang thêm...' : 'Lưu Website'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors cursor-pointer"
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
              const latestCheck = item.checks?.[0];
              const isUp = item.status === 'up';
              const isDown = item.status === 'down';

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 flex-1">
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

                  {/* Right side: Latency + Actions */}
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
                      {/* Nút xem chi tiết & thống kê (Mới của Tuần 3) */}
                      <button
                        onClick={() => handleOpenDetail(item)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Xem thống kê Uptime & Lịch sử Checks"
                      >
                        <span>📊</span>
                        <span className="hidden sm:inline">Lịch sử</span>
                      </button>

                      <button
                        onClick={() => handleCheckNow(item.id)}
                        disabled={pingingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
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

        {/* Thanh phân trang Offset (Monitor List) */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <div>
              Trang <span className="text-white font-medium">{pagination.page}</span> / {pagination.totalPages} ({pagination.total} monitors)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => token && loadMonitors(token, pagination.page - 1)}
                className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 transition-colors text-zinc-200 cursor-pointer"
              >
                ← Trang trước
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => token && loadMonitors(token, pagination.page + 1)}
                className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 disabled:opacity-40 hover:bg-zinc-800 transition-colors text-zinc-200 cursor-pointer"
              >
                Trang sau →
              </button>
            </div>
          </div>
        )}

        {/* Modal Thống kê & Lịch sử Checks (Cursor Pagination + Stats API) */}
        {selectedMonitor && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              {/* Header Modal */}
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedMonitor.name}
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        selectedMonitor.status === 'up'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {selectedMonitor.status}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{selectedMonitor.url}</p>
                </div>
                <button
                  onClick={() => setSelectedMonitor(null)}
                  className="text-zinc-400 hover:text-white p-1 text-lg rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body Modal */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 1. Phần Thống Kê (Stats API - Tuần 3) */}
                <div>
                  <h4 className="text-xs uppercase font-semibold text-zinc-400 tracking-wider mb-2">
                    📊 Thống kê hiệu năng (Tận dụng Composite Index)
                  </h4>
                  {loadingDetails && !monitorStats ? (
                    <div className="text-xs text-zinc-500 py-3 animate-pulse">Đang tính toán thống kê...</div>
                  ) : monitorStats ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                        <div className="text-xs text-zinc-400 font-medium">Trong 24 giờ qua</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xl font-bold text-emerald-400">
                            {monitorStats.stats_24h.uptime_pct !== null ? `${monitorStats.stats_24h.uptime_pct}%` : '--'}
                          </span>
                          <span className="text-xs text-zinc-400">
                            ~{monitorStats.stats_24h.avg_latency_ms ?? '--'} ms
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-1">
                          Tổng {monitorStats.stats_24h.total_checks} lần check
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
                        <div className="text-xs text-zinc-400 font-medium">Trong 7 ngày qua</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xl font-bold text-emerald-400">
                            {monitorStats.stats_7d.uptime_pct !== null ? `${monitorStats.stats_7d.uptime_pct}%` : '--'}
                          </span>
                          <span className="text-xs text-zinc-400">
                            ~{monitorStats.stats_7d.avg_latency_ms ?? '--'} ms
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-1">
                          Tổng {monitorStats.stats_7d.total_checks} lần check
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">Chưa có dữ liệu thống kê</div>
                  )}
                </div>

                {/* 2. Phần Lịch Sử Checks (Cursor Pagination - Tuần 3) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs uppercase font-semibold text-zinc-400 tracking-wider">
                      📜 Lịch sử kiểm tra (Cursor Pagination)
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      Hiển thị {monitorChecks.length} lần check
                    </span>
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-800/50 text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-3">Trạng thái</th>
                          <th className="py-2.5 px-3">Mã HTTP</th>
                          <th className="py-2.5 px-3">Độ trễ</th>
                          <th className="py-2.5 px-3">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                        {monitorChecks.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-zinc-500">
                              {loadingDetails ? 'Đang tải lịch sử...' : 'Chưa có bản ghi nào'}
                            </td>
                          </tr>
                        ) : (
                          monitorChecks.map((check) => (
                            <tr key={check.id} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-3 font-medium">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    check.is_up
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : 'bg-rose-500/10 text-rose-400'
                                  }`}
                                >
                                  {check.is_up ? 'UP' : 'DOWN'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-zinc-400">{check.status_code ?? '--'}</td>
                              <td className="py-2.5 px-3">
                                {check.latency_ms !== null ? `${check.latency_ms} ms` : '--'}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-500">
                                {new Date(check.checked_at).toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Nút Load More với Cursor */}
                  {hasNextPage && (
                    <div className="mt-3 text-center">
                      <button
                        onClick={handleLoadMoreChecks}
                        disabled={loadingMoreChecks}
                        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-medium text-emerald-400 border border-zinc-700 transition-colors cursor-pointer"
                      >
                        {loadingMoreChecks ? 'Đang tải tiếp...' : '↓ Tải thêm 10 lần check cũ hơn (Cursor Pagination)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
