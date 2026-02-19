/**
 * ===========================================
 * WIFI TEST - Simple connection test
 * ===========================================
 */

#include <ESP8266WiFi.h>

// Your WiFi credentials
const char* WIFI_SSID = "Srad Jawel";
const char* WIFI_PASS = "192.168.8.9";

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  WIFI TEST");
  Serial.println("=================================");
  Serial.println();
  
  // Print what we're connecting to
  Serial.print("SSID: [");
  Serial.print(WIFI_SSID);
  Serial.println("]");
  
  Serial.print("Password: [");
  Serial.print(WIFI_PASS);
  Serial.println("]");
  
  Serial.print("Password length: ");
  Serial.println(strlen(WIFI_PASS));
  
  Serial.println();
  Serial.println("Connecting...");
  
  // Set WiFi mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); // Clear any old connection
  delay(100);
  
  // Start connection
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  // Wait for connection (60 seconds max)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 120) {
    delay(500);
    Serial.print(".");
    
    // Print status every 10 attempts
    if (attempts % 10 == 0 && attempts > 0) {
      Serial.println();
      Serial.print("Status: ");
      printWiFiStatus(WiFi.status());
    }
    attempts++;
  }
  
  Serial.println();
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("=================================");
    Serial.println("  ✓ WIFI CONNECTED!");
    Serial.println("=================================");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("MAC Address: ");
    Serial.println(WiFi.macAddress());
  } else {
    Serial.println("=================================");
    Serial.println("  ✗ WIFI FAILED!");
    Serial.println("=================================");
    Serial.print("Final Status: ");
    printWiFiStatus(WiFi.status());
    Serial.println();
    Serial.println("Troubleshooting:");
    Serial.println("1. Check SSID spelling (exact match?)");
    Serial.println("2. Check password");
    Serial.println("3. Is it 2.4GHz? (ESP8266 can't do 5GHz)");
    Serial.println("4. Move closer to router");
    Serial.println("5. Restart router");
  }
}

void loop() {
  // Blink LED to show we're alive
  delay(1000);
}

void printWiFiStatus(int status) {
  switch(status) {
    case WL_IDLE_STATUS:
      Serial.println("IDLE");
      break;
    case WL_NO_SSID_AVAIL:
      Serial.println("NO SSID AVAILABLE - Network not found!");
      break;
    case WL_SCAN_COMPLETED:
      Serial.println("SCAN COMPLETED");
      break;
    case WL_CONNECTED:
      Serial.println("CONNECTED");
      break;
    case WL_CONNECT_FAILED:
      Serial.println("CONNECTION FAILED - Wrong password?");
      break;
    case WL_CONNECTION_LOST:
      Serial.println("CONNECTION LOST");
      break;
    case WL_DISCONNECTED:
      Serial.println("DISCONNECTED");
      break;
    default:
      Serial.print("UNKNOWN: ");
      Serial.println(status);
  }
}
