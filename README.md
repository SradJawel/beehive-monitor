# 🐝 Bee Hive Monitoring System

A complete monitoring solution for beekeepers to track hive temperature, humidity, and weight remotely.

## 📋 Features

- **4 Hive Support**: Monitor Alpha, Bravo, Charlie, Delta (customizable names)
- **Sensor Flexibility**: Start with DS18B20, upgrade to MCP9808 + HDC1080 later
- **Weight Tracking**: 50kg load cell with HX711 amplifier
- **LVD Protection**: Programmable Low Voltage Disconnect protects batteries
- **Mobile Responsive**: Check your hives from anywhere
- **CSV Export**: Download data for analysis
- **Auto Backups**: Weekly automatic backups

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOLAR POWER SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│  2x 35W Solar (Series) → Diode → Buck Converter → BMS → Battery │
│                                                    ↓             │
│                                         16x 18650 Parallel       │
│                                                    ↓             │
│                          ┌─────────────────────────┴───────┐     │
│                          ↓                                 ↓     │
│                    [HT7833 → LVD D1 Mini]            [RELAY]     │
│                          │                               ↓       │
│                          └──────── GPIO ─────────────────┘       │
│                                                    ↓             │
│                                         [Distribution Board]     │
│                                                    ↓             │
│              ┌──────────┬──────────┬──────────┬──────────┐      │
│              ↓          ↓          ↓          ↓          │      │
│          [ALPHA]    [BRAVO]   [CHARLIE]   [DELTA]        │      │
│          ESP8266    ESP8266    ESP8266    ESP8266        │      │
│         +Sensors   +Sensors   +Sensors   +Sensors        │      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ WiFi
                    ┌─────────────────────┐
                    │    PHP + MySQL      │
                    │    Your Server      │
                    └─────────────────────┘
                              ↓
                        📱 Your Phone
```

## 📁 File Structure

```
├── php-deployment/          # Upload this to your web server
│   ├── config/
│   │   └── database.php     # Database configuration
│   ├── includes/
│   │   ├── header.php
│   │   ├── footer.php
│   │   └── functions.php
│   ├── api/
│   │   ├── receive.php      # ESP8266 sends data here
│   │   └── lvd.php          # LVD controller endpoint
│   ├── backups/             # Auto-generated CSV backups
│   ├── index.php            # Dashboard
│   ├── login.php            # Login page
│   ├── logout.php
│   ├── hive.php             # Hive detail + charts
│   ├── export.php           # CSV export
│   ├── settings.php         # Configuration
│   ├── cron_backup.php      # Weekly backup script
│   ├── schema.sql           # Database setup
│   └── .htaccess            # Security rules
│
├── arduino/
│   ├── hive_sensor/
│   │   └── hive_sensor.ino  # Hive sensor code
│   └── lvd_controller/
│       └── lvd_controller.ino # LVD controller code
│
└── README.md                # This file
```

## 🚀 Setup Instructions

### Step 1: Database Setup

1. Create a MySQL database named `beehive_monitor`
2. Import the schema:
   ```bash
   mysql -u root -p beehive_monitor < php-deployment/schema.sql
   ```
   Or copy/paste the contents of `schema.sql` into phpMyAdmin.

### Step 2: Configure PHP

1. Edit `php-deployment/config/database.php`:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'beehive_monitor');
   define('DB_USER', 'your_db_user');
   define('DB_PASS', 'your_db_password');
   ```

2. Upload the `php-deployment` folder to your web server

3. Make sure the `backups` folder is writable:
   ```bash
   chmod 755 backups
   ```

### Step 3: Test Login

1. Visit `http://your-server.com/login.php`
2. Default credentials: `admin` / `admin`
3. **Change your password immediately** in Settings!

### Step 4: Get API Keys

1. Go to Settings page
2. Copy the API key for each hive
3. You'll need these for the Arduino code

### Step 5: Arduino Setup

#### Required Libraries (Install via Arduino Library Manager):

For Hive Sensors:
- `OneWire` (for DS18B20)
- `DallasTemperature` (for DS18B20)
- `Adafruit MCP9808 Library` (for later)
- `ClosedCube HDC1080` (for later)
- `HX711` by bogde

For LVD Controller:
- `ArduinoJson` by Benoit Blanchon

#### Configure Hive Sensor:

