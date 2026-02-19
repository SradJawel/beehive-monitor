const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'beehive-secret-key-2024';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('📦 Initializing database...');
    
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS hives (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        hive_id INTEGER REFERENCES hives(id),
        temperature DECIMAL(5,2),
        humidity DECIMAL(5,2),
        weight DECIMAL(6,2),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS lvd_settings (
        id SERIAL PRIMARY KEY,
        disconnect_voltage DECIMAL(4,2) DEFAULT 3.30,
        reconnect_voltage DECIMAL(4,2) DEFAULT 3.50,
        lvd_enabled BOOLEAN DEFAULT true
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS lvd_status (
        id SERIAL PRIMARY KEY,
        battery_voltage DECIMAL(4,2),
        battery_percent INTEGER,
        lvd_state BOOLEAN DEFAULT true,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ Tables created');
    
    // Check if admin exists
    const adminCheck = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin', 10);
      await client.query("INSERT INTO users (username, password) VALUES ('admin', $1)", [hashedPassword]);
      console.log('✓ Admin: admin/admin');
    }
    
    // Check if hives exist
    const hivesCheck = await client.query("SELECT id FROM hives");
    if (hivesCheck.rows.length === 0) {
      const hiveNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
      for (const name of hiveNames) {
        const apiKey = `${name.toLowerCase()}_${Math.random().toString(36).substring(2, 15)}`;
        await client.query("INSERT INTO hives (name, api_key) VALUES ($1, $2)", [name, apiKey]);
        console.log(`✓ Hive: ${name}`);
      }
    }
    
    // Check if LVD settings exist
    const lvdCheck = await client.query("SELECT id FROM lvd_settings");
    if (lvdCheck.rows.length === 0) {
      await client.query("INSERT INTO lvd_settings (disconnect_voltage, reconnect_voltage, lvd_enabled) VALUES (3.30, 3.50, true)");
      console.log('✓ LVD settings');
    }
    
    // Add sample readings
    const readingsCheck = await client.query("SELECT id FROM readings LIMIT 1");
    if (readingsCheck.rows.length === 0) {
      const hives = await client.query("SELECT id FROM hives ORDER BY id");
      for (const hive of hives.rows) {
        const temp = 32 + Math.random() * 5;
        const humidity = 55 + Math.random() * 15;
        const weight = 35 + Math.random() * 20;
        await client.query(
          "INSERT INTO readings (hive_id, temperature, humidity, weight, recorded_at) VALUES ($1, $2, $3, $4, NOW())",
          [hive.id, temp.toFixed(2), humidity.toFixed(2), weight.toFixed(2)]
        );
      }
      console.log('✓ Sample readings');
    }
    
    // Add sample LVD status
    const lvdStatusCheck = await client.query("SELECT id FROM lvd_status LIMIT 1");
    if (lvdStatusCheck.rows.length === 0) {
      await client.query("INSERT INTO lvd_status (battery_voltage, battery_percent, lvd_state, recorded_at) VALUES (3.85, 78, true, NOW())");
      console.log('✓ LVD status');
    }
    
    console.log('✅ Database ready!');
  } catch (err) {
    console.error('Database init error:', err);
  } finally {
    client.release();
  }
}

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ============================================
// ROUTES
// ============================================

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Bee Hive API is running!' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = result.rows[0];
    
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, req.user.id]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// HIVES ROUTES
app.get('/api/hives', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, 
        (SELECT row_to_json(r) FROM (
          SELECT temperature, humidity, weight, recorded_at 
          FROM readings 
          WHERE hive_id = h.id 
          ORDER BY recorded_at DESC 
          LIMIT 1
        ) r) as latest_reading
      FROM hives h 
      ORDER BY h.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get hives error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/hives/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    await pool.query("UPDATE hives SET name = $1 WHERE id = $2", [name, id]);
    res.json({ message: 'Hive updated' });
  } catch (err) {
    console.error('Update hive error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/hives/:id/regenerate-key', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT name FROM hives WHERE id = $1", [id]);
    const hive = result.rows[0];
    
    const newKey = `${hive.name.toLowerCase()}_${Math.random().toString(36).substring(2, 15)}`;
    await pool.query("UPDATE hives SET api_key = $1 WHERE id = $2", [newKey, id]);
    
    res.json({ api_key: newKey });
  } catch (err) {
    console.error('Regenerate key error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// READINGS ROUTES (ESP8266 posts here - no auth required)
app.post('/api/readings', async (req, res) => {
  try {
    const { api_key, temp, temperature, hdc_temp, humidity, weight } = req.body;
    
    if (!api_key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Find hive by API key
    const hiveResult = await pool.query("SELECT id FROM hives WHERE api_key = $1", [api_key]);
    const hive = hiveResult.rows[0];
    
    if (!hive) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Insert reading
    const tempValue = temp || temperature || null;
    const humidityValue = humidity || null;
    const weightValue = weight || null;
    
    await pool.query(
      "INSERT INTO readings (hive_id, temperature, humidity, weight, recorded_at) VALUES ($1, $2, $3, $4, NOW())",
      [hive.id, tempValue, humidityValue, weightValue]
    );
    
    console.log(`📊 Reading from hive ${hive.id}: temp=${tempValue}, humidity=${humidityValue}, weight=${weightValue}`);
    res.json({ status: 'success', message: 'Reading saved' });
  } catch (err) {
    console.error('Save reading error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/readings/:hiveId', authenticateToken, async (req, res) => {
  try {
    const { hiveId } = req.params;
    const { range } = req.query;
    
    let timeFilter = "NOW() - INTERVAL '24 hours'";
    if (range === '7d') timeFilter = "NOW() - INTERVAL '7 days'";
    if (range === '30d') timeFilter = "NOW() - INTERVAL '30 days'";
    
    const result = await pool.query(`
      SELECT * FROM readings 
      WHERE hive_id = $1 AND recorded_at > ${timeFilter}
      ORDER BY recorded_at DESC
    `, [hiveId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get readings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LVD ROUTES
app.get('/api/lvd', authenticateToken, async (req, res) => {
  try {
    const settingsResult = await pool.query("SELECT * FROM lvd_settings ORDER BY id DESC LIMIT 1");
    const statusResult = await pool.query("SELECT * FROM lvd_status ORDER BY recorded_at DESC LIMIT 1");
    
    res.json({
      settings: settingsResult.rows[0] || {},
      status: statusResult.rows[0] || {}
    });
  } catch (err) {
    console.error('Get LVD error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/lvd/settings', authenticateToken, async (req, res) => {
  try {
    const { disconnect_voltage, reconnect_voltage, lvd_enabled } = req.body;
    
    await pool.query(
      "UPDATE lvd_settings SET disconnect_voltage = $1, reconnect_voltage = $2, lvd_enabled = $3",
      [disconnect_voltage, reconnect_voltage, lvd_enabled]
    );
    
    res.json({ message: 'LVD settings updated' });
  } catch (err) {
    console.error('Update LVD settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/lvd/status', async (req, res) => {
  try {
    const { api_key, battery_voltage, battery_percent, lvd_state } = req.body;
    
    await pool.query(
      "INSERT INTO lvd_status (battery_voltage, battery_percent, lvd_state, recorded_at) VALUES ($1, $2, $3, NOW())",
      [battery_voltage, battery_percent, lvd_state]
    );
    
    res.json({ status: 'success' });
  } catch (err) {
    console.error('Save LVD status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// EXPORT ROUTES
app.get('/api/export/csv', authenticateToken, async (req, res) => {
  try {
    const { hive_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT h.name as hive_name, r.temperature, r.humidity, r.weight, r.recorded_at
      FROM readings r
      JOIN hives h ON r.hive_id = h.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (hive_id && hive_id !== 'all') {
      paramCount++;
      query += ` AND r.hive_id = $${paramCount}`;
      params.push(hive_id);
    }
    
    if (start_date) {
      paramCount++;
      query += ` AND r.recorded_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      query += ` AND r.recorded_at <= $${paramCount}`;
      params.push(end_date + ' 23:59:59');
    }
    
    query += ' ORDER BY r.recorded_at DESC';
    
    const result = await pool.query(query, params);
    
    // Generate CSV
    let csv = 'Hive,Temperature (°C),Humidity (%),Weight (kg),Recorded At\n';
    for (const row of result.rows) {
      csv += `${row.hive_name},${row.temperature || ''},${row.humidity || ''},${row.weight || ''},${row.recorded_at}\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=beehive_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
async function start() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🐝 ═══════════════════════════════════════
🐝  BEE HIVE MONITORING - BACKEND
🐝 ═══════════════════════════════════════
🚀 Server running on http://localhost:${PORT}

📋 Endpoints:
   GET  /api/test        - Test API
   POST /api/auth/login  - Login
   GET  /api/hives       - Get hives
   POST /api/readings    - ESP8266 posts here

🔑 Login: admin / admin
`);
  });
}

start();

