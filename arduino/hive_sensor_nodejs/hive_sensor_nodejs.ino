/**
 * ===========================================
 * BEE HIVE SENSOR - NODE.JS BACKEND VERSION
 * ===========================================
 * 
 * Sends data to Node.js + Express backend on Railway.app
 * 
 * ===========================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

// ============================================
// CONFIGURATION - CHANGE THESE!
// ============================================

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Server settings - YOUR RAILWAY.APP URL!
// Example: "https://your-app.railway.app"
const char* SERVER_URL = "https://your-backend.railway.app/api/receive";
const char* API_KEY = "alpha_your_api_key_here";  // Get from Settings page

// Sensor mode: 1 = DS18B20, 2 = MCP9808 + HDC1080
#define SENSOR_MODE 1

// Reading interval (30 seconds for testing, 5 minutes for production)
const unsigned long READING_INTERVAL = 30 * 1000;  // 30 seconds
// const unsigned long READING_INTERVAL = 5 * 60 * 1000;  // 5 minutes (production)

// HX711 calibration factor
const float HX711_CALIBRATION = 420.0;

// Enable/disable HX711 load cell
#define HX711_ENABLED false

// ============================================
// PIN DEFINITIONS
// ============================================

#define DS18B20_PIN D4
#define I2C_SDA D2
#define I2C_SCL D1
#define HX711_SCK D5
#define HX711_DT D6

// ============================================
// LIBRARIES
// ============================================

#if SENSOR_MODE == 1
  #include <OneWire.h>
  #include <DallasTemperature.h>
  OneWire oneWire(DS18B20_PIN);
  DallasTemperature ds18b20(&oneWire);
#else
  #include <Wire.h>
  #include <Adafruit_MCP9808.h>
  #include "ClosedCube_HDC1080.h"
  Adafruit_MCP9808 mcp9808;
  ClosedCube_HDC1080 hdc1080;
#endif

#if HX711_ENABLED
  #include "HX711.h"
  HX711 scale;
#endif

// For HTTPS
#include <WiFiClientSecure.h>
WiFiClientSecure wifiClient;

// ============================================
// GLOBAL VARIABLES
// ============================================

unsigned long lastReading = 0;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("╔═══════════════════════════════════════╗");
  Serial.println("║     🐝 BEE HIVE SENSOR v2.0 🐝        ║");
  Serial.println("║       NODE.JS BACKEND EDITION         ║");
  Serial.println("╚═══════════════════════════════════════╝");
  Serial.println();
  
  Serial.print("Sensor Mode: ");
  Serial.println(SENSOR_MODE == 1 ? "DS18B20" : "MCP9808 + HDC1080");
  Serial.print("HX711: ");
  Serial.println(HX711_ENABLED ? "ENABLED" : "DISABLED");
  Serial.print("Interval: ");
  Serial.print(READING_INTERVAL / 1000);
  Serial.println(" seconds");
  Serial.println();
  
  // Skip SSL certificate verification (for Railway.app)
  wifiClient.setInsecure();
  
  // Connect WiFi
  connectWiFi();
  
  // Initialize sensors
  initSensors();
  
  Serial.println();
  Serial.println("✓ Setup complete! Starting readings...");
  Serial.println();
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  if (now - lastReading >= READING_INTERVAL || lastReading == 0) {
    lastReading = now;
    
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    
    readAndSend();
  }
  
  delay(100);
}

// ============================================
// WIFI CONNECTION
// ============================================

void connectWiFi() {
  Serial.print("📡 Connecting to WiFi: ");
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
    Serial.println("✓ WiFi Connected!");
    Serial.print("  IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("✗ WiFi Failed!");
  }
}

// ============================================
// SENSOR INITIALIZATION
// ============================================

void initSensors() {
  Serial.println("🔧 Initializing sensors...");
  
  #if SENSOR_MODE == 1
    ds18b20.begin();
    int sensorCount = ds18b20.getDeviceCount();
    Serial.print("  DS18B20 sensors found: ");
    Serial.println(sensorCount);
    
    if (sensorCount == 0) {
      Serial.println("  ⚠️ No DS18B20 found! Check wiring:");
      Serial.println("    - RED wire → 3.3V");
      Serial.println("    - BLACK wire → GND");
      Serial.println("    - YELLOW wire → D4");
      Serial.println("    - 4.7k resistor → D4 to 3.3V");
    }
  #else
    Wire.begin(I2C_SDA, I2C_SCL);
    
    if (mcp9808.begin(0x18)) {
      Serial.println("  ✓ MCP9808 found!");
      mcp9808.setResolution(3);
    } else {
      Serial.println("  ✗ MCP9808 not found!");
    }
    
    hdc1080.begin(0x40);
    Serial.print("  HDC1080 ID: 0x");
    Serial.println(hdc1080.readManufacturerId(), HEX);
  #endif
  
  #if HX711_ENABLED
    scale.begin(HX711_DT, HX711_SCK);
    scale.set_scale(HX711_CALIBRATION);
    scale.tare();
    Serial.println("  ✓ HX711 initialized");
  #else
    Serial.println("  HX711: DISABLED");
  #endif
}

// ============================================
// READ SENSORS AND SEND DATA
// ============================================

void readAndSend() {
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("📊 Reading sensors...");
  
  float temperature = 0;
  float hdcTemp = 0;
  float humidity = 0;
  float weight = 0;
  
  #if SENSOR_MODE == 1
    ds18b20.requestTemperatures();
    delay(100);
    temperature = ds18b20.getTempCByIndex(0);
    
    if (temperature == DEVICE_DISCONNECTED_C || temperature == -127.0) {
      Serial.println("  ✗ DS18B20 error! Check wiring.");
      return;
    }
    
    Serial.print("  🌡️  Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");
  #else
    temperature = mcp9808.readTempC();
    Serial.print("  🌡️  MCP9808: ");
    Serial.print(temperature);
    Serial.println(" °C");
    
    hdcTemp = hdc1080.readTemperature();
    humidity = hdc1080.readHumidity();
    Serial.print("  💧 HDC1080: ");
    Serial.print(hdcTemp);
    Serial.print(" °C, ");
    Serial.print(humidity);
    Serial.println(" %");
  #endif
  
  #if HX711_ENABLED
    if (scale.is_ready()) {
      weight = scale.get_units(10);
      if (weight < 0) weight = 0;
      Serial.print("  ⚖️  Weight: ");
      Serial.print(weight);
      Serial.println(" kg");
    }
  #else
    Serial.println("  ⚖️  Weight: DISABLED");
  #endif
  
  sendData(temperature, hdcTemp, humidity, weight);
}

// ============================================
// SEND DATA TO SERVER
// ============================================

void sendData(float temp, float hdcTemp, float humidity, float weight) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("  ✗ WiFi not connected!");
    return;
  }
  
  Serial.println();
  Serial.println("📤 Sending to server...");
  Serial.print("  URL: ");
  Serial.println(SERVER_URL);
  
  HTTPClient http;
  
  http.begin(wifiClient, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);
  
  // Build JSON body
  String jsonBody = "{";
  jsonBody += "\"api_key\":\"" + String(API_KEY) + "\",";
  jsonBody += "\"temp\":" + String(temp, 2);
  
  #if SENSOR_MODE == 2
    jsonBody += ",\"hdc_temp\":" + String(hdcTemp, 2);
    jsonBody += ",\"humidity\":" + String(humidity, 2);
  #endif
  
  #if HX711_ENABLED
    if (weight > 0) {
      jsonBody += ",\"weight\":" + String(weight, 2);
    }
  #endif
  
  jsonBody += "}";
  
  Serial.print("  Data: ");
  Serial.println(jsonBody);
  
  int httpCode = http.POST(jsonBody);
  
  Serial.println();
  if (httpCode == 200 || httpCode == 201) {
    Serial.println("  ╔═══════════════════════════════╗");
    Serial.println("  ║   ✓ DATA SENT SUCCESSFULLY!   ║");
    Serial.println("  ╚═══════════════════════════════╝");
    String response = http.getString();
    Serial.print("  Response: ");
    Serial.println(response);
  } else if (httpCode > 0) {
    Serial.print("  ⚠️  HTTP Code: ");
    Serial.println(httpCode);
    String response = http.getString();
    Serial.print("  Response: ");
    Serial.println(response);
  } else {
    Serial.print("  ✗ Error: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println();
}
