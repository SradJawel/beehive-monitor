// Supabase Configuration
const SUPABASE_URL = 'https://mafzunpomznrjvdxvknc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Types
export interface Hive {
  id: number;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export interface Reading {
  id: number;
  hive_id: number;
  temperature: number;
  humidity: number;
  weight: number;
  recorded_at: string;
}

export interface LvdSettings {
  id: number;
  disconnect_voltage: number;
  reconnect_voltage: number;
  is_enabled: boolean;
  updated_at: string;
}

export interface LvdStatus {
  id: number;
  battery_voltage: number;
  battery_percent: number;
  is_connected: boolean;
  recorded_at: string;
}

export interface User {
  id: number;
  username: string;
  password: string;
}

// Supabase fetch helper
async function supabaseFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers as Record<string, string> || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Auth API
export const authApi = {
  login: async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      const users = await supabaseFetch(`users?username=eq.${username}&password=eq.${password}`);
      if (users && users.length > 0) {
        localStorage.setItem('user', JSON.stringify(users[0]));
        return { success: true, user: users[0] };
      }
      return { success: false, error: 'Invalid username or password' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  logout: () => {
    localStorage.removeItem('user');
  },

  getUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  changePassword: async (userId: number, newPassword: string): Promise<boolean> => {
    try {
      await supabaseFetch(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  }
};

// Hives API
export const hivesApi = {
  getAll: async (): Promise<Hive[]> => {
    return await supabaseFetch('hives?order=id');
  },

  getById: async (id: number): Promise<Hive> => {
    const hives = await supabaseFetch(`hives?id=eq.${id}`);
    return hives[0];
  },

  update: async (id: number, data: Partial<Hive>): Promise<Hive> => {
    const result = await supabaseFetch(`hives?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return result[0];
  }
};

// Readings API
export const readingsApi = {
  getByHiveId: async (hiveId: number, limit: number = 100): Promise<Reading[]> => {
    return await supabaseFetch(`readings?hive_id=eq.${hiveId}&order=recorded_at.desc&limit=${limit}`);
  },

  getLatestByHiveId: async (hiveId: number): Promise<Reading | null> => {
    const readings = await supabaseFetch(`readings?hive_id=eq.${hiveId}&order=recorded_at.desc&limit=1`);
    return readings && readings.length > 0 ? readings[0] : null;
  },

  getAll: async (startDate?: string, endDate?: string, hiveId?: number): Promise<Reading[]> => {
    let query = 'readings?order=recorded_at.desc';
    
    if (hiveId) {
      query += `&hive_id=eq.${hiveId}`;
    }
    if (startDate) {
      query += `&recorded_at=gte.${startDate}`;
    }
    if (endDate) {
      query += `&recorded_at=lte.${endDate}T23:59:59`;
    }
    
    return await supabaseFetch(query);
  },

  create: async (data: Partial<Reading>): Promise<Reading> => {
    const result = await supabaseFetch('readings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return result[0];
  }
};

// LVD API
export const lvdApi = {
  getSettings: async (): Promise<LvdSettings> => {
    const settings = await supabaseFetch('lvd_settings?limit=1');
    return settings && settings.length > 0 ? settings[0] : null;
  },

  updateSettings: async (data: Partial<LvdSettings>): Promise<LvdSettings> => {
    const settings = await lvdApi.getSettings();
    if (settings) {
      const result = await supabaseFetch(`lvd_settings?id=eq.${settings.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...data, updated_at: new Date().toISOString() })
      });
      return result[0];
    }
    throw new Error('No LVD settings found');
  },

  getStatus: async (): Promise<LvdStatus | null> => {
    const status = await supabaseFetch('lvd_status?order=recorded_at.desc&limit=1');
    return status && status.length > 0 ? status[0] : null;
  },

  updateStatus: async (data: Partial<LvdStatus>): Promise<LvdStatus> => {
    const result = await supabaseFetch('lvd_status', {
      method: 'POST',
      body: JSON.stringify({ ...data, recorded_at: new Date().toISOString() })
    });
    return result[0];
  }
};

// Export API
export const exportApi = {
  downloadCSV: async (hiveId?: number, startDate?: string, endDate?: string): Promise<void> => {
    const readings = await readingsApi.getAll(startDate, endDate, hiveId);
    const hives = await hivesApi.getAll();
    
    // Create CSV content
    let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Recorded At\n';
    
    readings.forEach(reading => {
      const hive = hives.find(h => h.id === reading.hive_id);
      csv += `${hive?.name || 'Unknown'},${reading.temperature || ''},${reading.humidity || ''},${reading.weight || ''},${reading.recorded_at}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beehive-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};
