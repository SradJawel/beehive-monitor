import { useState, useEffect } from 'react';

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ============================================
// TYPES
// ============================================
interface Hive {
  id: number;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

interface Reading {
  id: number;
  hive_id: number;
  temperature: number | null;
  humidity: number | null;
  weight: number | null;
  battery_voltage: number | null;
  battery_percent: number | null;
  recorded_at: string;
}

interface LvdSettings {
  id: number;
  disconnect_voltage: number;
  reconnect_voltage: number;
  is_enabled: boolean;
  updated_at: string;
}

interface LvdStatus {
  id: number;
  battery_voltage: number | null;
  battery_percent: number | null;
  is_connected: boolean;
  recorded_at: string;
}

interface User {
  id: number;
  username: string;
  password: string;
}

interface TodayReading {
  reading: Reading;
  label: string;
  icon: string;
  time: string;
}

// ============================================
// SUPABASE API HELPER
// ============================================
async function supabaseFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isToday(date: string): boolean {
  const today = new Date();
  const readingDate = new Date(date);
  return today.toDateString() === readingDate.toDateString();
}

function getReadingLabel(index: number): { label: string; icon: string } {
  switch (index) {
    case 0: return { label: 'Morning', icon: '🌅' };
    case 1: return { label: 'Afternoon', icon: '☀️' };
    case 2: return { label: 'Night', icon: '🌙' };
    default: return { label: `Reading ${index + 1}`, icon: '📊' };
  }
}

function isOnline(lastReading: string | null): boolean {
  if (!lastReading) return false;
  const diff = Date.now() - new Date(lastReading).getTime();
  return diff < 12 * 60 * 60 * 1000; // 12 hours
}

function getBatteryColor(percent: number | null): string {
  if (percent === null) return 'text-gray-400';
  if (percent > 60) return 'text-green-400';
  if (percent > 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getBatteryIcon(percent: number | null): string {
  if (percent === null) return '🔋';
  if (percent > 75) return '🔋';
  if (percent > 50) return '🔋';
  if (percent > 25) return '🪫';
  return '🪫';
}

function getTempColor(temp: number | null): string {
  if (temp === null) return 'text-gray-400';
  if (temp > 38) return 'text-red-400';
  if (temp > 35) return 'text-yellow-400';
  return 'text-green-400';
}

function displayValue(value: number | null | undefined, unit: string = ''): string {
  if (value === null || value === undefined) return '--';
  return `${value}${unit}`;
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [page, setPage] = useState<'dashboard' | 'hive' | 'export' | 'settings'>('dashboard');
  const [selectedHiveId, setSelectedHiveId] = useState<number | null>(null);

  if (!user) {
    return <LoginPage onLogin={(u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)); }} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {page === 'dashboard' && (
        <Dashboard onSelectHive={(id) => { setSelectedHiveId(id); setPage('hive'); }} />
      )}
      {page === 'hive' && selectedHiveId && (
        <HiveDetail hiveId={selectedHiveId} onBack={() => setPage('dashboard')} />
      )}
      {page === 'export' && (
        <ExportPage onBack={() => setPage('dashboard')} />
      )}
      {page === 'settings' && (
        <SettingsPage user={user} onBack={() => setPage('dashboard')} onLogout={handleLogout} />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 pb-safe">
        <div className="flex justify-around py-2">
          <button onClick={() => setPage('dashboard')} className={`flex flex-col items-center p-2 ${page === 'dashboard' ? 'text-amber-500' : 'text-gray-400'}`}>
            <span className="text-xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => setPage('export')} className={`flex flex-col items-center p-2 ${page === 'export' ? 'text-amber-500' : 'text-gray-400'}`}>
            <span className="text-xl">📥</span>
            <span className="text-xs">Export</span>
          </button>
          <button onClick={() => setPage('settings')} className={`flex flex-col items-center p-2 ${page === 'settings' ? 'text-amber-500' : 'text-gray-400'}`}>
            <span className="text-xl">⚙️</span>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// ============================================
// LOGIN PAGE
// ============================================
function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const users = await supabaseFetch(`users?username=eq.${username}&password=eq.${password}`);
      if (users && users.length > 0) {
        onLogin(users[0]);
      } else {
        setError('Invalid username or password');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-6xl">🐝</span>
          <h1 className="text-2xl font-bold mt-4">Bee Hive Monitor</h1>
          <p className="text-gray-400">Login to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD PAGE
// ============================================
function Dashboard({ onSelectHive }: { onSelectHive: (id: number) => void }) {
  const [hives, setHives] = useState<Hive[]>([]);
  const [todayReadings, setTodayReadings] = useState<Record<number, TodayReading[]>>({});
  const [latestReadings, setLatestReadings] = useState<Record<number, Reading | null>>({});
  const [lvdStatus, setLvdStatus] = useState<LvdStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const hivesData = await supabaseFetch('hives?order=id');
      setHives(hivesData || []);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayReadingsMap: Record<number, TodayReading[]> = {};
      const latestReadingsMap: Record<number, Reading | null> = {};

      for (const hive of hivesData || []) {
        // Get today's readings
        const todayData = await supabaseFetch(
          `readings?hive_id=eq.${hive.id}&recorded_at=gte.${todayStart.toISOString()}&order=recorded_at.asc`
        );
        
        todayReadingsMap[hive.id] = (todayData || []).map((r: Reading, index: number) => {
          const { label, icon } = getReadingLabel(index);
          return {
            reading: r,
            label,
            icon,
            time: formatTime(r.recorded_at)
          };
        });

        // Get latest reading
        const latest = await supabaseFetch(
          `readings?hive_id=eq.${hive.id}&order=recorded_at.desc&limit=1`
        );
        latestReadingsMap[hive.id] = latest && latest.length > 0 ? latest[0] : null;
      }

      setTodayReadings(todayReadingsMap);
      setLatestReadings(latestReadingsMap);

      const status = await supabaseFetch('lvd_status?order=recorded_at.desc&limit=1');
      setLvdStatus(status && status.length > 0 ? status[0] : null);

      setError('');
    } catch (err) {
      setError('Failed to load data: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl animate-bounce">🐝</span>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 text-center max-w-md">
          <span className="text-4xl">⚠️</span>
          <p className="mt-4 text-red-400">{error}</p>
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-500 rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🐝</span>
            <h1 className="text-xl font-bold">Hive Monitor</h1>
          </div>
          <span className="text-gray-400 text-sm">{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* LVD Status Bar */}
      {lvdStatus && (
        <div className="bg-gray-800 mx-4 mt-4 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">⚡ Power System</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${lvdStatus.is_connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {lvdStatus.is_connected ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={`text-2xl font-bold ${getBatteryColor(lvdStatus.battery_percent)}`}>
                {displayValue(lvdStatus.battery_percent, '%')}
              </p>
              <p className="text-gray-400 text-sm">{getBatteryIcon(lvdStatus.battery_percent)} Battery</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{displayValue(lvdStatus.battery_voltage, 'V')}</p>
              <p className="text-gray-400 text-sm">⚡ Voltage</p>
            </div>
          </div>
        </div>
      )}

      {/* Hives */}
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-400">Hives</h2>

        {hives.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <span className="text-4xl">📭</span>
            <p className="mt-4 text-gray-400">No hives found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hives.map((hive) => {
              const today = todayReadings[hive.id] || [];
              const latest = latestReadings[hive.id];
              const online = isOnline(latest?.recorded_at || null);

              return (
                <div
                  key={hive.id}
                  className="bg-gray-800 rounded-xl overflow-hidden"
                >
                  {/* Hive Header - Clickable */}
                  <div
                    onClick={() => onSelectHive(hive.id)}
                    className="p-4 cursor-pointer hover:bg-gray-750 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏠</span>
                        <div>
                          <h3 className="font-bold">{hive.name}</h3>
                          <p className="text-gray-400 text-sm">
                            {latest ? timeAgo(latest.recorded_at) : 'No data'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-gray-400">{online ? 'Online' : 'Offline'}</span>
                        <span className="text-gray-600">›</span>
                      </div>
                    </div>

                    {/* Latest Reading Summary */}
                    {latest && (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className={`text-lg font-bold ${getTempColor(latest.temperature)}`}>
                            {displayValue(latest.temperature, '°')}
                          </p>
                          <p className="text-gray-400 text-xs">🌡️ Temp</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className="text-lg font-bold text-blue-400">
                            {displayValue(latest.humidity, '%')}
                          </p>
                          <p className="text-gray-400 text-xs">💧 Humid</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className="text-lg font-bold text-purple-400">
                            {displayValue(latest.weight, 'kg')}
                          </p>
                          <p className="text-gray-400 text-xs">⚖️ Weight</p>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2">
                          <p className={`text-lg font-bold ${getBatteryColor(latest.battery_percent)}`}>
                            {displayValue(latest.battery_percent, '%')}
                          </p>
                          <p className="text-gray-400 text-xs">{getBatteryIcon(latest.battery_percent)} Batt</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Today's Readings */}
                  <div className="border-t border-gray-700 p-4 bg-gray-800/50">
                    <p className="text-gray-400 text-sm mb-3">📅 Today's Readings ({today.length}/3)</p>
                    
                    {today.length === 0 ? (
                      <div className="flex justify-center gap-4">
                        {[0, 1, 2].map((i) => {
                          const { label, icon } = getReadingLabel(i);
                          return (
                            <div key={i} className="text-center opacity-30">
                              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-1">
                                <span className="text-2xl">{icon}</span>
                              </div>
                              <p className="text-xs text-gray-500">{label}</p>
                              <p className="text-xs text-gray-600">--:--</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-center gap-4">
                        {[0, 1, 2].map((i) => {
                          const reading = today[i];
                          const { label, icon } = getReadingLabel(i);
                          const isRecorded = !!reading;

                          return (
                            <div key={i} className={`text-center ${!isRecorded ? 'opacity-30' : ''}`}>
                              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-1 ${
                                isRecorded ? 'bg-amber-500/20 border-2 border-amber-500' : 'bg-gray-700'
                              }`}>
                                <div className="text-center">
                                  <span className="text-xl">{icon}</span>
                                  {isRecorded && (
                                    <p className={`text-xs font-bold ${getTempColor(reading.reading.temperature)}`}>
                                      {displayValue(reading.reading.temperature, '°')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-400">{label}</p>
                              <p className="text-xs text-gray-500">
                                {isRecorded ? reading.time : '--:--'}
                              </p>
                              {isRecorded && (
                                <div className="flex justify-center gap-1 mt-1">
                                  <span className="text-xs text-purple-400">{displayValue(reading.reading.weight, 'kg')}</span>
                                  <span className={`text-xs ${getBatteryColor(reading.reading.battery_percent)}`}>
                                    {displayValue(reading.reading.battery_percent, '%')}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// HIVE DETAIL PAGE
// ============================================
function HiveDetail({ hiveId, onBack }: { hiveId: number; onBack: () => void }) {
  const [hive, setHive] = useState<Hive | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');

  useEffect(() => {
    loadData();
  }, [hiveId, period]);

  const loadData = async () => {
    try {
      const hiveData = await supabaseFetch(`hives?id=eq.${hiveId}`);
      setHive(hiveData && hiveData.length > 0 ? hiveData[0] : null);

      const limit = period === '7d' ? 21 : period === '30d' ? 90 : 270;
      const readingsData = await supabaseFetch(`readings?hive_id=eq.${hiveId}&order=recorded_at.desc&limit=${limit}`);
      setReadings(readingsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !hive) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-4xl animate-bounce">🐝</span>
      </div>
    );
  }

  const latestReading = readings[0];
  const chartData = readings.slice(0, 30).reverse();

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-2xl">←</button>
          <div>
            <h1 className="text-xl font-bold">{hive.name}</h1>
            <p className="text-gray-400 text-sm">Hive Details</p>
          </div>
        </div>
      </div>

      {/* Current Reading */}
      {latestReading && (
        <div className="bg-gray-800 mx-4 mt-4 rounded-xl p-4">
          <h2 className="text-gray-400 text-sm mb-3">📊 Current Reading</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className={`text-3xl font-bold ${getTempColor(latestReading.temperature)}`}>
                {displayValue(latestReading.temperature, '°C')}
              </p>
              <p className="text-gray-400 text-sm mt-1">🌡️ Temperature</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {displayValue(latestReading.humidity, '%')}
              </p>
              <p className="text-gray-400 text-sm mt-1">💧 Humidity</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-3xl font-bold text-purple-400">
                {displayValue(latestReading.weight, 'kg')}
              </p>
              <p className="text-gray-400 text-sm mt-1">⚖️ Weight</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className={`text-3xl font-bold ${getBatteryColor(latestReading.battery_percent)}`}>
                {displayValue(latestReading.battery_percent, '%')}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {getBatteryIcon(latestReading.battery_percent)} Battery
                <span className="text-xs text-gray-500 block">
                  ({displayValue(latestReading.battery_voltage, 'V')})
                </span>
              </p>
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-3">
            Last update: {timeAgo(latestReading.recorded_at)}
          </p>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-2 p-4">
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg font-bold ${period === p ? 'bg-amber-500' : 'bg-gray-700'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-gray-800 mx-4 rounded-xl p-4">
        <h2 className="text-gray-400 text-sm mb-3">📈 Temperature History</h2>
        {chartData.length > 0 ? (
          <>
            <div className="h-40 flex items-end gap-1">
              {chartData.map((r, i) => {
                const temps = chartData.map((x) => x.temperature || 0);
                const minTemp = Math.min(...temps);
                const maxTemp = Math.max(...temps);
                const range = maxTemp - minTemp || 1;
                const height = (((r.temperature || 0) - minTemp) / range) * 100;

                return (
                  <div
                    key={i}
                    className="flex-1 bg-amber-500 rounded-t hover:bg-amber-400 transition-colors"
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${r.temperature}°C at ${new Date(r.recorded_at).toLocaleString()}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-gray-500 text-xs mt-2">
              <span>{chartData[0]?.temperature}°C</span>
              <span>{chartData[chartData.length - 1]?.temperature}°C</span>
            </div>
          </>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Recent Readings Table */}
      <div className="bg-gray-800 mx-4 mt-4 rounded-xl p-4">
        <h2 className="text-gray-400 text-sm mb-3">📋 Recent Readings</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {readings.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No readings yet</p>
          ) : (
            readings.slice(0, 30).map((r, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-700/50 p-2 rounded text-sm">
                <div>
                  <span className="text-gray-400">{timeAgo(r.recorded_at)}</span>
                  {isToday(r.recorded_at) && (
                    <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 px-1 rounded">Today</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <span className={getTempColor(r.temperature)}>{displayValue(r.temperature, '°')}</span>
                  <span className="text-blue-400">{displayValue(r.humidity, '%')}</span>
                  <span className="text-purple-400">{displayValue(r.weight, 'kg')}</span>
                  <span className={getBatteryColor(r.battery_percent)}>{displayValue(r.battery_percent, '%')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EXPORT PAGE
// ============================================
function ExportPage({ onBack }: { onBack: () => void }) {
  const [hives, setHives] = useState<Hive[]>([]);
  const [selectedHive, setSelectedHive] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabaseFetch('hives?order=id').then(setHives);

    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(lastMonth.toISOString().split('T')[0]);
  }, []);

  const handleExport = async () => {
    setLoading(true);
    setMessage('');

    try {
      let query = 'readings?order=recorded_at.desc';
      if (selectedHive) query += `&hive_id=eq.${selectedHive}`;
      if (startDate) query += `&recorded_at=gte.${startDate}`;
      if (endDate) query += `&recorded_at=lte.${endDate}T23:59:59`;

      const readings = await supabaseFetch(query);
      const hivesData = await supabaseFetch('hives');

      let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Battery (%),Battery (V),Recorded At\n';
      readings.forEach((r: Reading) => {
        const hive = hivesData.find((h: Hive) => h.id === r.hive_id);
        csv += `${hive?.name || r.hive_id},${r.temperature || ''},${r.humidity || ''},${r.weight || ''},${r.battery_percent || ''},${r.battery_voltage || ''},${r.recorded_at}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beehive-data-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      setMessage(`✅ Exported ${readings.length} readings!`);
    } catch (err) {
      setMessage('❌ Export failed: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <div className="bg-gray-800 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-2xl">←</button>
          <div>
            <h1 className="text-xl font-bold">Export Data</h1>
            <p className="text-gray-400 text-sm">Download CSV</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <label className="text-gray-400 text-sm">Select Hive</label>
          <select
            value={selectedHive}
            onChange={(e) => setSelectedHive(e.target.value ? Number(e.target.value) : '')}
            className="w-full mt-2 p-3 bg-gray-700 rounded-lg"
          >
            <option value="">All Hives</option>
            {hives.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <label className="text-gray-400 text-sm">Date Range</label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="text-xs text-gray-500">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg" />
            </div>
            <div>
              <label className="text-xs text-gray-500">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg" />
            </div>
          </div>
        </div>

        <button onClick={handleExport} disabled={loading} className="w-full p-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold disabled:opacity-50">
          {loading ? '⏳ Exporting...' : '📥 Download CSV'}
        </button>

        {message && (
          <div className={`p-4 rounded-xl text-center ${message.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SETTINGS PAGE
// ============================================
function SettingsPage({ user, onBack, onLogout }: { user: User; onBack: () => void; onLogout: () => void }) {
  const [hives, setHives] = useState<Hive[]>([]);
  const [lvdSettings, setLvdSettings] = useState<LvdSettings | null>(null);
  const [hiveNames, setHiveNames] = useState<Record<number, string>>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const hivesData = await supabaseFetch('hives?order=id');
      setHives(hivesData || []);

      const names: Record<number, string> = {};
      (hivesData || []).forEach((h: Hive) => { names[h.id] = h.name; });
      setHiveNames(names);

      const settings = await supabaseFetch('lvd_settings?limit=1');
      setLvdSettings(settings && settings.length > 0 ? settings[0] : null);
    } catch (err) {
      console.error(err);
    }
  };

  const saveHiveNames = async () => {
    setLoading(true);
    setMessage('');

    try {
      for (const hive of hives) {
        if (hiveNames[hive.id] !== hive.name) {
          await supabaseFetch(`hives?id=eq.${hive.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: hiveNames[hive.id] })
          });
        }
      }
      setMessage('✅ Hive names saved!');
      loadData();
    } catch (err) {
      setMessage('❌ Failed to save: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveLvdSettings = async () => {
    if (!lvdSettings) return;

    setLoading(true);
    setMessage('');

    try {
      await supabaseFetch(`lvd_settings?id=eq.${lvdSettings.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          disconnect_voltage: lvdSettings.disconnect_voltage,
          reconnect_voltage: lvdSettings.reconnect_voltage,
          is_enabled: lvdSettings.is_enabled,
          updated_at: new Date().toISOString()
        })
      });
      setMessage('✅ LVD settings saved!');
    } catch (err) {
      setMessage('❌ Failed to save: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('❌ Passwords do not match!');
      return;
    }
    if (newPassword.length < 4) {
      setMessage('❌ Password must be at least 4 characters!');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await supabaseFetch(`users?id=eq.${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword })
      });
      setMessage('✅ Password changed!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage('❌ Error: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setMessage('✅ API key copied!');
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="pb-20">
      <div className="bg-gray-800 p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-2xl">←</button>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-gray-400 text-sm">Manage your hives</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {message && (
          <div className={`p-4 rounded-xl text-center ${message.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message}
          </div>
        )}

        {/* Rename Hives */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🏠 Rename Hives</h2>
          <div className="space-y-3">
            {hives.map((hive) => (
              <input
                key={hive.id}
                type="text"
                value={hiveNames[hive.id] || ''}
                onChange={(e) => setHiveNames({ ...hiveNames, [hive.id]: e.target.value })}
                className="w-full p-3 bg-gray-700 rounded-lg"
                placeholder={`Hive ${hive.id}`}
              />
            ))}
          </div>
          <button onClick={saveHiveNames} disabled={loading} className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50">
            Save Names
          </button>
        </div>

        {/* API Keys */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🔑 API Keys</h2>
          <div className="space-y-3">
            {hives.map((hive) => (
              <div key={hive.id} className="flex items-center gap-2">
                <span className="text-gray-400 w-16 text-sm">{hive.name}:</span>
                <code className="flex-1 text-xs bg-gray-700 p-2 rounded overflow-x-auto">{hive.api_key}</code>
                <button onClick={() => copyApiKey(hive.api_key)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded">📋</button>
              </div>
            ))}
          </div>
        </div>

        {/* LVD Settings */}
        {lvdSettings && (
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="font-bold mb-4">⚡ LVD Settings</h2>

            <div className="flex items-center justify-between mb-4">
              <span>Enable LVD</span>
              <button
                onClick={() => setLvdSettings({ ...lvdSettings, is_enabled: !lvdSettings.is_enabled })}
                className={`w-14 h-8 rounded-full transition-colors relative ${lvdSettings.is_enabled ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${lvdSettings.is_enabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm">Disconnect Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={lvdSettings.disconnect_voltage}
                  onChange={(e) => setLvdSettings({ ...lvdSettings, disconnect_voltage: parseFloat(e.target.value) })}
                  className="w-full mt-1 p-3 bg-gray-700 rounded-lg"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">Reconnect Voltage (V)</label>
                <input
                  type="number"
                  step="0.1"
                  value={lvdSettings.reconnect_voltage}
                  onChange={(e) => setLvdSettings({ ...lvdSettings, reconnect_voltage: parseFloat(e.target.value) })}
                  className="w-full mt-1 p-3 bg-gray-700 rounded-lg"
                />
              </div>
            </div>

            <button onClick={saveLvdSettings} disabled={loading} className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50">
              Save LVD Settings
            </button>
          </div>
        )}

        {/* Change Password */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🔒 Change Password</h2>
          <div className="space-y-3">
            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg" />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg" />
          </div>
          <button onClick={changePassword} disabled={loading} className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50">
            Change Password
          </button>
        </div>

        {/* Logout */}
        <button onClick={onLogout} className="w-full p-4 bg-red-500 hover:bg-red-600 rounded-xl font-bold">
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
