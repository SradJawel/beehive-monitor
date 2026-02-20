// Supabase API Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mafzunpomznrjvdxvknc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Helper function for Supabase requests
async function supabaseRequest(table: string, options: {
  method?: string;
  body?: unknown;
  query?: string;
} = {}) {
  const { method = 'GET', body, query = '' } = options;
  
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  // For DELETE or PATCH with no return
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const users = await supabaseRequest('users', {
      query: `username=eq.${username}&password=eq.${password}&select=*`
    });
    
    if (users && users.length > 0) {
      const token = btoa(JSON.stringify({ userId: users[0].id, username }));
      return { success: true, token, user: users[0] };
    }
    throw new Error('Invalid credentials');
  }
};

// Hives API
export const hivesApi = {
  getAll: async () => {
    return supabaseRequest('hives', { query: 'select=*&order=id' });
  },
  
  update: async (id: number, data: { name: string }) => {
    return supabaseRequest('hives', {
      method: 'PATCH',
      query: `id=eq.${id}`,
      body: data
    });
  },
  
  getReadings: async (hiveId: number, range: string = '24h') => {
    let timeFilter = '';
    const now = new Date();
    
    if (range === '24h') {
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${past.toISOString()}`;
    } else if (range === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${past.toISOString()}`;
    } else if (range === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${past.toISOString()}`;
    }
    
    return supabaseRequest('readings', {
      query: `hive_id=eq.${hiveId}${timeFilter}&order=recorded_at.desc&limit=100`
    });
  }
};

// Readings API
export const readingsApi = {
  getLatest: async () => {
    const hives = await hivesApi.getAll();
    const result: Record<number, unknown> = {};
    
    for (const hive of hives) {
      const readings = await supabaseRequest('readings', {
        query: `hive_id=eq.${hive.id}&order=recorded_at.desc&limit=1`
      });
      if (readings && readings.length > 0) {
        result[hive.id] = readings[0];
      }
    }
    
    return result;
  },
  
  create: async (data: { api_key: string; temperature: number; humidity?: number; weight?: number }) => {
    // Find hive by API key
    const hives = await supabaseRequest('hives', {
      query: `api_key=eq.${data.api_key}&select=id`
    });
    
    if (!hives || hives.length === 0) {
      throw new Error('Invalid API key');
    }
    
    return supabaseRequest('readings', {
      method: 'POST',
      body: {
        hive_id: hives[0].id,
        temperature: data.temperature,
        humidity: data.humidity || null,
        weight: data.weight || null,
        recorded_at: new Date().toISOString()
      }
    });
  }
};

// LVD API
export const lvdApi = {
  getStatus: async () => {
    const status = await supabaseRequest('lvd_status', {
      query: 'order=recorded_at.desc&limit=1'
    });
    return status && status.length > 0 ? status[0] : null;
  },
  
  getSettings: async () => {
    const settings = await supabaseRequest('lvd_settings', {
      query: 'limit=1'
    });
    return settings && settings.length > 0 ? settings[0] : null;
  },
  
  updateSettings: async (data: { disconnect_voltage: number; reconnect_voltage: number; is_enabled: boolean }) => {
    // Get existing settings ID
    const settings = await lvdApi.getSettings();
    if (settings) {
      return supabaseRequest('lvd_settings', {
        method: 'PATCH',
        query: `id=eq.${settings.id}`,
        body: { ...data, updated_at: new Date().toISOString() }
      });
    }
    return supabaseRequest('lvd_settings', {
      method: 'POST',
      body: data
    });
  },
  
  postStatus: async (data: { battery_voltage: number; battery_percent: number; is_connected: boolean }) => {
    return supabaseRequest('lvd_status', {
      method: 'POST',
      body: { ...data, recorded_at: new Date().toISOString() }
    });
  }
};

// Export API
export const exportApi = {
  downloadCSV: async (hiveId: string, startDate: string, endDate: string) => {
    let query = `recorded_at=gte.${startDate}T00:00:00&recorded_at=lte.${endDate}T23:59:59&order=recorded_at.desc`;
    
    if (hiveId !== 'all') {
      query += `&hive_id=eq.${hiveId}`;
    }
    
    const readings = await supabaseRequest('readings', { query: `select=*,hives(name)&${query}` });
    const hives = await hivesApi.getAll();
    const hiveMap: Record<number, string> = {};
    hives.forEach((h: { id: number; name: string }) => { hiveMap[h.id] = h.name; });
    
    // Generate CSV
    let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Recorded At\n';
    
    for (const r of readings) {
      const hiveName = hiveMap[r.hive_id] || 'Unknown';
      csv += `${hiveName},${r.temperature || ''},${r.humidity || ''},${r.weight || ''},${r.recorded_at}\n`;
    }
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beehive-export-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

// Settings API
export const settingsApi = {
  changePassword: async (currentPassword: string, newPassword: string) => {
    // Verify current password
    const users = await supabaseRequest('users', {
      query: `username=eq.admin&password=eq.${currentPassword}`
    });
    
    if (!users || users.length === 0) {
      throw new Error('Current password is incorrect');
    }
    
    // Update password
    return supabaseRequest('users', {
      method: 'PATCH',
      query: `id=eq.${users[0].id}`,
      body: { password: newPassword }
    });
  }
};
