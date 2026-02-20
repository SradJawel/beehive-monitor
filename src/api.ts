// Supabase Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mafzunpomznrjvdxvknc.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const headers = () => ({
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

async function supabaseGet(table: string, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

async function supabasePost(table: string, data: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

async function supabaseUpdate(table: string, query: string, data: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const users = await supabaseGet('users', `username=eq.${username}&password=eq.${password}`);
    if (users.length === 0) throw new Error('Invalid credentials');
    const token = btoa(JSON.stringify({ username, time: Date.now() }));
    return { token, user: { username } };
  }
};

// Hives API
export const hivesApi = {
  getAll: async () => {
    const hives = await supabaseGet('hives', 'order=id');
    // Get latest reading for each hive
    for (const hive of hives) {
      const readings = await supabaseGet('readings', `hive_id=eq.${hive.id}&order=recorded_at.desc&limit=1`);
      hive.latest_reading = readings[0] || null;
    }
    return hives;
  },
  update: async (id: number, data: { name: string }) => {
    return supabaseUpdate('hives', `id=eq.${id}`, data);
  }
};

// Readings API
export const readingsApi = {
  getByHive: async (hiveId: number, days = 1) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return supabaseGet('readings', `hive_id=eq.${hiveId}&recorded_at=gte.${since}&order=recorded_at.desc`);
  },
  create: async (data: { hive_id: number; temperature: number; humidity?: number; weight?: number }) => {
    return supabasePost('readings', { ...data, recorded_at: new Date().toISOString() });
  }
};

// LVD API
export const lvdApi = {
  getSettings: async () => {
    const settings = await supabaseGet('lvd_settings', 'limit=1');
    return settings[0] || { disconnect_voltage: 3.3, reconnect_voltage: 3.5, is_enabled: true };
  },
  updateSettings: async (data: { disconnect_voltage: number; reconnect_voltage: number; is_enabled: boolean }) => {
    return supabaseUpdate('lvd_settings', 'id=eq.1', { ...data, updated_at: new Date().toISOString() });
  },
  getStatus: async () => {
    const status = await supabaseGet('lvd_status', 'order=recorded_at.desc&limit=1');
    return status[0] || { battery_voltage: 0, battery_percent: 0, is_connected: false };
  }
};

// Export API
export const exportApi = {
  getCsv: async (hiveId: string, startDate: string, endDate: string) => {
    let query = `recorded_at=gte.${startDate}T00:00:00&recorded_at=lte.${endDate}T23:59:59&order=recorded_at.desc`;
    if (hiveId !== 'all') {
      query += `&hive_id=eq.${hiveId}`;
    }
    const readings = await supabaseGet('readings', query);
    const hives = await supabaseGet('hives', 'order=id');

    // Build CSV
    let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Recorded At\n';
    for (const r of readings) {
      const hive = hives.find((h: { id: number; name: string }) => h.id === r.hive_id);
      csv += `${hive?.name || 'Unknown'},${r.temperature || ''},${r.humidity || ''},${r.weight || ''},${r.recorded_at}\n`;
    }
    return csv;
  }
};

// Users API
export const usersApi = {
  changePassword: async (currentPassword: string, newPassword: string) => {
    const users = await supabaseGet('users', `username=eq.admin&password=eq.${currentPassword}`);
    if (users.length === 0) throw new Error('Current password is wrong');
    return supabaseUpdate('users', 'username=eq.admin', { password: newPassword });
  }
};
