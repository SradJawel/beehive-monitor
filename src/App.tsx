import { useState, useEffect } from 'react';
import { 
  authApi, hivesApi, readingsApi, lvdApi, exportApi,
  Hive, Reading, LvdSettings, LvdStatus, User 
} from './api';

// Time ago helper
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Check if hive is online (data within last 10 minutes)
function isOnline(lastReading: string | null): boolean {
  if (!lastReading) return false;
  const diff = Date.now() - new Date(lastReading).getTime();
  return diff < 10 * 60 * 1000; // 10 minutes
}

// Main App
export default function App() {
  const [user, setUser] = useState<User | null>(authApi.getUser());
  const [page, setPage] = useState<'dashboard' | 'hive' | 'export' | 'settings'>('dashboard');
  const [selectedHiveId, setSelectedHiveId] = useState<number | null>(null);
  
  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {page === 'dashboard' && (
        <Dashboard 
          onSelectHive={(id) => { setSelectedHiveId(id); setPage('hive'); }}
        />
      )}
      {page === 'hive' && selectedHiveId && (
        <HiveDetail 
          hiveId={selectedHiveId} 
          onBack={() => setPage('dashboard')} 
        />
      )}
      {page === 'export' && (
        <ExportPage onBack={() => setPage('dashboard')} />
      )}
      {page === 'settings' && (
        <SettingsPage 
          user={user}
          onBack={() => setPage('dashboard')} 
          onLogout={() => { authApi.logout(); setUser(null); }}
        />
      )}
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="flex justify-around py-2">
          <button 
            onClick={() => setPage('dashboard')}
            className={`flex flex-col items-center p-2 ${page === 'dashboard' ? 'text-amber-500' : 'text-gray-400'}`}
          >
            <span className="text-xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <button 
            onClick={() => setPage('export')}
            className={`flex flex-col items-center p-2 ${page === 'export' ? 'text-amber-500' : 'text-gray-400'}`}
          >
            <span className="text-xl">📥</span>
            <span className="text-xs">Export</span>
          </button>
          <button 
            onClick={() => setPage('settings')}
            className={`flex flex-col items-center p-2 ${page === 'settings' ? 'text-amber-500' : 'text-gray-400'}`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// Login Page
function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await authApi.login(username, password);
    
    if (result.success && result.user) {
      onLogin(result.user);
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
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

// Dashboard Page
function Dashboard({ onSelectHive }: { onSelectHive: (id: number) => void }) {
  const [hives, setHives] = useState<Hive[]>([]);
  const [readings, setReadings] = useState<Record<number, Reading | null>>({});
  const [lvdStatus, setLvdStatus] = useState<LvdStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const hivesData = await hivesApi.getAll();
      setHives(hivesData);
      
      const readingsData: Record<number, Reading | null> = {};
      for (const hive of hivesData) {
        readingsData[hive.id] = await readingsApi.getLatestByHiveId(hive.id);
      }
      setReadings(readingsData);
      
      const status = await lvdApi.getStatus();
      setLvdStatus(status);
      
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
          <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-500 rounded-lg">
            Retry
          </button>
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
          <span className="text-gray-400 text-sm">
            {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* LVD Status Bar */}
      {lvdStatus && (
        <div className="bg-gray-800 mx-4 mt-4 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">⚡ Power System</span>
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              lvdStatus.is_connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {lvdStatus.is_connected ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{lvdStatus.battery_percent}%</p>
              <p className="text-gray-400 text-sm">🔋 Battery</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{lvdStatus.battery_voltage}V</p>
              <p className="text-gray-400 text-sm">⚡ Voltage</p>
            </div>
          </div>
        </div>
      )}

      {/* Hives Grid */}
      <div className="p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-400">Hives</h2>
        
        {hives.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <span className="text-4xl">📭</span>
            <p className="mt-4 text-gray-400">No hives found</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {hives.map(hive => {
              const reading = readings[hive.id];
              const online = isOnline(reading?.recorded_at || null);
              
              return (
                <div
                  key={hive.id}
                  onClick={() => onSelectHive(hive.id)}
                  className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 active:scale-98 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏠</span>
                      <div>
                        <h3 className="font-bold">{hive.name}</h3>
                        <p className="text-gray-400 text-sm">
                          {reading ? timeAgo(reading.recorded_at) : 'No data'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-sm text-gray-400">{online ? 'Online' : 'Offline'}</span>
                      <span className="text-gray-600">›</span>
                    </div>
                  </div>
                  
                  {reading && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-gray-700/50 rounded-lg p-2">
                        <p className={`text-xl font-bold ${
                          reading.temperature > 38 ? 'text-red-400' : 
                          reading.temperature > 35 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {reading.temperature}°
                        </p>
                        <p className="text-gray-400 text-xs">🌡️ Temp</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-2">
                        <p className="text-xl font-bold text-blue-400">
                          {reading.humidity || '--'}%
                        </p>
                        <p className="text-gray-400 text-xs">💧 Humid</p>
                      </div>
                      <div className="bg-gray-700/50 rounded-lg p-2">
                        <p className="text-xl font-bold text-purple-400">
                          {reading.weight || '--'}kg
                        </p>
                        <p className="text-gray-400 text-xs">⚖️ Weight</p>
                      </div>
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
}

// Hive Detail Page
function HiveDetail({ hiveId, onBack }: { hiveId: number; onBack: () => void }) {
  const [hive, setHive] = useState<Hive | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    loadData();
  }, [hiveId, period]);

  const loadData = async () => {
    try {
      const hiveData = await hivesApi.getById(hiveId);
      setHive(hiveData);
      
      const limit = period === '24h' ? 288 : period === '7d' ? 2016 : 8640;
      const readingsData = await readingsApi.getByHiveId(hiveId, limit);
      setReadings(readingsData);
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
  const chartData = readings.slice(0, 50).reverse();

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
          <h2 className="text-gray-400 text-sm mb-3">Current Reading</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-green-400">{latestReading.temperature}°</p>
              <p className="text-gray-400 text-sm">🌡️ Temp</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400">{latestReading.humidity || '--'}%</p>
              <p className="text-gray-400 text-sm">💧 Humidity</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-400">{latestReading.weight || '--'}kg</p>
              <p className="text-gray-400 text-sm">⚖️ Weight</p>
            </div>
          </div>
          <p className="text-center text-gray-500 text-sm mt-3">
            Last update: {timeAgo(latestReading.recorded_at)}
          </p>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex gap-2 p-4">
        {(['24h', '7d', '30d'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg font-bold ${
              period === p ? 'bg-amber-500' : 'bg-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Simple Chart */}
      <div className="bg-gray-800 mx-4 rounded-xl p-4">
        <h2 className="text-gray-400 text-sm mb-3">📈 Temperature History</h2>
        <div className="h-40 flex items-end gap-1">
          {chartData.map((r, i) => {
            const minTemp = Math.min(...chartData.map(x => x.temperature));
            const maxTemp = Math.max(...chartData.map(x => x.temperature));
            const range = maxTemp - minTemp || 1;
            const height = ((r.temperature - minTemp) / range) * 100;
            
            return (
              <div
                key={i}
                className="flex-1 bg-amber-500 rounded-t"
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
      </div>

      {/* Recent Readings Table */}
      <div className="bg-gray-800 mx-4 mt-4 rounded-xl p-4">
        <h2 className="text-gray-400 text-sm mb-3">📋 Recent Readings</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {readings.slice(0, 20).map((r, i) => (
            <div key={i} className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
              <span className="text-gray-400 text-sm">{timeAgo(r.recorded_at)}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-green-400">{r.temperature}°</span>
                <span className="text-blue-400">{r.humidity || '--'}%</span>
                <span className="text-purple-400">{r.weight || '--'}kg</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export Page
function ExportPage({ onBack }: { onBack: () => void }) {
  const [hives, setHives] = useState<Hive[]>([]);
  const [selectedHive, setSelectedHive] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    hivesApi.getAll().then(setHives);
    
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
      await exportApi.downloadCSV(
        selectedHive ? Number(selectedHive) : undefined,
        startDate,
        endDate
      );
      setMessage('✅ CSV downloaded successfully!');
    } catch (err) {
      setMessage('❌ Export failed: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      {/* Header */}
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
        {/* Hive Selection */}
        <div className="bg-gray-800 rounded-xl p-4">
          <label className="text-gray-400 text-sm">Select Hive</label>
          <select
            value={selectedHive}
            onChange={(e) => setSelectedHive(e.target.value ? Number(e.target.value) : '')}
            className="w-full mt-2 p-3 bg-gray-700 rounded-lg"
          >
            <option value="">All Hives</option>
            {hives.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="bg-gray-800 rounded-xl p-4">
          <label className="text-gray-400 text-sm">Date Range</label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="text-xs text-gray-500">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full p-4 bg-amber-500 hover:bg-amber-600 rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? '⏳ Exporting...' : '📥 Download CSV'}
        </button>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl text-center ${
            message.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

// Settings Page
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
      const hivesData = await hivesApi.getAll();
      setHives(hivesData);
      
      const names: Record<number, string> = {};
      hivesData.forEach(h => { names[h.id] = h.name; });
      setHiveNames(names);
      
      const settings = await lvdApi.getSettings();
      setLvdSettings(settings);
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
          await hivesApi.update(hive.id, { name: hiveNames[hive.id] });
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
      await lvdApi.updateSettings({
        disconnect_voltage: lvdSettings.disconnect_voltage,
        reconnect_voltage: lvdSettings.reconnect_voltage,
        is_enabled: lvdSettings.is_enabled
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
      const success = await authApi.changePassword(user.id, newPassword);
      if (success) {
        setMessage('✅ Password changed!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage('❌ Failed to change password');
      }
    } catch (err) {
      setMessage('❌ Error: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setMessage('✅ API key copied to clipboard!');
  };

  return (
    <div className="pb-20">
      {/* Header */}
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
        {/* Message */}
        {message && (
          <div className={`p-4 rounded-xl text-center ${
            message.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}

        {/* Rename Hives */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🏠 Rename Hives</h2>
          <div className="space-y-3">
            {hives.map(hive => (
              <div key={hive.id} className="flex gap-2">
                <input
                  type="text"
                  value={hiveNames[hive.id] || ''}
                  onChange={(e) => setHiveNames({ ...hiveNames, [hive.id]: e.target.value })}
                  className="flex-1 p-3 bg-gray-700 rounded-lg"
                  placeholder={`Hive ${hive.id}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveHiveNames}
            disabled={loading}
            className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50"
          >
            Save Names
          </button>
        </div>

        {/* API Keys */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🔑 API Keys</h2>
          <div className="space-y-3">
            {hives.map(hive => (
              <div key={hive.id} className="flex items-center gap-2">
                <span className="text-gray-400 w-20">{hive.name}:</span>
                <code className="flex-1 text-xs bg-gray-700 p-2 rounded overflow-x-auto">
                  {hive.api_key}
                </code>
                <button
                  onClick={() => copyApiKey(hive.api_key)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  📋
                </button>
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
                className={`w-14 h-8 rounded-full transition-colors ${
                  lvdSettings.is_enabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${
                  lvdSettings.is_enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
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
            
            <button
              onClick={saveLvdSettings}
              disabled={loading}
              className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50"
            >
              Save LVD Settings
            </button>
          </div>
        )}

        {/* Change Password */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="font-bold mb-4">🔒 Change Password</h2>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-lg"
            />
          </div>
          <button
            onClick={changePassword}
            disabled={loading}
            className="w-full mt-4 p-3 bg-amber-500 hover:bg-amber-600 rounded-lg font-bold disabled:opacity-50"
          >
            Change Password
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full p-4 bg-red-500 hover:bg-red-600 rounded-xl font-bold"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
