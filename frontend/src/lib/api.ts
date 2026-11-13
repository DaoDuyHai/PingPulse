const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface CheckRecord {
  id: number;
  monitor_id: number;
  is_up: boolean;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  checked_at: string;
}

export interface MonitorItem {
  id: number;
  name: string;
  url: string;
  interval_sec: number;
  status: 'up' | 'down' | 'unknown' | string;
  created_at: string;
  checks: CheckRecord[];
}

export interface UserProfile {
  username: string;
  email: string;
  created_at: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data.error || data.message || `Lỗi máy chủ (${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // 1. Auth
  async register(payload: { username: string; email: string; password: string }) {
    return request<{ message: string; data: { id: number; username: string; email: string } }>(
      '/users/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async login(payload: { username: string; password: string }) {
    return request<{ message: string; token: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe(token: string) {
    return request<{ message: string; data: UserProfile }>('/users/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  // 2. Monitors
  async getMonitors(token: string) {
    return request<{ message: string; data: MonitorItem[] }>('/monitors', {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async createMonitor(
    token: string,
    payload: { name: string; url: string; interval_sec?: number }
  ) {
    return request<{ message: string; data: MonitorItem }>('/monitors', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  },

  async checkNow(token: string, monitorId: number) {
    return request<{
      message: string;
      data: { monitor: MonitorItem; check: CheckRecord };
    }>(`/monitors/${monitorId}/check`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  async deleteMonitor(token: string, monitorId: number) {
    return request<{ message: string }>(`/monitors/${monitorId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
