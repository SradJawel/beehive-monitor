/**
 * Readings Routes
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

// GET /api/readings - Get readings with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      hive_id, 
      start_date, 
      end_date, 
      limit = 100 
    } = req.query;
    
    let query = `
      SELECT r.*, h.name as hive_name 
      FROM readings r 
      JOIN hives h ON r.hive_id = h.id 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (hive_id) {
      query += ` AND r.hive_id = $${paramIndex++}`;
      params.push(hive_id);
    }
    
    if (start_date) {
      query += ` AND r.recorded_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND r.recorded_at <= $${paramIndex++}`;
      params.push(end_date);
    }
    
    query += ` ORDER BY r.recorded_at DESC LIMIT $${paramIndex++}`;
    params.push(Math.min(parseInt(limit) || 100, 1000));
    
    const result = await db.query(query, params);
    
    res.json({
      status: 'ok',
      count: result.rows.length,
      readings: result.rows
    });
    
  } catch (error) {
    console.error('Get readings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/readings/latest - Get latest reading for each hive
router.get('/latest', optionalAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (r.hive_id) 
        r.*, h.name as hive_name
      FROM readings r
      JOIN hives h ON r.hive_id = h.id
      WHERE h.is_active = true
      ORDER BY r.hive_id, r.recorded_at DESC
    `);
    
    // Add online status
    const readings = result.rows.map(r => {
      const lastTime = new Date(r.recorded_at);
      const now = new Date();
      const diffSeconds = (now - lastTime) / 1000;
      return {
        ...r,
        is_online: diffSeconds < 600,
        seconds_ago: Math.floor(diffSeconds)
      };
    });
    
    res.json({
      status: 'ok',
      readings
    });
    
  } catch (error) {
    console.error('Get latest readings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/readings/chart - Get readings for chart
router.get('/chart', optionalAuth, async (req, res) => {
  try {
    const { hive_id, hours = 24 } = req.query;
    
    let query = `
      SELECT r.*, h.name as hive_name 
      FROM readings r 
      JOIN hives h ON r.hive_id = h.id 
      WHERE r.recorded_at >= NOW() - INTERVAL '${parseInt(hours)} hours'
    `;
    const params = [];
    
    if (hive_id) {
      query += ` AND r.hive_id = $1`;
      params.push(hive_id);
    }
    
    query += ` ORDER BY r.recorded_at ASC`;
    
    const result = await db.query(query, params);
    
    // Sample data if too many points (max 200)
    let readings = result.rows;
    if (readings.length > 200) {
      const step = Math.ceil(readings.length / 200);
      readings = readings.filter((_, i) => i % step === 0);
    }
    
    res.json({
      status: 'ok',
      count: readings.length,
      readings
    });
    
  } catch (error) {
    console.error('Get chart readings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/readings/stats - Get statistics
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const { hive_id, hours = 24 } = req.query;
    
    let whereClause = `recorded_at >= NOW() - INTERVAL '${parseInt(hours)} hours'`;
    const params = [];
    
    if (hive_id) {
      whereClause += ` AND hive_id = $1`;
      params.push(hive_id);
    }
    
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_readings,
        AVG(mcp_temp) as avg_temp,
        MIN(mcp_temp) as min_temp,
        MAX(mcp_temp) as max_temp,
        AVG(hdc_humidity) as avg_humidity,
        AVG(weight_kg) as avg_weight
      FROM readings 
      WHERE ${whereClause}
    `, params);
    
    res.json({
      status: 'ok',
      stats: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
