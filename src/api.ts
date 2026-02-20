// Supabase Configuration
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
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
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
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const username = localStorage.getItem('username') || 'admin';
    const users = await supabaseRequest('users', {
      query: `username=eq.${username}&password=eq.${currentPassword}&select=*`
    });
    
    if (!users || users.length === 0) {
      throw new Error('Current password is incorrect');
    }

    await supabaseRequest('users', {
      method: 'PATCH',
      query: `username=eq.${username}`,
      body: { password: newPassword }
    });
    
    return { success: true };
  }
};

// Hives API
export const hivesApi = {
  getAll: async () => {
    const hives = await supabaseRequest('hives', {
      query: 'select=*&order=id.asc'
    });
    
    // Get latest reading for each hive
    for (const hive of hives) {
      const readings = await supabaseRequest('readings', {
        query: `hive_id=eq.${hive.id}&order=recorded_at.desc&limit=1`
      });
      hive.latest_reading = readings?.[0] || null;
    }
    
    return hives;
  },

  getOne: async (id: number) => {
    const hives = await supabaseRequest('hives', {
      query: `id=eq.${id}&select=*`
    });
    return hives?.[0] || null;
  },

  update: async (id: number, data: { name: string }) => {
    await supabaseRequest('hives', {
      method: 'PATCH',
      query: `id=eq.${id}`,
      body: data
    });
    return { success: true };
  }
};

// Readings API
export const readingsApi = {
  getByHive: async (hiveId: number, range: string = '24h') => {
    let timeFilter = '';
    const now = new Date();
    
    if (range === '24h') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${yesterday.toISOString()}`;
    } else if (range === '7d') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${weekAgo.toISOString()}`;
    } else if (range === '30d') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      timeFilter = `&recorded_at=gte.${monthAgo.toISOString()}`;
    }

    return await supabaseRequest('readings', {
      query: `hive_id=eq.${hiveId}${timeFilter}&order=recorded_at.asc&select=*`
    });
  },

  create: async (data: { api_key: string; temperature: number; humidity?: number; weight?: number }) => {
    // Find hive by API key
    const hives = await supabaseRequest('hives', {
      query: `api_key=eq.${data.api_key}&select=id`
    });
    
    if (!hives || hives.length === 0) {
      throw new Error('Invalid API key');
    }

    const reading = {
      hive_id: hives[0].id,
      temperature: data.temperature,
      humidity: data.humidity || null,
      weight: data.weight || null,
      recorded_at: new Date().toISOString()
    };

    await supabaseRequest('readings', {
      method: 'POST',
      body: reading
    });

    return { success: true };
  }
};

// LVD API
export const lvdApi = {
  getStatus: async () => {
    const status = await supabaseRequest('lvd_status', {
      query: 'order=recorded_at.desc&limit=1'
    });
    return status?.[0] || { battery_voltage: 0, battery_percent: 0, is_connected: false };
  },

  getSettings: async () => {
    const settings = await supabaseRequest('lvd_settings', {
      query: 'limit=1'
    });
    return settings?.[0] || { disconnect_voltage: 3.3, reconnect_voltage: 3.5, is_enabled: true };
  },

  updateSettings: async (data: { disconnect_voltage: number; reconnect_voltage: number; is_enabled: boolean }) => {
    await supabaseRequest('lvd_settings', {
      method: 'PATCH',
      query: 'id=eq.1',
      body: {
        disconnect_voltage: data.disconnect_voltage,
        reconnect_voltage: data.reconnect_voltage,
        is_enabled: data.is_enabled,
        updated_at: new Date().toISOString()
      }
    });
    return { success: true };
  },

  postStatus: async (data: { battery_voltage: number; battery_percent: number; is_connected: boolean }) => {
    await supabaseRequest('lvd_status', {
      method: 'POST',
      body: {
        ...data,
        recorded_at: new Date().toISOString()
      }
    });
    return { success: true };
  }
};

// Export API
export const exportApi = {
  downloadCSV: async (hiveId: string, startDate: string, endDate: string) => {
    let query = `recorded_at=gte.${startDate}T00:00:00&recorded_at=lte.${endDate}T23:59:59&order=recorded_at.desc&select=*,hives(name)`;
    
    if (hiveId !== 'all') {
      query += `&hive_id=eq.${hiveId}`;
    }

    const readings = await supabaseRequest('readings', { query });
    
    // Get hive names
    const hives = await supabaseRequest('hives', { query: 'select=*' });
    const hiveMap = new Map(hives.map((h: { id: number; name: string }) => [h.id, h.name]));

    // Generate CSV
    const headers = ['Hive', 'Temperature (°C)', 'Humidity (%)', 'Weight (kg)', 'Recorded At'];
    const rows = readings.map((r: { hive_id: number; temperature: number; humidity: number; weight: number; recorded_at: string }) => [
      hiveMap.get(r.hive_id) || 'Unknown',
      r.temperature || '',
      r.humidity || '',
      r.weight || '',
      new Date(r.recorded_at).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beehive-export-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  }
};
