/**
 * Export Routes (CSV Download)
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/export/csv - Download CSV
router.get('/csv', authenticateToken, async (req, res) => {
  try {
    const { hive_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        r.hive_id,
        h.name as hive_name,
        r.mcp_temp,
        r.hdc_temp,
        r.hdc_humidity,
        r.weight_kg,
        r.recorded_at
      FROM readings r 
      JOIN hives h ON r.hive_id = h.id 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (hive_id && hive_id !== 'all') {
      query += ` AND r.hive_id = $${paramIndex++}`;
      params.push(hive_id);
    }
    
    if (start_date) {
      query += ` AND r.recorded_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND r.recorded_at <= $${paramIndex++}::date + INTERVAL '1 day'`;
      params.push(end_date);
    }
    
    query += ` ORDER BY r.recorded_at ASC`;
    
    const result = await db.query(query, params);
    
    // Generate CSV
    const headers = [
      'hive_id',
      'hive_name',
      'mcp_temp_c',
      'hdc_temp_c',
      'hdc_humidity_pct',
      'weight_kg',
      'recorded_at'
    ];
    
    let csv = headers.join(',') + '\n';
    
    result.rows.forEach(row => {
      csv += [
        row.hive_id,
        `"${row.hive_name}"`,
        row.mcp_temp || '',
        row.hdc_temp || '',
        row.hdc_humidity || '',
        row.weight_kg || '',
        row.recorded_at.toISOString()
      ].join(',') + '\n';
    });
    
    // Set headers for file download
    const filename = `beehive_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Export failed'
    });
  }
});

// GET /api/export/json - Download JSON
router.get('/json', authenticateToken, async (req, res) => {
  try {
    const { hive_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT r.*, h.name as hive_name 
      FROM readings r 
      JOIN hives h ON r.hive_id = h.id 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (hive_id && hive_id !== 'all') {
      query += ` AND r.hive_id = $${paramIndex++}`;
      params.push(hive_id);
    }
    
    if (start_date) {
      query += ` AND r.recorded_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      query += ` AND r.recorded_at <= $${paramIndex++}::date + INTERVAL '1 day'`;
      params.push(end_date);
    }
    
    query += ` ORDER BY r.recorded_at ASC`;
    
    const result = await db.query(query, params);
    
    // Set headers for file download
    const filename = `beehive_export_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json({
      exported_at: new Date().toISOString(),
      total_readings: result.rows.length,
      readings: result.rows
    });
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Export failed'
    });
  }
});

// GET /api/export/stats - Get export statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_readings,
        MIN(recorded_at) as first_reading,
        MAX(recorded_at) as last_reading,
        COUNT(DISTINCT hive_id) as hives_with_data
      FROM readings
    `);
    
    res.json({
      status: 'ok',
      stats: result.rows[0]
    });
    
  } catch (error) {
    console.error('Export stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
