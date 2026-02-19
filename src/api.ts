/**
 * API Client for Bee Hive Backend
 */

import { API_URL } from './config';

// Types
export interface User {
  id: number;
  username: string;
}

export interface Hive {
  id: number;
  name: string;
  api_key?: string;
  sensor_mode: number;
  is_active: boolean;
  is_online: boolean;
  seconds_ago: number | null;
  latest: Reading | null;
  readings?: Reading[];
  stats?: HiveStats;
}

export interface Reading {
  id: number;
  hive_id: number;
  hive_name?: string;
  mcp_temp: number | null;
  hdc_temp: number | null;
  hdc_humidity: number | null;
  weight_kg: number | null;
  recorded_at: string;
  is_online?: boolean;
  seconds_ago?: number;
}

export interface HiveStats {
  temp: { avg: number | null; min: number | null; max: number | null };
  humidity: { avg: number | null };
  weight: { avg: number | null };
  readings_count: number;
}

export interface LVDData {
  id?: number;
  battery_voltage: number;
  battery_percent: number;
  lvd_status: boolean;
  solar_voltage: number | null;
  recorded_at?: string;
  is_online?: boolean;
}

export interface LVDSettings {
  disconnect_volt: number;
  reconnect_volt: number;
  lvd_enabled: boolean;
}

export interface ApiResponse<T> {
  status: 'ok' | 'error';
  message?: string;
  [key: string]: T | string | undefined;
}

// Token management
let authToken: string | null = localStorage.getItem('beehive_token');

export const setToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('beehive_token', token);
  } else {
    localStorage.removeItem('beehive_token');
  }
};

export const getToken = () => authToken;

// Fetch wrapper
async function fetchApi<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API error');
  }
  
  return data;
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const data = await fetchApi<{ status: string; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    return data;
  },
  
  logout: () => {
    setToken(null);
  },
  
  getMe: () => fetchApi<{ status: string; user: User }>('/api/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi<ApiResponse<void>>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// Hives API
export const hivesApi = {
  getAll: () => fetchApi<{ status: string; hives: Hive[] }>('/api/hives'),
  
  getOne: (id: number, range = '24h') => 
    fetchApi<{ status: string; hive: Hive }>(`/api/hives/${id}?range=${range}`),
  
  update: (id: number, name: string) =>
    fetchApi<{ status: string; hive: Hive }>(`/api/hives/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  
  regenerateKey: (id: number) =>
    fetchApi<{ status: string; api_key: string }>(`/api/hives/${id}/regenerate-key`, {
      method: 'POST',
    }),
};

// Readings API
export const readingsApi = {
  getAll: (params?: { hive_id?: number; start_date?: string; end_date?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.hive_id) queryParams.set('hive_id', params.hive_id.toString());
    if (params?.start_date) queryParams.set('start_date', params.start_date);
    if (params?.end_date) queryParams.set('end_date', params.end_date);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    return fetchApi<{ status: string; readings: Reading[] }>(`/api/readings?${queryParams}`);
  },
  
  getLatest: () => fetchApi<{ status: string; readings: Reading[] }>('/api/readings/latest'),
  
  getChart: (hours = 24, hive_id?: number) => {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (hive_id) params.set('hive_id', hive_id.toString());
    return fetchApi<{ status: string; readings: Reading[] }>(`/api/readings/chart?${params}`);
  },
};

// LVD API
export const lvdApi = {
  get: () => fetchApi<{ status: string; lvd: LVDData | null; settings: LVDSettings }>('/api/lvd'),
  
  getSettings: () => fetchApi<{ status: string } & LVDSettings>('/api/lvd/settings'),
  
  updateSettings: (settings: Partial<LVDSettings>) =>
    fetchApi<{ status: string; settings: LVDSettings }>('/api/lvd/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  
  getHistory: (hours = 24) =>
    fetchApi<{ status: string; readings: LVDData[] }>(`/api/lvd/history?hours=${hours}`),
};

// Export API
export const exportApi = {
  getStats: () => fetchApi<{ 
    status: string; 
    stats: { 
      total_readings: number; 
      first_reading: string; 
      last_reading: string;
    } 
  }>('/api/export/stats'),
  
  downloadCsv: async (params?: { hive_id?: string; start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.hive_id) queryParams.set('hive_id', params.hive_id);
    if (params?.start_date) queryParams.set('start_date', params.start_date);
    if (params?.end_date) queryParams.set('end_date', params.end_date);
    
    const response = await fetch(`${API_URL}/api/export/csv?${queryParams}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beehive_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },
};
