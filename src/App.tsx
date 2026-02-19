import { useState, useEffect } from 'react'

// ============================================
// TYPES
// ============================================
interface Hive {
  id: number
  name: string
  api_key: string
  temperature?: number
  humidity?: number
  weight?: number
  last_reading?: string
  is_online?: boolean
}

interface LvdStatus {
  battery_voltage: number
  battery_percent: number
  lvd_status: number
  disconnect_voltage: number
  reconnect_voltage: number
  recorded_at: string
}

interface Reading {
  id: number
  hive_id: number
  temperature: number
  humidity: number
  weight: number
  recorded_at: string
}

// ============================================
// API CONFIGURATION
// ============================================
const API_URL = 'http://localhost:3001/api'

// ============================================
// API FUNCTIONS
// ============================================
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token')
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed')
  }
  
  return data
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedHive, setSelectedHive] = useState<Hive | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      setIsLoggedIn(true)
    }
    setLoading(false)
  }, [])
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }
  
  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />
  }
  
  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
  }
  
  const handleViewHive = (hive: Hive) => {
    setSelectedHive(hive)
    setCurrentPage('hive-detail')
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 
            className="text-xl font-bold text-amber-400 cursor-pointer"
            onClick={() => setCurrentPage('dashboard')}
          >
            🐝 Bee Hive Monitor
          </h1>
          <nav className="flex gap-4">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className={`px-3 py-1 rounded ${currentPage === 'dashboard' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:text-white'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentPage('export')}
              className={`px-3 py-1 rounded ${currentPage === 'export' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:text-white'}`}
            >
              Export
            </button>
            <button 
              onClick={() => setCurrentPage('settings')}
              className={`px-3 py-1 rounded ${currentPage === 'settings' ? 'bg-amber-500 text-white' : 'text-gray-300 hover:text-white'}`}
            >
              Settings
            </button>
            <button 
              onClick={handleLogout}
              className="px-3 py-1 rounded text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        {currentPage === 'dashboard' && <Dashboard onViewHive={handleViewHive} />}
        {currentPage === 'hive-detail' && selectedHive && (
          <HiveDetail hive={selectedHive} onBack={() => setCurrentPage('dashboard')} />
        )}
        {currentPage === 'export' && <ExportPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

// ============================================
// LOGIN PAGE
// ============================================
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      
      localStorage.setItem('token', data.token)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐝</div>
          <h1 className="text-2xl font-bold text-white">Bee Hive Monitor</h1>
          <p className="text-gray-400 mt-2">Login to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="text-gray-500 text-center mt-4 text-sm">
          Default: admin / admin
        </p>
      </div>
    </div>
  )
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ onViewHive }: { onViewHive: (hive: Hive) => void }) {
  const [hives, setHives] = useState<Hive[]>([])
  const [lvd, setLvd] = useState<LvdStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const loadData = async () => {
    try {
      setError('')
      console.log('Loading hives...')
      
      const hivesData = await apiRequest('/hives')
      console.log('Hives loaded:', hivesData)
      setHives(hivesData)
      
      try {
        const lvdData = await apiRequest('/lvd')
        console.log('LVD loaded:', lvdData)
        setLvd(lvdData)
      } catch (e) {
        console.log('LVD not available:', e)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🔄</div>
        <p className="text-gray-400">Loading hives...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-red-400">{error}</p>
        <button 
          onClick={loadData}
          className="mt-4 bg-amber-500 text-white px-4 py-2 rounded-lg"
        >
          Try Again
        </button>
      </div>
    )
  }
  
  if (hives.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📭</div>
        <p className="text-gray-400">No hives found</p>
        <p className="text-gray-500 text-sm mt-2">Add hives in Settings</p>
      </div>
    )
  }
  
  const onlineCount = hives.filter(h => h.is_online).length
  
  return (
    <div className="space-y-6">
      {/* LVD Status Bar */}
      {lvd && (
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">{lvd.battery_percent}%</div>
              <div className="text-gray-400 text-sm">🔋 Battery</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">{lvd.battery_voltage}V</div>
              <div className="text-gray-400 text-sm">⚡ Voltage</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${lvd.lvd_status ? 'text-green-400' : 'text-red-400'}`}>
                {lvd.lvd_status ? 'ON' : 'OFF'}
              </div>
              <div className="text-gray-400 text-sm">🔌 LVD</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{onlineCount}/{hives.length}</div>
              <div className="text-gray-400 text-sm">🐝 Online</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hives.map(hive => (
          <HiveCard key={hive.id} hive={hive} onClick={() => onViewHive(hive)} />
        ))}
      </div>
      
      {/* Last Updated */}
      <p className="text-center text-gray-500 text-sm">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  )
}

// ============================================
// HIVE CARD
// ============================================
function HiveCard({ hive, onClick }: { hive: Hive; onClick: () => void }) {
  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return 'No data'
    const date = new Date(dateStr)
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }
  
  const isOnline = hive.is_online
  const temp = hive.temperature ?? '--'
  const humidity = hive.humidity ?? '--'
  const weight = hive.weight ?? '--'
  
  return (
    <div 
      onClick={onClick}
      className="bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750 transition-colors border border-gray-700 hover:border-amber-500"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{hive.name}</h3>
          <p className="text-gray-400 text-sm">{timeAgo(hive.last_reading)}</p>
        </div>
        <div className={`flex items-center gap-2 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-amber-400">{temp}°</div>
          <div className="text-gray-400 text-xs">🌡️ Temp</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">{humidity}{humidity !== '--' ? '%' : ''}</div>
          <div className="text-gray-400 text-xs">💧 Humid</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-400">{weight}{weight !== '--' ? 'kg' : ''}</div>
          <div className="text-gray-400 text-xs">⚖️ Weight</div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// HIVE DETAIL PAGE
// ============================================
function HiveDetail({ hive, onBack }: { hive: Hive; onBack: () => void }) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const loadReadings = async () => {
      try {
        const data = await apiRequest(`/readings?hive_id=${hive.id}&limit=50`)
        setReadings(data)
      } catch (err) {
        console.error('Failed to load readings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReadings()
  }, [hive.id])
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }
  
  return (
    <div className="space-y-6">
      {/* Back Button & Title */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white">
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-white">{hive.name}</h2>
      </div>
      
      {/* Current Stats */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Current Status</h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-4xl font-bold text-amber-400">{hive.temperature ?? '--'}°</div>
            <div className="text-gray-400">Temperature</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-blue-400">{hive.humidity ?? '--'}%</div>
            <div className="text-gray-400">Humidity</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400">{hive.weight ?? '--'}kg</div>
            <div className="text-gray-400">Weight</div>
          </div>
        </div>
      </div>
      
      {/* API Key */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">API Key:</span>
          <code className="text-amber-400 bg-gray-900 px-3 py-1 rounded">{hive.api_key}</code>
        </div>
      </div>
      
      {/* Recent Readings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Recent Readings</h3>
        
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : readings.length === 0 ? (
          <p className="text-gray-400">No readings yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Time</th>
                  <th className="text-right py-2">Temp</th>
                  <th className="text-right py-2">Humidity</th>
                  <th className="text-right py-2">Weight</th>
                </tr>
              </thead>
              <tbody>
                {readings.map(reading => (
                  <tr key={reading.id} className="border-b border-gray-700">
                    <td className="py-2 text-gray-300">{formatDate(reading.recorded_at)}</td>
                    <td className="py-2 text-right text-amber-400">{reading.temperature}°C</td>
                    <td className="py-2 text-right text-blue-400">{reading.humidity}%</td>
                    <td className="py-2 text-right text-purple-400">{reading.weight}kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// EXPORT PAGE
// ============================================
function ExportPage() {
  const [hives, setHives] = useState<Hive[]>([])
  const [selectedHive, setSelectedHive] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const loadHives = async () => {
      try {
        const data = await apiRequest('/hives')
        setHives(data)
      } catch (err) {
        console.error('Failed to load hives:', err)
      }
    }
    loadHives()
    
    // Set default dates
    const now = new Date()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(now.toISOString().split('T')[0])
    setStartDate(monthAgo.toISOString().split('T')[0])
  }, [])
  
  const handleExport = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const params = new URLSearchParams({
        hive_id: selectedHive,
        start_date: startDate,
        end_date: endDate
      })
      
      const response = await fetch(`${API_URL}/export/csv?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `beehive-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">📥 Export Data</h2>
      
      <div className="bg-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-gray-400 mb-2">Select Hive</label>
          <select
            value={selectedHive}
            onChange={e => setSelectedHive(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
          >
            <option value="all">All Hives</option>
            {hives.map(hive => (
              <option key={hive.id} value={hive.id}>{hive.name}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
        </div>
        
        <button
          onClick={handleExport}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Exporting...' : '📥 Download CSV'}
        </button>
      </div>
    </div>
  )
}

// ============================================
// SETTINGS PAGE
// ============================================
function SettingsPage() {
  const [hives, setHives] = useState<Hive[]>([])
  const [lvdSettings, setLvdSettings] = useState({
    disconnect_voltage: 3.3,
    reconnect_voltage: 3.6
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const hivesData = await apiRequest('/hives')
        setHives(hivesData)
        
        try {
          const lvdData = await apiRequest('/lvd/settings')
          if (lvdData) {
            setLvdSettings({
              disconnect_voltage: lvdData.disconnect_voltage || 3.3,
              reconnect_voltage: lvdData.reconnect_voltage || 3.6
            })
          }
        } catch (e) {
          console.log('LVD settings not available')
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      }
    }
    loadData()
  }, [])
  
  const handleRenameHive = async (hiveId: number, newName: string) => {
    try {
      await apiRequest(`/hives/${hiveId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
      })
      setHives(hives.map(h => h.id === hiveId ? { ...h, name: newName } : h))
      setMessage('Hive renamed successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      alert('Failed to rename hive')
    }
  }
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match')
      return
    }
    
    try {
      await apiRequest('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })
      setMessage('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      alert('Failed to change password: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }
  
  const handleSaveLvd = async () => {
    try {
      await apiRequest('/lvd/settings', {
        method: 'PUT',
        body: JSON.stringify(lvdSettings)
      })
      setMessage('LVD settings saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      alert('Failed to save LVD settings')
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">⚙️ Settings</h2>
      
      {message && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded-lg">
          {message}
        </div>
      )}
      
      {/* Rename Hives */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">🐝 Rename Hives</h3>
        <div className="space-y-3">
          {hives.map(hive => (
            <div key={hive.id} className="flex gap-3">
              <input
                type="text"
                defaultValue={hive.name}
                onBlur={e => {
                  if (e.target.value !== hive.name) {
                    handleRenameHive(hive.id, e.target.value)
                  }
                }}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
              <code className="text-xs text-gray-500 self-center">{hive.api_key}</code>
            </div>
          ))}
        </div>
      </div>
      
      {/* LVD Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">🔋 LVD Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 mb-2">Disconnect Voltage</label>
            <input
              type="number"
              step="0.1"
              value={lvdSettings.disconnect_voltage}
              onChange={e => setLvdSettings({ ...lvdSettings, disconnect_voltage: parseFloat(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Reconnect Voltage</label>
            <input
              type="number"
              step="0.1"
              value={lvdSettings.reconnect_voltage}
              onChange={e => setLvdSettings({ ...lvdSettings, reconnect_voltage: parseFloat(e.target.value) })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
        </div>
        <button
          onClick={handleSaveLvd}
          className="mt-4 bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg"
        >
          Save LVD Settings
        </button>
      </div>
      
      {/* Change Password */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">🔐 Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg"
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  )
}
