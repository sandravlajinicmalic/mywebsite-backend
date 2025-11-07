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

# OpenAI API Key (za AI chatbot)
OPENAI_API_KEY=your-openai-api-key
```

## Supabase Setup

### Korak 1: Dobijanje Supabase Credentials

1. Idi na [Supabase Dashboard](https://app.supabase.com)
2. Izaberi svoj projekat (ili kreiraj novi)
3. Idi na **Settings** → **API**
4. Kopiraj sledeće vrednosti:
   - **Project URL** → ovo je tvoj `SUPABASE_URL`
   - **anon/public key** → ovo je tvoj `SUPABASE_ANON_KEY`

### Korak 2: Kreiranje .env fajla

1. Kopiraj `.env.example` u `.env`:
   ```bash
   cp .env.example .env
   ```

2. Otvori `.env` fajl i zameni placeholder vrednosti sa svojim Supabase credentials:
   ```env
   SUPABASE_URL=https://tvoj-project-id.supabase.co
   SUPABASE_ANON_KEY=tvoja-anon-key
   JWT_SECRET=generiši-jaku-random-string
   ```

3. Za generisanje JWT_SECRET, možeš koristiti:
   ```bash
   openssl rand -base64 32
   ```

### Korak 3: Kreiranje tabela u Supabase

Idi na **SQL Editor** u Supabase dashboardu i izvrši sledeće SQL komande:

**Ili jednostavno kopiraj i izvrši ceo SQL iz `database/schema.sql` fajla:**

```sql
-- Users tabela
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact Messages tabela
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index za brže pretraživanje
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
```

**Napomena:** Ako želiš da koristiš Row Level Security (RLS), možeš aktivirati komentarisane delove u `database/schema.sql` fajlu.

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
│   └── supabase.ts      # Supabase klijent konfiguracija
├── database/
│   └── schema.sql       # SQL schema za Supabase tabele
├── middleware/
│   ├── auth.ts          # Autentifikacija middleware
│   └── errorHandler.ts  # Error handling middleware
├── routes/
│   ├── auth.ts          # Autentifikacija rute
│   └── contact.ts       # Kontakt rute
├── index.ts             # Glavni server fajl
├── tsconfig.json        # TypeScript konfiguracija
├── package.json
└── README.md
```

