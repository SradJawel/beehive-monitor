/**
 * ESP8266/ESP32 Data Receive Endpoint
 * No authentication - uses API key per hive
 */

const db = require('../db');

module.exports = async (req, res) => {
  try {
    // Get parameters (support both form data and JSON)
    const data = req.body;
    
    const apiKey = data.api_key;
    const temp = data.temp !== undefined ? parseFloat(data.temp) : null;
    const hdcTemp = data.hdc_temp !== undefined ? parseFloat(data.hdc_temp) : null;
    const humidity = data.humidity !== undefined ? parseFloat(data.humidity) : null;
    const weight = data.weight !== undefined ? parseFloat(data.weight) : null;
    
    // Validate API key
    if (!apiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'API key required'
      });
    }
    
    // Find hive by API key
    const hiveResult = await db.query(
      'SELECT id FROM hives WHERE api_key = $1 AND is_active = true',
      [apiKey]
    );
    
    if (hiveResult.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid API key'
      });
    }
    
    const hiveId = hiveResult.rows[0].id;
    
    // Validate temperature
    if (temp === null || isNaN(temp)) {
      return res.status(400).json({
        status: 'error',
        message: 'Temperature required'
      });
    }
    
    // Validate reasonable ranges
    if (temp < -40 || temp > 85) {
      return res.status(400).json({
        status: 'error',
        message: 'Temperature out of range (-40 to 85°C)'
      });
    }
    
    // Insert reading
    const result = await db.query(
      `INSERT INTO readings (hive_id, mcp_temp, hdc_temp, hdc_humidity, weight_kg, recorded_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [hiveId, temp, hdcTemp, humidity, weight]
    );
    
    console.log(`📥 Reading from hive ${hiveId}: temp=${temp}°C`);
    
    res.json({
      status: 'ok',
      message: 'Reading saved',
      id: result.rows[0].id
    });
    
  } catch (error) {
    console.error('Receive error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
};