1. Open `arduino/hive_sensor/hive_sensor.ino`
2. Update these settings:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
   const char* SERVER_URL = "http://your-server.com/api/receive.php";
   const char* API_KEY = "alpha_xxxxxxxx"; // From Settings page
   ```
3. Upload to ESP8266

#### Configure LVD Controller:

1. Open `arduino/lvd_controller/lvd_controller.ino`
2. Update WiFi and server settings
3. Upload to D1 Mini

### Step 6: Setup Cron Job (Auto Backup)

Add this to your server's crontab for weekly backups:
```bash
0 2 * * 0 php /path/to/php-deployment/cron_backup.php
```

## 🔌 Wiring Diagrams

### Hive Sensor (ESP8266)

```
ESP8266 D1 Mini
┌─────────────────┐
│                 │
│ 3.3V ───────────┼──► DS18B20 VCC (red)
│                 │    MCP9808 VCC / HDC1080 VCC
│                 │    HX711 VCC
│                 │
│ GND ────────────┼──► All sensor GND
│                 │
│ D4 (GPIO2) ─────┼──► DS18B20 DATA (yellow)
│                 │    (with 4.7kΩ pull-up to 3.3V)
│                 │
│ D1 (GPIO5) ─────┼──► MCP9808/HDC1080 SCL
│                 │
│ D2 (GPIO4) ─────┼──► MCP9808/HDC1080 SDA
│                 │
│ D5 (GPIO14) ────┼──► HX711 SCK
│                 │
│ D6 (GPIO12) ────┼──► HX711 DT
│                 │
└─────────────────┘
```

### LVD Controller (D1 Mini)

```
Battery+ ──┬── 100kΩ ──┬── 10kΩ ──┬── GND
           │           │          │
           │           └──► A0    │
           │                      │
           └──► Relay COM         │
                                  │
D1 Mini                           │
┌─────────────────┐               │
│                 │               │
│ 3.3V ───────────┼──► Relay VCC  │
│                 │               │
│ GND ────────────┼──► Relay GND ─┘
│                 │
│ D7 (GPIO13) ────┼──► Relay IN
│                 │
│ A0 ─────────────┼──► Voltage divider (see above)
│                 │
└─────────────────┘

Relay NO ──► Distribution Board
```

## 🔧 Sensor Mode Switching

The hive sensor code supports two modes:

### Mode 1: DS18B20 (Default - Start Here)
```cpp
#define SENSOR_MODE 1
```
- Uses DS18B20 waterproof probe
- Temperature only (no humidity)
- Simple wiring

### Mode 2: MCP9808 + HDC1080 (Upgrade Later)
```cpp
#define SENSOR_MODE 2
```
- Precision temperature (±0.25°C)
- Humidity sensing
- I2C bus (can add more sensors)

When your new sensors arrive, just change `SENSOR_MODE` to `2` and re-upload!

## 📊 Data Format

### API: Hive Sensor → Server
```
POST /api/receive.php
Content-Type: application/x-www-form-urlencoded

api_key=alpha_xxx&temp=34.75&humidity=62.3&hdc_temp=28.5&weight=45.2
```

### API: LVD Controller → Server
```
POST /api/lvd.php
Content-Type: application/x-www-form-urlencoded

voltage=3.85&lvd_status=1
```

### CSV Export Format
```csv
hive_id,hive_name,mcp_temp_c,hdc_temp_c,hdc_humidity_pct,weight_kg,recorded_at
1,Alpha,34.75,28.50,62.30,45.20,2026-03-15 14:30:00
```

## 🔋 Battery & Power

### Specifications
- **Solar**: 2x 35W panels in series (10V, 70W)
- **Battery**: 16x 18650 in parallel (~73Ah @ 3.7V)
- **Runtime without sun**: 100+ days!

### LVD Thresholds (Default)
- Disconnect: 3.3V (protects battery)
- Reconnect: 3.6V (hysteresis prevents oscillation)

These are configurable from the website Settings page!

## 🐛 Troubleshooting

### ESP8266 not connecting to WiFi
- Check SSID and password (case sensitive!)
- Ensure 2.4GHz network (ESP8266 doesn't support 5GHz)
- Check WiFi signal strength at apiary

### No data appearing on dashboard
- Verify API key matches (Settings page)
- Check server URL in Arduino code
- Look at Serial Monitor for errors

### Load cell giving wrong readings
- Run calibration routine (see comments in code)
- Check wiring (E+/E-/A+/A-)
- Ensure stable mounting

### LVD not triggering
- Verify voltage divider resistor values
- Check relay module polarity (active LOW vs HIGH)
- Test with Serial Monitor to see voltage readings

## 📝 License

MIT License - Feel free to modify and use for your own beekeeping!

## 🐝 Happy Beekeeping!

Questions? Check the Serial Monitor output for debugging info.
