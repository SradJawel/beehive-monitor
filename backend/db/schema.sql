-- ============================================
-- BEE HIVE MONITORING - POSTGRESQL SCHEMA
-- ============================================
-- Run this on Railway.app PostgreSQL
-- ============================================

-- Set timezone
SET timezone = 'Africa/Lagos';

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default admin (password: admin)
-- Hash generated with bcrypt, rounds=10
INSERT INTO users (username, password) VALUES 
('admin', '$2b$12$CXRHbr57.2e10BtKOcMlDufmyixcEyPlFLNQK8YpkVejn2JoNDMIi')
ON CONFLICT (username) DO NOTHING;

-- Hives table
CREATE TABLE IF NOT EXISTS hives (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    sensor_mode SMALLINT DEFAULT 1,  -- 1=DS18B20, 2=MCP9808+HDC1080
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default hives
INSERT INTO hives (name, api_key) VALUES 
('Alpha', 'alpha_' || md5(random()::text)),
('Bravo', 'bravo_' || md5(random()::text)),
('Charlie', 'charlie_' || md5(random()::text)),
('Delta', 'delta_' || md5(random()::text))
ON CONFLICT DO NOTHING;

-- Readings table
CREATE TABLE IF NOT EXISTS readings (
    id SERIAL PRIMARY KEY,
    hive_id INTEGER NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    mcp_temp DECIMAL(5,2),      -- MCP9808 or DS18B20 temp
    hdc_temp DECIMAL(5,2),      -- HDC1080 temp (optional)
    hdc_humidity DECIMAL(5,2),  -- HDC1080 humidity (optional)
    weight_kg DECIMAL(6,2),     -- Load cell weight
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_readings_hive_time ON readings(hive_id, recorded_at DESC);

-- LVD readings table
CREATE TABLE IF NOT EXISTS lvd_readings (
    id SERIAL PRIMARY KEY,
    battery_voltage DECIMAL(4,2) NOT NULL,
    battery_percent SMALLINT,
    lvd_status BOOLEAN DEFAULT true,  -- true=ON, false=OFF
    solar_voltage DECIMAL(4,2),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lvd_time ON lvd_readings(recorded_at DESC);

-- LVD settings table
CREATE TABLE IF NOT EXISTS lvd_settings (
    id SERIAL PRIMARY KEY,
    disconnect_volt DECIMAL(4,2) DEFAULT 3.30,
    reconnect_volt DECIMAL(4,2) DEFAULT 3.60,
    lvd_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default LVD settings
INSERT INTO lvd_settings (disconnect_volt, reconnect_volt, lvd_enabled) 
SELECT 3.30, 3.60, true
WHERE NOT EXISTS (SELECT 1 FROM lvd_settings);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
('backup_enabled', 'true'),
('backup_frequency', 'weekly'),
('reading_interval', '5')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate battery percentage
CREATE OR REPLACE FUNCTION battery_percent(voltage DECIMAL) 
RETURNS INTEGER AS $$
BEGIN
    -- 1S Li-ion: 3.0V = 0%, 4.2V = 100%
    RETURN GREATEST(0, LEAST(100, ROUND(((voltage - 3.0) / (4.2 - 3.0)) * 100)));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment to insert test data:
/*
INSERT INTO readings (hive_id, mcp_temp, hdc_temp, hdc_humidity, weight_kg, recorded_at) VALUES
(1, 34.50, 28.50, 62.30, 45.20, NOW() - INTERVAL '5 minutes'),
(1, 34.75, 28.45, 62.50, 45.18, NOW()),
(2, 35.10, 29.00, 58.20, 42.80, NOW() - INTERVAL '5 minutes'),
(2, 35.25, 29.10, 58.00, 42.75, NOW()),
(3, 34.80, 28.80, 65.10, 48.10, NOW() - INTERVAL '5 minutes'),
(3, 34.90, 28.75, 65.30, 48.05, NOW()),
(4, 33.90, 27.50, 61.00, 39.50, NOW() - INTERVAL '15 minutes');

INSERT INTO lvd_readings (battery_voltage, battery_percent, lvd_status) VALUES
(3.85, 71, true);
*/
