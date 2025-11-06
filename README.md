# MyWebsite Backend

Backend server za MyWebsite aplikaciju, izgrađen sa Node.js, Express, Supabase i Socket.io.

## Instalacija

```bash
npm install
```

## Konfiguracija

Kreiraj `.env` fajl u root direktoriju sa sljedećim varijablama:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL (za CORS)
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Secret (generiši jaku random string za production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## Supabase Setup

U Supabase dashboardu, kreiraj sljedeće tabele:

### 1. Users tabela

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Contact Messages tabela

```sql
CREATE TABLE contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Pokretanje

### Development mode (sa auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm start
```

Server će se pokrenuti na `http://localhost:3000` (ili portu koji si definirao u `.env`).

## API Endpoints

### Health Check
- `GET /health` - Provjera statusa servera

### Autentifikacija
- `POST /api/auth/login` - Login/Register korisnika
  - Body: `{ email: string, nickname: string }`
  - Returns: `{ success: boolean, user: {...}, token: string }`

- `GET /api/auth/verify` - Verifikacija JWT tokena
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ success: boolean, user: {...} }`

### Kontakt
- `POST /api/contact/submit` - Slanje kontakt poruke
  - Body: `{ name: string, email: string, message: string, subject?: string }`
  - Returns: `{ success: boolean, message: string, data: {...} }`

- `GET /api/contact/messages` - Dohvatanje svih poruka (za admin, treba dodati autentifikaciju)

## Socket.io

Server podržava WebSocket konekcije preko Socket.io. Frontend se može povezati na:

```javascript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

socket.on('connect', () => {
  console.log('Connected to server')
})

socket.emit('message', { text: 'Hello' })
socket.on('message', (data) => {
  console.log('Received:', data)
})
```

## Struktura projekta

```
mywebsite-backend/
├── config/
│   └── supabase.js      # Supabase klijent konfiguracija
├── middleware/
│   └── errorHandler.js  # Error handling middleware
├── routes/
│   ├── auth.js          # Autentifikacija rute
│   └── contact.js       # Kontakt rute
├── index.js             # Glavni server fajl
├── package.json
└── README.md
```

