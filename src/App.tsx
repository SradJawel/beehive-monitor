import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mafzunpomznrjvdxvknc.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Types
interface Hive {
  id: number;
  name: string;
  api_key: string;
  is_active: boolean;
}

interface Reading {
  id: number;
  hive_id: number;
  temperature: number;
  humidity: number;
  weight: number;
  recorded_at: string;
}

interface LvdSettings {
  id: number;
  disconnect_voltage: number;
  reconnect_voltage: number;
  is_enabled: boolean;
}

interface LvdStatus {
  id: number;
  battery_voltage: number;
  battery_percent: number;
  is_connected: boolean;
  recorded_at: string;
}

// Time ago helper
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Check if online (data within last 10 minutes)
function isOnline(date: string): boolean {
  const tenMinutes = 10 * 60 * 1000;
  return Date.now() - new Date(date).getTime() < tenMinutes;
}

// Get temperature color
function getTempColor(temp: number): string {
  if (temp > 38) return 'text-red-500';
  if (temp > 35) return 'text-yellow-500';
  return 'text-green-500';
}

export default function App() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // App state
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'hive' | 'export' | 'settings'>('dashboard');
  const [selectedHiveId, setSelectedHiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Data state
  const [hives, setHives] = useState<Hive[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [lvdSettings, setLvdSettings] = useState<LvdSettings | null>(null);
  const [lvdStatus, setLvdStatus] = useState<LvdStatus | null>(null);

  // Settings state
  const [hiveNames, setHiveNames] = useState<{[key: number]: string}>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [disconnectVoltage, setDisconnectVoltage] = useState('3.3');
  const [reconnectVoltage, setReconnectVoltage] = useState('3.5');
  const [lvdEnabled, setLvdEnabled] = useState(true);

  // Export state
  const [exportHiveId, setExportHiveId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Chart state
  const [chartPeriod, setChartPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [hiveReadings, setHiveReadings] = useState<Reading[]>([]);

  // Check login on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem('beehive_logged_in');
    if (loggedIn === 'true') {
      setIsLoggedIn(true);
    }
    // Set default dates for export
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Load data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadData();
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Load hive readings when viewing hive detail
  useEffect(() => {
    if (currentPage === 'hive' && selectedHiveId) {
      loadHiveReadings();
    }
  }, [currentPage, selectedHiveId, chartPeriod]);

  // Load all data
  async function loadData() {
    try {
      setLoading(true);
      setError('');

      // Load hives
      const { data: hivesData, error: hivesError } = await supabase
        .from('hives')
        .select('*')
        .order('id');
      
      if (hivesError) throw hivesError;
      setHives(hivesData || []);

      // Initialize hive names
      const names: {[key: number]: string} = {};
      (hivesData || []).forEach(h => { names[h.id] = h.name; });
      setHiveNames(names);

      // Load latest readings for each hive
      const { data: readingsData, error: readingsError } = await supabase
        .from('readings')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (readingsError) throw readingsError;
      setReadings(readingsData || []);

      // Load LVD settings
      const { data: lvdSettingsData, error: lvdSettingsError } = await supabase
        .from('lvd_settings')
        .select('*')
        .limit(1)
        .single();

      if (lvdSettingsError && lvdSettingsError.code !== 'PGRST116') {
        console.error('LVD settings error:', lvdSettingsError);
      }
      if (lvdSettingsData) {
        setLvdSettings(lvdSettingsData);
        setDisconnectVoltage(String(lvdSettingsData.disconnect_voltage));
        setReconnectVoltage(String(lvdSettingsData.reconnect_voltage));
        setLvdEnabled(lvdSettingsData.is_enabled);
      }

      // Load LVD status
      const { data: lvdStatusData, error: lvdStatusError } = await supabase
        .from('lvd_status')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (lvdStatusError && lvdStatusError.code !== 'PGRST116') {
        console.error('LVD status error:', lvdStatusError);
      }
      if (lvdStatusData) {
        setLvdStatus(lvdStatusData);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // Load readings for specific hive
  async function loadHiveReadings() {
    if (!selectedHiveId) return;

    try {
      let hoursAgo = 24;
      if (chartPeriod === '7d') hoursAgo = 168;
      if (chartPeriod === '30d') hoursAgo = 720;

      const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('readings')
        .select('*')
        .eq('hive_id', selectedHiveId)
        .gte('recorded_at', startTime)
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      setHiveReadings(data || []);
    } catch (err: any) {
      console.error('Failed to load hive readings:', err);
    }
  }

  // Login handler
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        setLoginError('Invalid username or password');
        return;
      }

      localStorage.setItem('beehive_logged_in', 'true');
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError('Login failed');
    }
  }

  // Logout handler
  function handleLogout() {
    localStorage.removeItem('beehive_logged_in');
    setIsLoggedIn(false);
    setCurrentPage('dashboard');
  }

  // Get latest reading for a hive
  function getLatestReading(hiveId: number): Reading | null {
    return readings.find(r => r.hive_id === hiveId) || null;
  }

  // Save hive names
  async function saveHiveNames() {
    try {
      for (const hive of hives) {
        if (hiveNames[hive.id] !== hive.name) {
          const { error } = await supabase
            .from('hives')
            .update({ name: hiveNames[hive.id] })
            .eq('id', hive.id);
          
          if (error) throw error;
        }
      }
      setMessage('Hive names saved!');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    }
  }

  // Change password
  async function changePassword() {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('username', 'admin');

      if (error) throw error;
      setMessage('Password changed!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    }
  }

  // Save LVD settings
  async function saveLvdSettings() {
    try {
      const { error } = await supabase
        .from('lvd_settings')
        .update({
          disconnect_voltage: parseFloat(disconnectVoltage),
          reconnect_voltage: parseFloat(reconnectVoltage),
          is_enabled: lvdEnabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', lvdSettings?.id || 1);

      if (error) throw error;
      setMessage('LVD settings saved!');
      loadData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save LVD settings');
    }
  }

  // Copy API key
  function copyApiKey(apiKey: string) {
    navigator.clipboard.writeText(apiKey);
    setMessage('API key copied!');
    setTimeout(() => setMessage(''), 2000);
  }

  // Export CSV
  async function exportCsv() {
    try {
      let query = supabase
        .from('readings')
        .select('*, hives(name)')
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate + 'T23:59:59')
        .order('recorded_at', { ascending: false });

      if (exportHiveId !== 'all') {
        query = query.eq('hive_id', parseInt(exportHiveId));
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setError('No data found for selected range');
        return;
      }

      // Create CSV
      const headers = ['Hive', 'Temperature (°C)', 'Humidity (%)', 'Weight (kg)', 'Recorded At'];
      const rows = data.map(r => [
        (r.hives as any)?.name || `Hive ${r.hive_id}`,
        r.temperature,
        r.humidity,
        r.weight,
        new Date(r.recorded_at).toLocaleString()
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beehive_export_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setMessage('CSV downloaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to export');
    }
  }

  // Render login page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-6xl">🐝</span>
            <h1 className="text-2xl font-bold mt-4">Bee Hive Monitor</h1>
            <p className="text-gray-500">Login to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            {loginError && (
              <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
                {loginError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Enter username"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render hive detail page
  if (currentPage === 'hive' && selectedHiveId) {
    const hive = hives.find(h => h.id === selectedHiveId);
    const latestReading = getLatestReading(selectedHiveId);

    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        {/* Header */}
        <div className="bg-amber-500 text-white p-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className="text-2xl"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-bold">{hive?.name || 'Hive'}</h1>
              <p className="text-amber-100 text-sm">
                {latestReading ? timeAgo(latestReading.recorded_at) : 'No data'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Values */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-3">Current Values</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-bold ${latestReading ? getTempColor(latestReading.temperature) : ''}`}>
                  {latestReading?.temperature?.toFixed(1) || '--'}°C
                </div>
                <div className="text-gray-500 text-sm">🌡️ Temp</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-500">
                  {latestReading?.humidity?.toFixed(1) || '--'}%
                </div>
                <div className="text-gray-500 text-sm">💧 Humidity</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-500">
                  {latestReading?.weight?.toFixed(1) || '--'} kg
                </div>
                <div className="text-gray-500 text-sm">⚖️ Weight</div>
              </div>
            </div>
          </div>

          {/* Chart Period Selector */}
          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map(period => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`flex-1 py-2 rounded-lg font-medium ${
                  chartPeriod === period 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-white text-gray-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-3">📈 Temperature Chart</h2>
            {hiveReadings.length > 0 ? (
              <div className="h-48 flex items-end gap-1">
                {hiveReadings.slice(-24).map((reading, i) => {
                  const temp = reading.temperature || 0;
                  const height = Math.max(10, ((temp - 20) / 20) * 100);
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-amber-400 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${temp.toFixed(1)}°C - ${new Date(reading.recorded_at).toLocaleString()}`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No data for this period
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>{chartPeriod === '24h' ? '24 hours ago' : chartPeriod === '7d' ? '7 days ago' : '30 days ago'}</span>
              <span>Now</span>
            </div>
          </div>

          {/* Recent Readings Table */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-3">📊 Recent Readings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left py-2">Time</th>
                    <th className="text-right py-2">Temp</th>
                    <th className="text-right py-2">Humid</th>
                    <th className="text-right py-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {hiveReadings.slice(-10).reverse().map(reading => (
                    <tr key={reading.id} className="border-b">
                      <td className="py-2">{timeAgo(reading.recorded_at)}</td>
                      <td className="text-right">{reading.temperature?.toFixed(1)}°C</td>
                      <td className="text-right">{reading.humidity?.toFixed(1)}%</td>
                      <td className="text-right">{reading.weight?.toFixed(1)} kg</td>
                    </tr>
                  ))}
                  {hiveReadings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-400">
                        No readings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render export page
  if (currentPage === 'export') {
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        {/* Header */}
        <div className="bg-amber-500 text-white p-4">
          <h1 className="text-xl font-bold">📥 Export Data</h1>
        </div>

        <div className="p-4 space-y-4">
          {message && (
            <div className="bg-green-100 text-green-700 p-3 rounded-lg">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-4">Export Options</h2>

            {/* Select Hive */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Hive</label>
              <select
                value={exportHiveId}
                onChange={e => setExportHiveId(e.target.value)}
                className="w-full p-3 border rounded-lg"
              >
                <option value="all">All Hives</option>
                {hives.map(hive => (
                  <option key={hive.id} value={hive.id}>{hive.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={exportCsv}
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition"
            >
              📥 Download CSV
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
          <button onClick={() => setCurrentPage('dashboard')} className="flex-1 py-4 text-gray-400">🏠</button>
          <button onClick={() => setCurrentPage('export')} className="flex-1 py-4 text-amber-500">📥</button>
          <button onClick={() => setCurrentPage('settings')} className="flex-1 py-4 text-gray-400">⚙️</button>
          <button onClick={handleLogout} className="flex-1 py-4 text-gray-400">🚪</button>
        </div>
      </div>
    );
  }

  // Render settings page
  if (currentPage === 'settings') {
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        {/* Header */}
        <div className="bg-amber-500 text-white p-4">
          <h1 className="text-xl font-bold">⚙️ Settings</h1>
        </div>

        <div className="p-4 space-y-4">
          {message && (
            <div className="bg-green-100 text-green-700 p-3 rounded-lg">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Rename Hives */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-4">🏠 Rename Hives</h2>
            {hives.map(hive => (
              <div key={hive.id} className="mb-3">
                <label className="block text-sm font-medium mb-1">Hive {hive.id}</label>
                <input
                  type="text"
                  value={hiveNames[hive.id] || ''}
                  onChange={e => setHiveNames({ ...hiveNames, [hive.id]: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            ))}
            <button
              onClick={saveHiveNames}
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition mt-2"
            >
              Save Names
            </button>
          </div>

          {/* API Keys */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-4">🔑 API Keys</h2>
            {hives.map(hive => (
              <div key={hive.id} className="mb-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{hive.name}</div>
                    <div className="text-xs text-gray-500 font-mono break-all">{hive.api_key}</div>
                  </div>
                  <button
                    onClick={() => copyApiKey(hive.api_key)}
                    className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* LVD Settings */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-4">🔋 LVD Settings</h2>
            
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={lvdEnabled}
                  onChange={e => setLvdEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span>Enable LVD</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Disconnect (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={disconnectVoltage}
                  onChange={e => setDisconnectVoltage(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reconnect (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={reconnectVoltage}
                  onChange={e => setReconnectVoltage(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={saveLvdSettings}
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition"
            >
              Save LVD Settings
            </button>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-semibold mb-4">🔐 Change Password</h2>
            
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full p-3 border rounded-lg"
                placeholder="Enter new password"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full p-3 border rounded-lg"
                placeholder="Confirm new password"
              />
            </div>

            <button
              onClick={changePassword}
              className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition"
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
          <button onClick={() => setCurrentPage('dashboard')} className="flex-1 py-4 text-gray-400">🏠</button>
          <button onClick={() => setCurrentPage('export')} className="flex-1 py-4 text-gray-400">📥</button>
          <button onClick={() => setCurrentPage('settings')} className="flex-1 py-4 text-amber-500">⚙️</button>
          <button onClick={handleLogout} className="flex-1 py-4 text-gray-400">🚪</button>
        </div>
      </div>
    );
  }

  // Render dashboard
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-amber-500 text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">🐝 Bee Hive Monitor</h1>
            <p className="text-amber-100 text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* LVD Status Bar */}
      {lvdStatus && (
        <div className="bg-gray-800 text-white p-3 flex justify-around text-center">
          <div>
            <div className="text-lg font-bold">{lvdStatus.battery_percent || '--'}%</div>
            <div className="text-xs text-gray-400">🔋 Battery</div>
          </div>
          <div>
            <div className="text-lg font-bold">{lvdStatus.battery_voltage || '--'}V</div>
            <div className="text-xs text-gray-400">⚡ Voltage</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${lvdStatus.is_connected ? 'text-green-400' : 'text-red-400'}`}>
              {lvdStatus.is_connected ? 'ON' : 'OFF'}
            </div>
            <div className="text-xs text-gray-400">🔌 LVD</div>
          </div>
          <div>
            <div className="text-lg font-bold">
              {hives.filter(h => {
                const reading = getLatestReading(h.id);
                return reading && isOnline(reading.recorded_at);
              }).length}/{hives.length}
            </div>
            <div className="text-xs text-gray-400">📡 Online</div>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Messages */}
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
            {error}
            <button onClick={loadData} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Loading */}
        {loading && hives.length === 0 && (
          <div className="text-center py-8">
            <div className="animate-spin text-4xl mb-4">🔄</div>
            <p className="text-gray-500">Loading hives...</p>
          </div>
        )}

        {/* No hives */}
        {!loading && hives.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🐝</div>
            <p className="text-gray-500">No hives found</p>
            <p className="text-gray-400 text-sm">Add hives in Supabase database</p>
          </div>
        )}

        {/* Hive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hives.map(hive => {
            const reading = getLatestReading(hive.id);
            const online = reading ? isOnline(reading.recorded_at) : false;

            return (
              <div
                key={hive.id}
                onClick={() => {
                  setSelectedHiveId(hive.id);
                  setCurrentPage('hive');
                }}
                className="bg-white rounded-xl p-4 shadow cursor-pointer hover:shadow-lg transition"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{hive.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {reading ? timeAgo(reading.recorded_at) : 'No data'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-sm text-gray-500">{online ? 'Online' : 'Offline'}</span>
                  </div>
                </div>

                {/* Values */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className={`text-xl font-bold ${reading ? getTempColor(reading.temperature) : ''}`}>
                      {reading?.temperature?.toFixed(1) || '--'}°
                    </div>
                    <div className="text-xs text-gray-400">🌡️ Temp</div>
                  </div>      
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xl font-bold text-blue-500">
                      {reading?.humidity?.toFixed(0) || '--'}%
                    </div>
                    <div className="text-xs text-gray-400">💧 Humid</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xl font-bold text-purple-500">
                      {reading?.weight?.toFixed(1) || '--'}
                    </div>
                    <div className="text-xs text-gray-400">⚖️ kg</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        <button onClick={() => setCurrentPage('dashboard')} className="flex-1 py-4 text-amber-500">🏠</button>
        <button onClick={() => setCurrentPage('export')} className="flex-1 py-4 text-gray-400">📥</button>
        <button onClick={() => setCurrentPage('settings')} className="flex-1 py-4 text-gray-400">⚙️</button>
        <button onClick={handleLogout} className="flex-1 py-4 text-gray-400">🚪</button>
      </div>
    </div>
  );
}
