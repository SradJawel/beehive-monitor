/**
 * ===========================================
 * DS18B20 SENSOR TEST
 * ===========================================
 * 
 * Wiring:
 * - RED wire    → 3.3V
 * - BLACK wire  → GND
 * - YELLOW wire → D4 (GPIO2)
 * - 1kΩ resistor between D4 and 3.3V (pull-up)
 * 
 */

#include <OneWire.h>
#include <DallasTemperature.h>

// DS18B20 data pin
#define DS18B20_PIN D4  // GPIO2

// Setup OneWire and DallasTemperature
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=================================");
  Serial.println("  DS18B20 SENSOR TEST");
  Serial.println("=================================");
  Serial.println();
  Serial.println("Wiring Check:");
  Serial.println("  RED wire    → 3.3V");
  Serial.println("  BLACK wire  → GND");
  Serial.println("  YELLOW wire → D4");
  Serial.println("  1kΩ resistor → D4 to 3.3V");
  Serial.println();
  
  // Initialize sensor
  Serial.println("Initializing sensor...");
  sensors.begin();
  
  // Count devices
  int deviceCount = sensors.getDeviceCount();
  Serial.print("Devices found: ");
  Serial.println(deviceCount);
  
  if (deviceCount == 0) {
    Serial.println();
    Serial.println("=================================");
    Serial.println("  ✗ NO SENSOR FOUND!");
    Serial.println("=================================");
    Serial.println();
    Serial.println("Troubleshooting:");
    Serial.println("1. Check wiring connections");
    Serial.println("2. Is pull-up resistor connected?");
    Serial.println("   (1kΩ between D4 and 3.3V)");
    Serial.println("3. Try different resistor values");
    Serial.println("4. Check if sensor is damaged");
    Serial.println();
    Serial.println("Will keep trying...");
  } else {
    Serial.println();
    Serial.println("=================================");
    Serial.println("  ✓ SENSOR FOUND!");
    Serial.println("=================================");
    
    // Get sensor address
    DeviceAddress sensorAddress;
    if (sensors.getAddress(sensorAddress, 0)) {
      Serial.print("Address: ");
      for (int i = 0; i < 8; i++) {
        if (sensorAddress[i] < 16) Serial.print("0");
        Serial.print(sensorAddress[i], HEX);
      }
      Serial.println();
    }
  }
  
  Serial.println();
  Serial.println("Starting temperature readings...");
  Serial.println();
}

void loop() {
  // Request temperature
  sensors.requestTemperatures();
  
  // Get temperature
  float tempC = sensors.getTempCByIndex(0);
  
  // Check if reading is valid
  if (tempC == DEVICE_DISCONNECTED_C || tempC == -127.0) {
    Serial.println("✗ Error: Sensor disconnected or not found!");
    Serial.println("  Check wiring and pull-up resistor");
  } else {
    Serial.print("✓ Temperature: ");
    Serial.print(tempC, 2);
    Serial.print(" °C  |  ");
    Serial.print(tempC * 9.0 / 5.0 + 32.0, 2);
    Serial.println(" °F");
  }
  
  delay(2000); // Read every 2 seconds
}
