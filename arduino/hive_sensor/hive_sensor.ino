/**
 * ===========================================
 * BEE HIVE SENSOR - ESP8266 / ESP32
 * ===========================================
 * 
 * Sensors:
 * - SLOT A (NOW): DS18B20 (iron probe) - Temperature
 * - SLOT B (LATER): MCP9808 + HDC1080 - Precision temp + humidity
 * - HX711 + 50kg Load Cell - Weight
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
const char* WIFI_SSID = "Srad Jawel";
const char* WIFI_PASS = "192.168.8.9";

// Server settings (HTTP - not HTTPS!)
const char* SERVER_URL = "http://beehive.yzz.me/api/receive.php";
const char* API_KEY = "alpha_995be19d084b4f0b272431f057a50f0f";

// Sensor mode: 1 = DS18B20, 2 = MCP9808 + HDC1080
#define SENSOR_MODE 1

// Reading interval (30 seconds for testing, change to 5*60*1000 for production)
const unsigned long READING_INTERVAL = 30 * 1000;

// HX711 calibration factor (adjust after calibration!)
const float HX711_CALIBRATION = 420.0;

// Enable/disable HX711 load cell (set to false if not connected!)
#define HX711_ENABLED false

// ============================================
// PIN DEFINITIONS
// ============================================

// DS18B20 (OneWire)
#define DS18B20_PIN D4

// I2C (MCP9808 & HDC1080)
#define I2C_SDA D2
#define I2C_SCL D1

// HX711 Load Cell
#define HX711_SCK D5
#define HX711_DT D6

// ============================================
// LIBRARIES
// ============================================

#if SENSOR_MODE == 1
  // DS18B20
  #include <OneWire.h>
  #include <DallasTemperature.h>
  OneWire oneWire(DS18B20_PIN);
  DallasTemperature ds18b20(&oneWire);
#else
  // MCP9808 + HDC1080
  #include <Wire.h>
  #include <Adafruit_MCP9808.h>
  #include "ClosedCube_HDC1080.h"
  Adafruit_MCP9808 mcp9808;
  ClosedCube_HDC1080 hdc1080;
#endif

// HX711
#if HX711_ENABLED
  #include "HX711.h"
  HX711 scale;
#endif

// ============================================
// GLOBAL VARIABLES
// ============================================

unsigned long lastReading = 0;
WiFiClient wifiClient;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  BEE HIVE SENSOR v1.0");
  Serial.println("=================================");
  Serial.print("Sensor Mode: ");
  Serial.println(SENSOR_MODE == 1 ? "DS18B20" : "MCP9808 + HDC1080");
  Serial.print("HX711 Load Cell: ");
  Serial.println(HX711_ENABLED ? "ENABLED" : "DISABLED");
  Serial.println();
  
  // Connect to WiFi
  connectWiFi();
  
  // Test DNS
  if (WiFi.status() == WL_CONNECTED) {
    testDNS();
  }
  
  // Initialize sensors
  initSensors();
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  Setup complete!");
  Serial.println("  Starting readings...");
  Serial.println("=================================");
  Serial.println();
  
  // Take first reading immediately
  lastReading = 0;
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  unsigned long now = millis();
  
  // Check if it's time for a reading
  if (now - lastReading >= READING_INTERVAL || lastReading == 0) {
    lastReading = now;
    
    // Reconnect WiFi if needed
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected! Reconnecting...");
      connectWiFi();
    }
    
    // Read sensors and send data
    readAndSend();
  }
  
  // Small delay to prevent watchdog issues
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
    Serial.println("=================================");
    Serial.print("  Connected! IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("  Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("  DNS: ");
    Serial.println(WiFi.dnsIP());
    Serial.println("=================================");
  } else {
    Serial.println();
    Serial.println("WiFi connection failed!");
  }
}

// ============================================
// TEST DNS RESOLUTION
// ============================================

void testDNS() {
  Serial.println();
  Serial.println("Testing DNS resolution...");
  
  IPAddress serverIP;
  if (WiFi.hostByName("beehive.yzz.me", serverIP)) {
    Serial.print("✓ DNS OK! Server IP: ");
    Serial.println(serverIP);
  } else {
    Serial.println("✗ DNS failed to resolve beehive.yzz.me");
    Serial.println("  Will try again when sending data...");
  }
}

// ============================================
// SENSOR INITIALIZATION
// ============================================

void initSensors() {
  Serial.println("Initializing sensors...");
  
  #if SENSOR_MODE == 1
    // DS18B20
    ds18b20.begin();
    int deviceCount = ds18b20.getDeviceCount();
    Serial.print("DS18B20 sensors found: ");
    Serial.println(deviceCount);
    if (deviceCount == 0) {
      Serial.println("WARNING: No DS18B20 found! Check wiring:");
      Serial.println("  - RED wire -> 3.3V");
      Serial.println("  - BLACK wire -> GND");
      Serial.println("  - YELLOW wire -> D4");
      Serial.println("  - 4.7k resistor between D4 and 3.3V");
    }
  #else
    // I2C sensors
    Wire.begin(I2C_SDA, I2C_SCL);
    
    // MCP9808
    if (mcp9808.begin(0x18)) {
      Serial.println("✓ MCP9808 found!");
      mcp9808.setResolution(3);
    } else {
      Serial.println("✗ MCP9808 not found!");
    }
    
    // HDC1080
    hdc1080.begin(0x40);
    Serial.print("HDC1080 Manufacturer ID: 0x");
    Serial.println(hdc1080.readManufacturerId(), HEX);
  #endif
  
  // HX711 Load Cell
  #if HX711_ENABLED
    scale.begin(HX711_DT, HX711_SCK);
    scale.set_scale(HX711_CALIBRATION);
    scale.tare();
    Serial.println("✓ HX711 initialized");
  #else
    Serial.println("HX711 disabled (not connected)");
  #endif
}

// ============================================
// READ SENSORS AND SEND DATA
// ============================================

void readAndSend() {
  float temperature = 0;
  float hdcTemp = 0;
  float humidity = 0;
  float weight = 0;
  
  Serial.println("=================================");
  Serial.println("  Reading sensors...");
  Serial.println("=================================");
  
  #if SENSOR_MODE == 1
    // DS18B20 temperature
    ds18b20.requestTemperatures();
    delay(100);
    temperature = ds18b20.getTempCByIndex(0);
    
    if (temperature == -127.0 || temperature == 85.0) {
      Serial.println("✗ DS18B20 read error! Check wiring.");
      Serial.print("  Raw value: ");
      Serial.println(temperature);
    } else {
      Serial.print("✓ DS18B20 Temp: ");
      Serial.print(temperature);
      Serial.println(" °C");
    }
  #else
    // MCP9808 temperature
    temperature = mcp9808.readTempC();
    Serial.print("✓ MCP9808 Temp: ");
    Serial.print(temperature);
    Serial.println(" °C");
    
    // HDC1080 temp + humidity
    hdcTemp = hdc1080.readTemperature();
    humidity = hdc1080.readHumidity();
    Serial.print("✓ HDC1080 Temp: ");
    Serial.print(hdcTemp);
    Serial.print(" °C, Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  #endif
  
  // Weight
  #if HX711_ENABLED
    if (scale.is_ready()) {
      weight = scale.get_units(10);
      if (weight < 0) weight = 0;
      Serial.print("✓ Weight: ");
      Serial.print(weight);
      Serial.println(" kg");
    } else {
      Serial.println("✗ HX711 not ready!");
    }
  #else
    Serial.println("  Weight: DISABLED");
  #endif
  
  // Send to server
  sendData(temperature, hdcTemp, humidity, weight);
}

// ============================================
// SEND DATA TO SERVER
// ============================================

void sendData(float temp, float hdcTemp, float humidity, float weight) {
  Serial.println();
  Serial.println("=================================");
  Serial.println("  Sending to server...");
  Serial.println("=================================");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ WiFi not connected!");
    return;
  }
  
  // Check memory
  Serial.print("Free memory: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");
  
  // Test DNS resolution
  IPAddress serverIP;
  Serial.print("Resolving beehive.yzz.me... ");
  
  if (!WiFi.hostByName("beehive.yzz.me", serverIP)) {
    Serial.println("FAILED!");
    Serial.println("Cannot resolve domain. Check internet connection.");
    return;
  }
  Serial.println(serverIP);
  
  // Setup HTTP client
  HTTPClient http;
  
  Serial.print("URL: ");
  Serial.println(SERVER_URL);
  
  http.setTimeout(15000);
  
  if (!http.begin(wifiClient, SERVER_URL)) {
    Serial.println("✗ http.begin() failed!");
    return;
  }
  
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0");
  http.addHeader("Accept", "*/*");
  http.addHeader("Cache-Control", "no-cache");
  
  // Build POST data
  String postData = "api_key=" + String(API_KEY);
  postData += "&temp=" + String(temp, 2);
  
  #if SENSOR_MODE == 2
    postData += "&hdc_temp=" + String(hdcTemp, 2);
    postData += "&humidity=" + String(humidity, 2);
  #endif
  
  #if HX711_ENABLED
    if (weight > 0) {
      postData += "&weight=" + String(weight, 2);
    }
  #endif
  
  Serial.print("POST data: ");
  Serial.println(postData);
  Serial.println("Sending...");
  
  int httpCode = http.POST(postData);
  
  Serial.println();
  if (httpCode > 0) {
    Serial.print("✓ HTTP Code: ");
    Serial.println(httpCode);
    String response = http.getString();
    Serial.print("✓ Response: ");
    Serial.println(response);
    
    if (httpCode == 200) {
      Serial.println();
      Serial.println("★★★ DATA SENT SUCCESSFULLY! ★★★");
    }
  } else {
    Serial.print("✗ HTTP Error: ");
    Serial.println(httpCode);
    Serial.print("✗ Reason: ");
    Serial.println(http.errorToString(httpCode));
    Serial.println();
    Serial.println("Troubleshooting:");
    Serial.println("  1. Check if server is online");
    Serial.println("  2. Try: http://beehive.yzz.me/api/receive.php in browser");
    Serial.println("  3. Check WiFi signal strength");
  }
  
  http.end();
  Serial.println();
}
