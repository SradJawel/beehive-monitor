/**
 * ===========================================
 * BEE HIVE SENSOR - SUPABASE VERSION
 * ===========================================
 * 
 * Sends data directly to Supabase (no PHP needed!)
 * 
 * ===========================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// ============================================
// CONFIGURATION - CHANGE THESE!
// ============================================

// WiFi credentials
const char* WIFI_SSID = "Srad Jawel";
const char* WIFI_PASS = "192.168.8.9";

// Supabase settings
const char* SUPABASE_URL = "https://mafzunpomznrjvdxvknc.supabase.co";
const char* SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";  // ← PASTE YOUR ANON KEY HERE!

// Which hive is this? (1=Alpha, 2=Bravo, 3=Charlie, 4=Delta)
const int HIVE_ID = 1;

// Reading interval (30 seconds for testing, change to 5 min later)
const unsigned long READING_INTERVAL = 30 * 1000;  // 30 seconds
// const unsigned long READING_INTERVAL = 5 * 60 * 1000;  // 5 minutes (production)

// ============================================
// SENSOR SETTINGS
// ============================================

#define DS18B20_PIN D4
#define HX711_ENABLED false  // Set true when load cell connected

#if HX711_ENABLED
  #include "HX711.h"
  #define HX711_SCK D5
  #define HX711_DT D6
  HX711 scale;
  const float HX711_CALIBRATION = 420.0;
#endif

// DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

// ============================================
// GLOBAL VARIABLES
// ============================================

unsigned long lastReading = 0;
WiFiClientSecure wifiClient;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("╔═══════════════════════════════════════╗");
  Serial.println("║     🐝 BEE HIVE SENSOR v2.0 🐝        ║");
  Serial.println("║         SUPABASE EDITION              ║");
  Serial.println("╚═══════════════════════════════════════╝");
  Serial.println();
  
  Serial.print("Hive ID: ");
  Serial.println(HIVE_ID);
  Serial.print("Interval: ");
  Serial.print(READING_INTERVAL / 1000);
  Serial.println(" seconds");
  Serial.println();
  
  // Connect WiFi
  connectWiFi();
  
  // Initialize sensors
  initSensors();
  
  // Skip SSL certificate verification (required for ESP8266)
  wifiClient.setInsecure();
  
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
    
    // Reconnect WiFi if needed
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
    
    // Read and send
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
  
  // DS18B20
  ds18b20.begin();
  int sensorCount = ds18b20.getDeviceCount();
  Serial.print("  DS18B20 sensors found: ");
  Serial.println(sensorCount);
  
  // HX711
  #if HX711_ENABLED
    scale.begin(HX711_DT, HX711_SCK);
    scale.set_scale(HX711_CALIBRATION);
    scale.tare();
    Serial.println("  HX711 load cell: ENABLED");
  #else
    Serial.println("  HX711 load cell: DISABLED");
  #endif
}

// ============================================
// READ SENSORS AND SEND DATA
// ============================================

void readAndSend() {
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("📊 Reading sensors...");
  
  // Read temperature
  ds18b20.requestTemperatures();
  float temperature = ds18b20.getTempCByIndex(0);
  
  if (temperature == DEVICE_DISCONNECTED_C || temperature == -127.0) {
    Serial.println("  ✗ DS18B20 error! Check wiring.");
    return;
  }
  
  Serial.print("  🌡️  Temperature: ");
  Serial.print(temperature);
  Serial.println(" °C");
  
  // Read weight
  float weight = 0;
  #if HX711_ENABLED
    if (scale.is_ready()) {
      weight = scale.get_units(10);
      if (weight < 0) weight = 0;
      Serial.print("  ⚖️  Weight: ");
      Serial.print(weight);
      Serial.println(" kg");
    }
  #endif
  
  // Send to Supabase
  sendToSupabase(temperature, weight);
}

// ============================================
// SEND DATA TO SUPABASE
// ============================================

void sendToSupabase(float temperature, float weight) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("  ✗ WiFi not connected!");
    return;
  }
  
  Serial.println();
  Serial.println("📤 Sending to Supabase...");
  
  HTTPClient http;
  
  // Build URL for Supabase REST API
  String url = String(SUPABASE_URL) + "/rest/v1/readings";
  
  Serial.print("  URL: ");
  Serial.println(url);
  
  http.begin(wifiClient, url);
  
  // Required Supabase headers
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=minimal");
  
  // Build JSON body
  String jsonBody = "{";
  jsonBody += "\"hive_id\":" + String(HIVE_ID) + ",";
  jsonBody += "\"temperature\":" + String(temperature, 2);
  
  #if HX711_ENABLED
    jsonBody += ",\"weight\":" + String(weight, 2);
  #endif
  
  jsonBody += "}";
  
  Serial.print("  Data: ");
  Serial.println(jsonBody);
  
  // Send POST request
  int httpCode = http.POST(jsonBody);
  
  Serial.println();
  if (httpCode == 201 || httpCode == 200) {
    Serial.println("  ╔═══════════════════════════════╗");
    Serial.println("  ║   ✓ DATA SENT SUCCESSFULLY!   ║");
    Serial.println("  ╚═══════════════════════════════╝");
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
