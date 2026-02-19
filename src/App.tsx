import { useState, useEffect } from 'react'

// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mafzunpomznrjvdxvknc.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// ============================================
// TYPES
// ============================================
interface Hive {
  id: number
  name: string
  api_key: string
  created_at: string
}

interface Reading {
  id: number
  hive_id: number
  temperature: number
  humidity: number | null
  weight: number | null
  recorded_at: string
}

interface LVDStatus {
  id: number
  battery_voltage: number
  battery_percent: number
  lvd_status: boolean
  recorded_at: string
}

// ============================================
// SUPABASE API HELPER
// ============================================
async function supabaseFetch(table: string, options: {
  method?: string
  select?: string
  filters?: string
  body?: object
  order?: string
  limit?: number
} = {}) {
  const { method = 'GET', select = '*', filters = '', body, order, limit } = options
  
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`
  if (filters) url += `&${filters}`
  if (order) url += `&order=${order}`
  if (limit) url += `&limit=${limit}`
  
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=minimal' : 'return=representation'
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  
  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`)
  }
  
  if (method === 'POST') return null
  return response.json()
}

// ============================================
// TIME AGO HELPER
// ============================================
function timeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function App() {
  const [page, setPage] = useState<'dashboard' | 'hive' | 'export' | 'settings'>('dashboard')
  const [selectedHiveId, setSelectedHiveId] = useState<number | null>(null)
  const [hives, setHives] = useState<Hive[]>([])
  const [readings, setReadings] = useState<Record<number, Reading>>({})
  const [lvdStatus, setLvdStatus] = useState<LVDStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setError(null)
      
      // Load hives
      const hivesData = await supabaseFetch('hives', { order: 'id.asc' })
      setHives(hivesData || [])
      
      // Load latest reading for each hive
      const readingsData = await supabaseFetch('readings', { 
        order: 'recorded_at.desc',
        limit: 50
      })
      
      // Group by hive_id, keep latest
      const latestByHive: Record<number, Reading> = {}
      for (const r of (readingsData || [])) {
        if (!latestByHive[r.hive_id]) {
          latestByHive[r.hive_id] = r
        }
      }
      setReadings(latestByHive)
      
      // Load LVD status
      const lvdData = await supabaseFetch('lvd_status', {
        order: 'recorded_at.desc',
        limit: 1
      })
      if (lvdData && lvdData.length > 0) {
        setLvdStatus(lvdData[0])
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
      setLoading(false)
    }
  }

  // Check if hive is online (data within last 10 minutes)
  function isOnline(reading: Reading | undefined): boolean {
    if (!reading) return false
    const now = new Date()
    const readingTime = new Date(reading.recorded_at)
    return (now.getTime() - readingTime.getTime()) < 10 * 60 * 1000
  }

  // ============================================
  // DASHBOARD PAGE
  // ============================================
  function Dashboard() {
    const onlineCount = hives.filter(h => isOnline(readings[h.id])).length

    return (
      <div className="space-y-6">
        {/* LVD Status Bar */}
        {lvdStatus && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <span className="text-2xl">🔋</span>
                <div>
                  <div className="text-sm opacity-80">Battery</div>
                  <div className="text-xl font-bold">{lvdStatus.battery_percent}%</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm opacity-80">Voltage</div>
                  <div className="text-xl font-bold">{lvdStatus.battery_voltage}V</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  lvdStatus.lvd_status ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  LVD {lvdStatus.lvd_status ? 'ON' : 'OFF'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-1">🐝</div>
            <div className="text-2xl font-bold">{hives.length}</div>
            <div className="text-gray-500 text-sm">Total Hives</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-1">✅</div>
            <div className="text-2xl font-bold text-green-500">{onlineCount}</div>
            <div className="text-gray-500 text-sm">Online</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-1">⚠️</div>
            <div className="text-2xl font-bold text-red-500">{hives.length - onlineCount}</div>
            <div className="text-gray-500 text-sm">Offline</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-3xl mb-1">📊</div>
            <div className="text-2xl font-bold">{Object.keys(readings).length}</div>
            <div className="text-gray-500 text-sm">Active Sensors</div>
          </div>
        </div>

        {/* Hive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hives.map(hive => {
            const reading = readings[hive.id]
            const online = isOnline(reading)
            
            return (
              <div 
                key={hive.id}
                onClick={() => {
                  setSelectedHiveId(hive.id)
                  setPage('hive')
                }}
                className={`bg-white rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border-l-4 ${
                  online ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{hive.name}</h3>
                    <p className="text-gray-500 text-sm">
                      {reading ? timeAgo(reading.recorded_at) : 'No data'}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {online ? 'Online' : 'Offline'}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {reading?.temperature?.toFixed(1) || '--'}°
                    </div>
                    <div className="text-gray-500 text-sm">🌡️ Temp</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {reading?.humidity?.toFixed(0) || '--'}%
                    </div>
                    <div className="text-gray-500 text-sm">💧 Humid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-500">
                      {reading?.weight?.toFixed(1) || '--'}
                    </div>
                    <div className="text-gray-500 text-sm">⚖️ kg</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {hives.length === 0 && !loading && (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">🐝</div>
            <h3 className="text-xl font-bold mb-2">No Hives Found</h3>
            <p className="text-gray-500">Add hives in your Supabase database</p>
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // HIVE DETAIL PAGE
  // ============================================
  function HiveDetail() {
    const [hiveReadings, setHiveReadings] = useState<Reading[]>([])
    const [loadingReadings, setLoadingReadings] = useState(true)
    
    const hive = hives.find(h => h.id === selectedHiveId)
    
    useEffect(() => {
      if (selectedHiveId) {
        loadHiveReadings()
      }
    }, [selectedHiveId])
    
    async function loadHiveReadings() {
      setLoadingReadings(true)
      try {
        const data = await supabaseFetch('readings', {
          filters: `hive_id=eq.${selectedHiveId}`,
          order: 'recorded_at.desc',
          limit: 100
        })
        setHiveReadings(data || [])
      } catch (err) {
        console.error('Error loading readings:', err)
      }
      setLoadingReadings(false)
    }
    
    if (!hive) {
      return (
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-gray-500">Hive not found</p>
          <button 
            onClick={() => setPage('dashboard')}
            className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      )
    }
    
    const latestReading = hiveReadings[0]
    const online = isOnline(latestReading)

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{hive.name}</h2>
              <p className="text-gray-500">
                {latestReading ? `Last update: ${timeAgo(latestReading.recorded_at)}` : 'No data'}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm ${
              online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {online ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
          
          {latestReading && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-orange-500">
                  {latestReading.temperature?.toFixed(1)}°C
                </div>
                <div className="text-gray-600">🌡️ Temperature</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-500">
                  {latestReading.humidity?.toFixed(0) || '--'}%
                </div>
                <div className="text-gray-600">💧 Humidity</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-purple-500">
                  {latestReading.weight?.toFixed(1) || '--'} kg
                </div>
                <div className="text-gray-600">⚖️ Weight</div>
              </div>
            </div>
          )}
        </div>

        {/* API Key */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold mb-2">🔑 API Key</h3>
          <code className="bg-gray-100 px-3 py-2 rounded block text-sm break-all">
            {hive.api_key}
          </code>
        </div>

        {/* Recent Readings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold mb-4">📊 Recent Readings</h3>
          
          {loadingReadings ? (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl">🔄</div>
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          ) : hiveReadings.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No readings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Temp</th>
                    <th className="text-left py-2">Humidity</th>
                    <th className="text-left py-2">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {hiveReadings.slice(0, 20).map(r => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{timeAgo(r.recorded_at)}</td>
                      <td className="py-2">{r.temperature?.toFixed(1)}°C</td>
                      <td className="py-2">{r.humidity?.toFixed(0) || '--'}%</td>
                      <td className="py-2">{r.weight?.toFixed(1) || '--'} kg</td>
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
    const [selectedHive, setSelectedHive] = useState<string>('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [exporting, setExporting] = useState(false)

    async function handleExport() {
      setExporting(true)
      try {
        let filters = ''
        if (selectedHive !== 'all') {
          filters = `hive_id=eq.${selectedHive}`
        }
        if (startDate) {
          filters += filters ? '&' : ''
          filters += `recorded_at=gte.${startDate}T00:00:00`
        }
        if (endDate) {
          filters += filters ? '&' : ''
          filters += `recorded_at=lte.${endDate}T23:59:59`
        }

        const data = await supabaseFetch('readings', {
          filters,
          order: 'recorded_at.desc',
          limit: 10000
        })

        // Create CSV
        const headers = ['ID', 'Hive ID', 'Temperature', 'Humidity', 'Weight', 'Recorded At']
        const rows = data.map((r: Reading) => [
          r.id,
          r.hive_id,
          r.temperature,
          r.humidity || '',
          r.weight || '',
          r.recorded_at
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `beehive-data-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Export error:', err)
        alert('Failed to export data')
      }
      setExporting(false)
    }

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold mb-6">📥 Export Data</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Hive</label>
            <select
              value={selectedHive}
              onChange={(e) => setSelectedHive(e.target.value)}
              className="w-full p-3 border rounded-lg"
            >
              <option value="all">All Hives</option>
              {hives.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />
            </div>
          </div>
          
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50"
          >
            {exporting ? '⏳ Exporting...' : '📥 Download CSV'}
          </button>
        </div>
      </div>
    )
  }

  // ============================================
  // SETTINGS PAGE
  // ============================================
  function SettingsPage() {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-6">⚙️ Settings</h2>
          
          {/* API Keys */}
          <div className="mb-6">
            <h3 className="font-bold mb-3">🔑 Hive API Keys</h3>
            <p className="text-gray-500 text-sm mb-4">Use these keys in your ESP8266/ESP32 code</p>
            
            <div className="space-y-3">
              {hives.map(h => (
                <div key={h.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{h.name}</span>
                  <code className="bg-gray-200 px-2 py-1 rounded text-sm">
                    {h.api_key}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Info */}
          <div className="border-t pt-6">
            <h3 className="font-bold mb-3">📊 Supabase Connection</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Project URL:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">{SUPABASE_URL}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="text-green-500 font-medium">✅ Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* ESP8266 Code Example */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold mb-3">📟 ESP8266 Code</h3>
          <p className="text-gray-500 text-sm mb-3">Update these values in your Arduino sketch:</p>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
{`const char* SUPABASE_URL = "${SUPABASE_URL}";
const char* SUPABASE_KEY = "your-anon-key";
const char* API_KEY = "alpha_key_2024";  // From hive`}
          </pre>
        </div>
      </div>
    )
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setPage('dashboard')}
          >
            <span className="text-3xl">🐝</span>
            <span className="text-xl font-bold">Hive Monitor</span>
          </div>
          <div className="text-sm opacity-80">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin text-6xl mb-4">🐝</div>
            <p className="text-gray-500">Loading hives...</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl">
            <p className="font-bold">Error loading data</p>
            <p className="text-sm">{error}</p>
            <button 
              onClick={loadData}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {page === 'dashboard' && <Dashboard />}
            {page === 'hive' && <HiveDetail />}
            {page === 'export' && <ExportPage />}
            {page === 'settings' && <SettingsPage />}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-around py-2">
          <button
            onClick={() => setPage('dashboard')}
            className={`flex flex-col items-center p-2 ${page === 'dashboard' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <span className="text-2xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setPage('export')}
            className={`flex flex-col items-center p-2 ${page === 'export' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <span className="text-2xl">📥</span>
            <span className="text-xs">Export</span>
          </button>
          <button
            onClick={() => setPage('settings')}
            className={`flex flex-col items-center p-2 ${page === 'settings' ? 'text-amber-500' : 'text-gray-500'}`}
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
