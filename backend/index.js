const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'beehive-secret-key-change-in-production';

// Database setup
const dbPath = path.join(__dirname, 'beehive.db');
const db = new Database(dbPath);

console.log('🐝 ═══════════════════════════════════════');
console.log('🐝  BEE HIVE MONITORING - BACKEND');
console.log('🐝 ═══════════════════════════════════════');
console.log(`📦 Database: ${dbPath}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS hives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hive_id INTEGER NOT NULL,
    temperature REAL,
    humidity REAL,
    weight REAL,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hive_id) REFERENCES hives(id)
  );
  
  CREATE TABLE IF NOT EXISTS lvd_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    disconnect_voltage REAL DEFAULT 3.3,
    reconnect_voltage REAL DEFAULT 3.5,
    lvd_enabled INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS lvd_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    battery_voltage REAL,
    battery_percent INTEGER,
    lvd_state INTEGER DEFAULT 1,
    recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✓ Tables created');

// Helper function to get current timestamp
function now() {
  return new Date().toISOString();
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// Initialize default data
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('✓ Admin: admin/admin');
}

const hivesExist = db.prepare('SELECT COUNT(*) as count FROM hives').get();
if (hivesExist.count === 0) {
  const hiveNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  const insertHive = db.prepare('INSERT INTO hives (name, api_key) VALUES (?, ?)');
  
  hiveNames.forEach(name => {
    const apiKey = `${name.toLowerCase()}_${Math.random().toString(36).substring(2, 15)}`;
    insertHive.run(name, apiKey);
    console.log(`✓ Hive: ${name}`);
  });
}

const lvdExists = db.prepare('SELECT COUNT(*) as count FROM lvd_settings').get();
if (lvdExists.count === 0) {
  db.prepare('INSERT INTO lvd_settings (disconnect_voltage, reconnect_voltage, lvd_enabled) VALUES (?, ?, ?)').run(3.3, 3.5, 1);
  console.log('✓ LVD settings');
}

// Add sample readings
const readingsExist = db.prepare('SELECT COUNT(*) as count FROM readings').get();
if (readingsExist.count === 0) {
  const insertReading = db.prepare('INSERT INTO readings (hive_id, temperature, humidity, weight, recorded_at) VALUES (?, ?, ?, ?, ?)');
  
  // Add readings for each hive
  for (let hiveId = 1; hiveId <= 4; hiveId++) {
    // Recent readings
    insertReading.run(hiveId, 34.5 + Math.random() * 2, 60 + Math.random() * 10, 40 + Math.random() * 10, now());
    insertReading.run(hiveId, 34.0 + Math.random() * 2, 58 + Math.random() * 10, 40 + Math.random() * 10, hoursAgo(1));
    insertReading.run(hiveId, 33.5 + Math.random() * 2, 62 + Math.random() * 10, 40 + Math.random() * 10, hoursAgo(2));
    insertReading.run(hiveId, 35.0 + Math.random() * 2, 55 + Math.random() * 10, 40 + Math.random() * 10, hoursAgo(3));
  }
  console.log('✓ Sample readings');
}

// Add sample LVD status
const lvdStatusExists = db.prepare('SELECT COUNT(*) as count FROM lvd_status').get();
if (lvdStatusExists.count === 0) {
  db.prepare('INSERT INTO lvd_status (battery_voltage, battery_percent, lvd_state, recorded_at) VALUES (?, ?, ?, ?)').run(3.85, 78, 1, now());
  console.log('✓ LVD status');
}

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ============== ROUTES ==============

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Bee Hive API is running!' });
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all hives with latest readings
app.get('/api/hives', authMiddleware, (req, res) => {
  try {
    const hives = db.prepare(`
      SELECT h.*, 
        r.temperature, r.humidity, r.weight, r.recorded_at as last_reading
      FROM hives h
      LEFT JOIN readings r ON r.id = (
        SELECT id FROM readings WHERE hive_id = h.id ORDER BY recorded_at DESC LIMIT 1
      )
      ORDER BY h.id
    `).all();
    
    res.json(hives);
  } catch (err) {
    console.error('Get hives error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single hive with readings
app.get('/api/hives/:id', authMiddleware, (req, res) => {
  try {
    const hive = db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    if (!hive) {
      return res.status(404).json({ error: 'Hive not found' });
    }
    
    const readings = db.prepare(`
      SELECT * FROM readings 
      WHERE hive_id = ? 
      ORDER BY recorded_at DESC 
      LIMIT 100
    `).all(req.params.id);
    
    res.json({ ...hive, readings });
  } catch (err) {
    console.error('Get hive error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update hive name
app.put('/api/hives/:id', authMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    db.prepare('UPDATE hives SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Update hive error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ESP8266 posts readings here (NO AUTH - uses API key)
app.post('/api/readings', (req, res) => {
  try {
    const { api_key, temperature, temp, humidity, weight } = req.body;
    
    // Find hive by API key
    const hive = db.prepare('SELECT id FROM hives WHERE api_key = ?').get(api_key);
    if (!hive) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    const tempValue = temperature || temp || null;
    const timestamp = now();
    
    db.prepare(`
      INSERT INTO readings (hive_id, temperature, humidity, weight, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(hive.id, tempValue, humidity || null, weight || null, timestamp);
    
    console.log(`📥 Reading from Hive ${hive.id}: temp=${tempValue}, humidity=${humidity}, weight=${weight}`);
    res.json({ status: 'success', message: 'Reading saved' });
  } catch (err) {
    console.error('Post reading error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get LVD status
app.get('/api/lvd', authMiddleware, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM lvd_settings ORDER BY id DESC LIMIT 1').get();
    const status = db.prepare('SELECT * FROM lvd_status ORDER BY recorded_at DESC LIMIT 1').get();
    res.json({ settings, status });
  } catch (err) {
    console.error('Get LVD error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update LVD settings
app.put('/api/lvd/settings', authMiddleware, (req, res) => {
  try {
    const { disconnect_voltage, reconnect_voltage, lvd_enabled } = req.body;
    db.prepare(`
      UPDATE lvd_settings 
      SET disconnect_voltage = ?, reconnect_voltage = ?, lvd_enabled = ?, updated_at = ?
    `).run(disconnect_voltage, reconnect_voltage, lvd_enabled ? 1 : 0, now());
    res.json({ success: true });
  } catch (err) {
    console.error('Update LVD error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ESP8266 posts LVD status (NO AUTH - uses simple endpoint)
app.post('/api/lvd/status', (req, res) => {
  try {
    const { battery_voltage, battery_percent, lvd_state } = req.body;
    db.prepare(`
      INSERT INTO lvd_status (battery_voltage, battery_percent, lvd_state, recorded_at)
      VALUES (?, ?, ?, ?)
    `).run(battery_voltage, battery_percent, lvd_state, now());
    
    console.log(`🔋 LVD Status: ${battery_voltage}V, ${battery_percent}%, state=${lvd_state}`);
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Post LVD status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export CSV
app.get('/api/export/csv', authMiddleware, (req, res) => {
  try {
    const { hive_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT h.name as hive_name, r.temperature, r.humidity, r.weight, r.recorded_at
      FROM readings r
      JOIN hives h ON r.hive_id = h.id
      WHERE 1=1
    `;
    const params = [];
    
    if (hive_id && hive_id !== 'all') {
      query += ' AND r.hive_id = ?';
      params.push(hive_id);
    }
    if (start_date) {
      query += ' AND r.recorded_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND r.recorded_at <= ?';
      params.push(end_date + 'T23:59:59');
    }
    query += ' ORDER BY r.recorded_at DESC';
    
    const readings = db.prepare(query).all(...params);
    
    // Generate CSV
    let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Recorded At\n';
    readings.forEach(r => {
      csv += `${r.hive_name},${r.temperature || ''},${r.humidity || ''},${r.weight || ''},${r.recorded_at}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=beehive_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
app.put('/api/auth/password', authMiddleware, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Also available at http://127.0.0.1:${PORT}`);
  console.log('');
  console.log('📋 Test endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/test`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log('');
  console.log('🔑 Login: admin / admin');
});
