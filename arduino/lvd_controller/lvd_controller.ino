/**
 * ===========================================
 * LVD CONTROLLER - D1 Mini (ESP8266)
 * ===========================================
 * 
 * Low Voltage Disconnect controller for bee hive system
 * 
 * Features:
 * - Monitors battery voltage via voltage divider on A0
 * - Controls relay to disconnect/reconnect hives
 * - Fetches thresholds from server (programmable!)
 * - Reports battery status to server
 * 
 * Wiring:
 * - A0: Voltage divider (100k + 10k) from battery
 * - D7 (GPIO13): Relay IN (active LOW for most modules)
 * - VCC: Powered directly from battery via HT7833
 * 
 * Voltage Divider:
 *   Battery+ ──┬── 100kΩ ──┬── 10kΩ ──┬── GND
 *              │           │          │
 *              │           └── A0     │
 *              └──────────────────────┘
 * 
 *   Vout = Vin × (R2 / (R1 + R2))
 *   Vout = Vin × (10k / 110k) = Vin × 0.0909
 *   
 *   For 4.2V battery: A0 reads 0.38V (383 on ADC)
 *   For 3.0V battery: A0 reads 0.27V (273 on ADC)
 * 
 * ===========================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// ============================================
// CONFIGURATION - CHANGE THESE!
// ============================================

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Server settings
const char* LVD_API_URL = "http://your-server.com/api/lvd.php";

// Reading interval (milliseconds)
const unsigned long READING_INTERVAL = 1 * 60 * 1000; // 1 minute
const unsigned long SETTINGS_INTERVAL = 5 * 60 * 1000; // Fetch settings every 5 min

// Default LVD thresholds (will be overwritten by server settings)
float disconnectVoltage = 3.30;
float reconnectVoltage = 3.60;
bool lvdEnabled = true;

// ============================================
// PIN DEFINITIONS
// ============================================

#define VOLTAGE_PIN A0
#define RELAY_PIN D7

// ============================================
// VOLTAGE DIVIDER CALIBRATION
// ============================================

// Resistor values (measure with multimeter for accuracy!)
const float R1 = 100000.0; // 100kΩ
const float R2 = 10000.0;  // 10kΩ

// ESP8266 ADC reference voltage (usually 1.0V internal)
const float ADC_REF = 1.0;
const int ADC_MAX = 1024;

// Calculate voltage divider ratio
const float DIVIDER_RATIO = R2 / (R1 + R2); // 0.0909

// ============================================
// GLOBAL VARIABLES
// ============================================

WiFiClient wifiClient;
unsigned long lastReading = 0;
unsigned long lastSettingsFetch = 0;
bool relayState = true; // true = ON (hives powered)

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  LVD CONTROLLER v1.0");
  Serial.println("=================================");
  Serial.println();
  
  // Initialize relay pin (start with relay ON)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // LOW = relay ON for most modules
  relayState = true;
  
  // Connect to WiFi
  connectWiFi();
  
  // Fetch initial settings from server
  fetchSettings();
  
  Serial.println("Setup complete!");
  Serial.print("Disconnect at: ");
  Serial.print(disconnectVoltage);
  Serial.println("V");
  Serial.print("Reconnect at: ");
  Serial.print(reconnectVoltage);
  Serial.println("V");
  Serial.println();
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  // Fetch settings periodically
  if (now - lastSettingsFetch >= SETTINGS_INTERVAL || lastSettingsFetch == 0) {
    lastSettingsFetch = now;
    fetchSettings();
  }
  
  // Read battery and control relay
  if (now - lastReading >= READING_INTERVAL || lastReading == 0) {
    lastReading = now;
    
    // Reconnect WiFi if needed
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    
    // Read battery voltage
    float voltage = readBatteryVoltage();
    
    // Control relay based on voltage
    controlRelay(voltage);
    
    // Send status to server
    sendStatus(voltage);
  }
  
  delay(100);
}

// ============================================
// WIFI CONNECTION
// ============================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
  }
}

// ============================================
// READ BATTERY VOLTAGE
// ============================================

float readBatteryVoltage() {
  // Take multiple readings for stability
  long total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(VOLTAGE_PIN);
    delay(10);
  }
  int avgReading = total / 10;
  
  // Convert ADC reading to voltage at divider output
  float dividerVoltage = (avgReading / (float)ADC_MAX) * ADC_REF;
  
  // Calculate actual battery voltage
  float batteryVoltage = dividerVoltage / DIVIDER_RATIO;
  
  Serial.print("ADC: ");
  Serial.print(avgReading);
  Serial.print(" | Battery: ");
  Serial.print(batteryVoltage, 3);
  Serial.println("V");
  
  return batteryVoltage;
}

// ============================================
// RELAY CONTROL (LVD Logic)
// ============================================

void controlRelay(float voltage) {
  if (!lvdEnabled) {
    // LVD disabled, keep relay ON
    if (!relayState) {
      Serial.println("LVD disabled - turning relay ON");
      digitalWrite(RELAY_PIN, LOW); // LOW = ON
      relayState = true;
    }
    return;
  }
  
  // Hysteresis logic
  if (relayState) {
    // Currently ON - check if we need to disconnect
    if (voltage < disconnectVoltage) {
      Serial.println("⚠️ LOW VOLTAGE - Disconnecting hives!");
      digitalWrite(RELAY_PIN, HIGH); // HIGH = OFF
      relayState = false;
    }
  } else {
    // Currently OFF - check if we can reconnect
    if (voltage > reconnectVoltage) {
      Serial.println("✅ Voltage recovered - Reconnecting hives!");
      digitalWrite(RELAY_PIN, LOW); // LOW = ON
      relayState = true;
    }
  }
  
  Serial.print("Relay: ");
  Serial.println(relayState ? "ON" : "OFF");
}

// ============================================
// FETCH SETTINGS FROM SERVER
// ============================================

void fetchSettings() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, using cached settings");
    return;
  }
  
  Serial.println("Fetching LVD settings from server...");
  
  HTTPClient http;
  http.begin(wifiClient, LVD_API_URL);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println(response);
    
    // Parse JSON response
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      disconnectVoltage = doc["disconnect_volt"] | 3.30;
      reconnectVoltage = doc["reconnect_volt"] | 3.60;
      lvdEnabled = doc["lvd_enabled"] | true;
      
      Serial.print("Settings updated - Disconnect: ");
      Serial.print(disconnectVoltage);
      Serial.print("V, Reconnect: ");
      Serial.print(reconnectVoltage);
      Serial.print("V, Enabled: ");
      Serial.println(lvdEnabled ? "Yes" : "No");
    } else {
      Serial.println("JSON parse error!");
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(httpCode);
  }
  
  http.end();
}

// ============================================
// SEND STATUS TO SERVER
// ============================================

void sendStatus(float voltage) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping send");
    return;
  }
  
  HTTPClient http;
  http.begin(wifiClient, LVD_API_URL);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  
  // Build POST data
  String postData = "voltage=" + String(voltage, 2);
  postData += "&lvd_status=" + String(relayState ? 1 : 0);
  
  Serial.print("Sending: ");
  Serial.println(postData);
  
  int httpCode = http.POST(postData);
  
  if (httpCode > 0) {
    Serial.print("HTTP Response: ");
    Serial.println(httpCode);
    String response = http.getString();
    Serial.println(response);
    
    // Update settings from response
    if (httpCode == 200) {
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, response);
      
      if (!error && doc.containsKey("disconnect_volt")) {
        disconnectVoltage = doc["disconnect_volt"] | disconnectVoltage;
        reconnectVoltage = doc["reconnect_volt"] | reconnectVoltage;
        lvdEnabled = doc["lvd_enabled"] | lvdEnabled;
      }
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println();
}
