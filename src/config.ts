/**
 * Application Configuration
 */

// API URL - Change this to your Railway backend URL!
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Timezone
export const TIMEZONE = 'Africa/Lagos';

// Reading interval (seconds)
export const READING_INTERVAL = 5 * 60; // 5 minutes

// Online threshold (seconds) - hive is "offline" after this time
export const ONLINE_THRESHOLD = 600; // 10 minutes

// Auto-refresh dashboard (milliseconds)
export const DASHBOARD_REFRESH = 30 * 1000; // 30 seconds

// Temperature thresholds for color coding
export const TEMP_THRESHOLDS = {
  critical_low: 32,
  warning_low: 33,
  warning_high: 37,
  critical_high: 38
};

// Humidity thresholds for color coding
export const HUMIDITY_THRESHOLDS = {
  critical_low: 40,
  warning_low: 50,
  warning_high: 70,
  critical_high: 80
};

// Battery thresholds
export const BATTERY_THRESHOLDS = {
  low: 20,
  medium: 50
};
