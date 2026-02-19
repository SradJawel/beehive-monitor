/**
 * Hives Routes
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// GET /api/hives - Get all hives with latest readings
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Get all active hives
    const hivesResult = await db.query(
      'SELECT * FROM hives WHERE is_active = true ORDER BY id'
    );
    
    const hives = hivesResult.rows;
    
    // Get latest reading for each hive
    for (let hive of hives) {
      const readingResult = await db.query(
        `SELECT * FROM readings 
         WHERE hive_id = $1 
         ORDER BY recorded_at DESC 
         LIMIT 1`,
        [hive.id]
      );
      
      hive.latest = readingResult.rows[0] || null;
      
      // Calculate online status (< 10 minutes = online)
      if (hive.latest) {
        const lastTime = new Date(hive.latest.recorded_at);
        const now = new Date();
        const diffSeconds = (now - lastTime) / 1000;
        hive.is_online = diffSeconds < 600;
        hive.seconds_ago = Math.floor(diffSeconds);
      } else {
        hive.is_online = false;
        hive.seconds_ago = null;
      }
      
      // Don't expose API key unless authenticated
      if (!req.user) {
        delete hive.api_key;
      }
    }
    
    res.json({
      status: 'ok',
      hives
    });
    
  } catch (error) {
    console.error('Get hives error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/hives/:id - Get single hive with readings
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const range = req.query.range || '24h';
    
    // Get hive
    const hiveResult = await db.query(
      'SELECT * FROM hives WHERE id = $1',
      [id]
    );
    
    if (hiveResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Hive not found'
      });
    }
    
    const hive = hiveResult.rows[0];
    
    // Calculate hours based on range
    let hours;
    switch (range) {
      case '7d': hours = 24 * 7; break;
      case '30d': hours = 24 * 30; break;
      default: hours = 24;
    }
    
    // Get readings
    const readingsResult = await db.query(
      `SELECT * FROM readings 
       WHERE hive_id = $1 
       AND recorded_at >= NOW() - INTERVAL '${hours} hours'
       ORDER BY recorded_at ASC`,
      [id]
    );
    
    // Get latest reading
    const latestResult = await db.query(
      `SELECT * FROM readings 
       WHERE hive_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [id]
    );
    
    hive.latest = latestResult.rows[0] || null;
    hive.readings = readingsResult.rows;
    
    // Calculate stats
    const temps = readingsResult.rows
      .map(r => parseFloat(r.mcp_temp))
      .filter(t => !isNaN(t));
    
    const humids = readingsResult.rows
      .map(r => parseFloat(r.hdc_humidity))
      .filter(h => !isNaN(h));
    
    const weights = readingsResult.rows
      .map(r => parseFloat(r.weight_kg))
      .filter(w => !isNaN(w));
    
    hive.stats = {
      temp: {
        avg: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
        min: temps.length ? Math.min(...temps) : null,
        max: temps.length ? Math.max(...temps) : null
      },
      humidity: {
        avg: humids.length ? humids.reduce((a, b) => a + b, 0) / humids.length : null
      },
      weight: {
        avg: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null
      },
      readings_count: readingsResult.rows.length
    };
    
    // Online status
    if (hive.latest) {
      const lastTime = new Date(hive.latest.recorded_at);
      const now = new Date();
      hive.is_online = (now - lastTime) / 1000 < 600;
    } else {
      hive.is_online = false;
    }
    
    // Don't expose API key unless authenticated
    if (!req.user) {
      delete hive.api_key;
    }
    
    res.json({
      status: 'ok',
      hive
    });
    
  } catch (error) {
    console.error('Get hive error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// PUT /api/hives/:id - Update hive name
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Name is required'
      });
    }
    
    const result = await db.query(
      'UPDATE hives SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Hive not found'
      });
    }
    
    res.json({
      status: 'ok',
      message: 'Hive updated',
      hive: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update hive error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// POST /api/hives/:id/regenerate-key - Regenerate API key
router.post('/:id/regenerate-key', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get hive name for prefix
    const hiveResult = await db.query(
      'SELECT name FROM hives WHERE id = $1',
      [id]
    );
    
    if (hiveResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Hive not found'
      });
    }
    
    // Generate new API key
    const prefix = hiveResult.rows[0].name.toLowerCase();
    const newKey = `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
    
    const result = await db.query(
      'UPDATE hives SET api_key = $1 WHERE id = $2 RETURNING *',
      [newKey, id]
    );
    
    res.json({
      status: 'ok',
      message: 'API key regenerated',
      api_key: newKey
    });
    
  } catch (error) {
    console.error('Regenerate key error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
