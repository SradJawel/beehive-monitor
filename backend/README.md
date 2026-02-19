# 🐝 Bee Hive Monitoring - Backend

Node.js + Express + PostgreSQL backend for the Bee Hive Monitoring System.

## 🚀 Quick Deploy to Railway

### 1. Create Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub

### 2. Create New Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Connect your repository

### 3. Add PostgreSQL Database
- In your project, click "New"
- Select "Database" → "PostgreSQL"
- Railway will auto-configure `DATABASE_URL`

### 4. Set Environment Variables
In Railway dashboard, add these variables:

```
JWT_SECRET=your-super-secret-jwt-key-change-this
TZ=Africa/Lagos
FRONTEND_URL=https://your-frontend.vercel.app
```

### 5. Run Database Schema
- Connect to your Railway PostgreSQL
- Run the SQL from `db/schema.sql`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Hives
- `GET /api/hives` - Get all hives with latest readings
- `GET /api/hives/:id` - Get single hive with readings history
- `PUT /api/hives/:id` - Update hive name (auth required)
- `POST /api/hives/:id/regenerate-key` - Regenerate API key (auth required)

### Readings
- `GET /api/readings` - Get readings with filters
- `GET /api/readings/latest` - Get latest reading per hive
- `GET /api/readings/chart` - Get readings for charts

### ESP8266 Endpoint (No Auth)
- `POST /api/receive` - Receive sensor data from ESP8266

### LVD
- `GET /api/lvd` - Get current LVD status
- `GET /api/lvd/settings` - Get LVD settings (for ESP8266)
- `PUT /api/lvd/settings` - Update LVD settings (auth required)
- `POST /api/lvd` - Receive LVD status from ESP8266

### Export
- `GET /api/export/csv` - Download CSV (auth required)
- `GET /api/export/json` - Download JSON (auth required)

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Run development server
npm run dev
```

## 📦 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `JWT_SECRET` | JWT signing key | Random string |
| `TZ` | Timezone | `Africa/Lagos` |
| `FRONTEND_URL` | CORS origin | `https://your-site.com` |
