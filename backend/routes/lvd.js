/**
 * LVD (Low Voltage Disconnect) Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Helper: Calculate battery percentage
function batteryPercent(voltage) {
  // 1S Li-ion: 3.0V = 0%, 4.2V = 100%
  const percent = ((voltage - 3.0) / (4.2 - 3.0)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

// GET /api/lvd - Get current LVD status and settings
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Get latest LVD reading
    const readingResult = await db.query(
      'SELECT * FROM lvd_readings ORDER BY recorded_at DESC LIMIT 1'
    );
    
    // Get LVD settings
    const settingsResult = await db.query(
      'SELECT * FROM lvd_settings LIMIT 1'
    );
    
    const reading = readingResult.rows[0] || null;
    const settings = settingsResult.rows[0] || {
      disconnect_volt: 3.30,
      reconnect_volt: 3.60,
      lvd_enabled: true
    };
    
    // Add online status for LVD
    let lvdOnline = false;
    if (reading) {
      const lastTime = new Date(reading.recorded_at);
      const now = new Date();
      lvdOnline = (now - lastTime) / 1000 < 300; // 5 minutes
    }
    
    res.json({
      status: 'ok',
      lvd: {
        ...reading,
        is_online: lvdOnline,
        battery_percent: reading ? batteryPercent(parseFloat(reading.battery_voltage)) : null
      },
      settings
    });
    
  } catch (error) {
    console.error('Get LVD error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/lvd/settings - Get settings (for ESP8266)
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM lvd_settings LIMIT 1'
    );
    
    const settings = result.rows[0] || {
      disconnect_volt: 3.30,
      reconnect_volt: 3.60,
      lvd_enabled: true
    };
    
    res.json({
      status: 'ok',
      disconnect_volt: parseFloat(settings.disconnect_volt),
      reconnect_volt: parseFloat(settings.reconnect_volt),
      lvd_enabled: settings.lvd_enabled
    });
    
  } catch (error) {
    console.error('Get LVD settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// PUT /api/lvd/settings - Update settings
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { disconnect_volt, reconnect_volt, lvd_enabled } = req.body;
    
    // Validate
    if (disconnect_volt !== undefined) {
      const dv = parseFloat(disconnect_volt);
      if (isNaN(dv) || dv < 2.5 || dv > 4.2) {
        return res.status(400).json({
          status: 'error',
          message: 'Disconnect voltage must be between 2.5V and 4.2V'
        });
      }
    }
    
    if (reconnect_volt !== undefined) {
      const rv = parseFloat(reconnect_volt);
      if (isNaN(rv) || rv < 2.5 || rv > 4.2) {
        return res.status(400).json({
          status: 'error',
          message: 'Reconnect voltage must be between 2.5V and 4.2V'
        });
      }
    }
    
    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (disconnect_volt !== undefined) {
      updates.push(`disconnect_volt = $${paramIndex++}`);
      params.push(parseFloat(disconnect_volt));
    }
    
    if (reconnect_volt !== undefined) {
      updates.push(`reconnect_volt = $${paramIndex++}`);
      params.push(parseFloat(reconnect_volt));
    }
    
    if (lvd_enabled !== undefined) {
      updates.push(`lvd_enabled = $${paramIndex++}`);
      params.push(Boolean(lvd_enabled));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No settings to update'
      });
    }
    
    updates.push('updated_at = NOW()');
    
    // Check if settings exist
    const existsResult = await db.query('SELECT id FROM lvd_settings LIMIT 1');
    
    if (existsResult.rows.length === 0) {
      // Insert default settings first
      await db.query(
        'INSERT INTO lvd_settings (disconnect_volt, reconnect_volt, lvd_enabled) VALUES (3.30, 3.60, true)'
      );
    }
    
    // Update settings
    const result = await db.query(
      `UPDATE lvd_settings SET ${updates.join(', ')} WHERE id = (SELECT id FROM lvd_settings LIMIT 1) RETURNING *`,
      params
    );
    
    res.json({
      status: 'ok',
      message: 'Settings updated',
      settings: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update LVD settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// POST /api/lvd - Receive LVD status from ESP8266
router.post('/', async (req, res) => {
  try {
    const { voltage, lvd_status, solar_voltage } = req.body;
    
    if (voltage === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Voltage required'
      });
    }
    
    const v = parseFloat(voltage);
    if (isNaN(v) || v < 0 || v > 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid voltage'
      });
    }
    
    const percent = batteryPercent(v);
    const status = lvd_status === 1 || lvd_status === true || lvd_status === '1';
    const solar = solar_voltage !== undefined ? parseFloat(solar_voltage) : null;
    
    // Insert reading
    const result = await db.query(
      `INSERT INTO lvd_readings (battery_voltage, battery_percent, lvd_status, solar_voltage)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [v, percent, status, solar]
    );
    
    console.log(`🔋 LVD: voltage=${v}V, percent=${percent}%, status=${status ? 'ON' : 'OFF'}`);
    
    // Get current settings to return
    const settingsResult = await db.query(
      'SELECT * FROM lvd_settings LIMIT 1'
    );
    
    const settings = settingsResult.rows[0] || {
      disconnect_volt: 3.30,
      reconnect_volt: 3.60,
      lvd_enabled: true
    };
    
    res.json({
      status: 'ok',
      message: 'Reading saved',
      battery_percent: percent,
      disconnect_volt: parseFloat(settings.disconnect_volt),
      reconnect_volt: parseFloat(settings.reconnect_volt),
      lvd_enabled: settings.lvd_enabled
    });
    
  } catch (error) {
    console.error('LVD receive error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/lvd/history - Get LVD reading history
router.get('/history', optionalAuth, async (req, res) => {
  try {
    const { hours = 24, limit = 100 } = req.query;
    
    const result = await db.query(
      `SELECT * FROM lvd_readings 
       WHERE recorded_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
       ORDER BY recorded_at DESC
       LIMIT $1`,
      [Math.min(parseInt(limit) || 100, 500)]
    );
    
    res.json({
      status: 'ok',
      count: result.rows.length,
      readings: result.rows
    });
    
  } catch (error) {
    console.error('Get LVD history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
