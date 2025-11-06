# 🚀 Kako da podesiš Supabase - Korak po Korak

Ovaj vodič će te provesti kroz sve korake za podešavanje Supabase baze podataka.

---

## 📍 KORAK 1: Prijava i Pristup Supabase Dashboard-u

1. **Otvori browser i idi na:** [https://app.supabase.com](https://app.supabase.com)

2. **Uloguj se:**
   - Klikni na **"Sign in with GitHub"** (pošto si već povezan sa GitHub-om)
   - Autorizuj pristup ako traži

3. **Izaberi projekat:**
   - Ako već imaš projekat, klikni na njega
   - Ako nemaš projekat, klikni **"New Project"** i kreiraj novi:
     - Unesi **Name** (npr. "mywebsite")
     - Unesi **Database Password** (zapamti ga!)
     - Izaberi **Region** (najbližu tebi)
     - Klikni **"Create new project"**
     - Sačekaj da se projekat kreira (može potrajati 1-2 minuta)

---

## 🔑 KORAK 2: Dobijanje API Credentials

1. **U sidebar-u (leva strana) klikni na:** ⚙️ **Settings** (ili ikona zupčanika)

2. **Klikni na:** **API** (iz menija Settings)

3. **Nađi sekciju "Project API keys"**

4. **Kopiraj sledeće vrednosti:**

   a) **Project URL**
   - Nađi polje **"Project URL"**
   - Izgleda ovako: `https://xxxxxxxxxxxxx.supabase.co`
   - Klikni na ikonu za kopiranje (📋) ili selektuj i kopiraj (Cmd/Ctrl + C)
   - **Ovo je tvoj `SUPABASE_URL`**

   b) **anon public key**
   - Nađi polje **"anon public"** (pod "Project API keys")
   - To je dugačak string koji počinje sa `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Klikni na ikonu za kopiranje (📋) ili selektuj i kopiraj
   - **Ovo je tvoj `SUPABASE_ANON_KEY`**

   ⚠️ **VAŽNO:** Ne kopiraj "service_role" key - to je za admin operacije i treba da ostane tajno!

---

## 📝 KORAK 3: Kreiranje .env fajla

1. **Otvori terminal i idi u backend folder:**
   ```bash
   cd /Users/sandravlajinicmalic/mywebsite/mywebsite-backend
   ```

2. **Kreiraj .env fajl:**
   ```bash
   cp .env.example .env
   ```

3. **Otvori .env fajl u editoru:**
   - Možeš koristiti VS Code, nano, ili bilo koji editor
   - U VS Code: `code .env`

4. **Zameni placeholder vrednosti sa svojim podacima:**

   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Frontend URL (za CORS)
   FRONTEND_URL=http://localhost:5173

   # Supabase Configuration
   SUPABASE_URL=https://tvoj-project-id.supabase.co    # ← Zameni sa svojim Project URL
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ← Zameni sa svojim anon key

   # JWT Secret
   JWT_SECRET=generiši-jaku-random-string  # ← Generiši novi (vidi ispod)
   ```

5. **Generiši JWT_SECRET:**
   
   U terminalu pokreni:
   ```bash
   openssl rand -base64 32
   ```
   
   Kopiraj rezultat (dugačak string) i zameni `generiši-jaku-random-string` u `.env` fajlu.

   **Primer:**
   ```env
   JWT_SECRET=K8mN2pQ5rT9vW3xZ7aB4cD6eF8gH0jL1mN3pQ5rT7vW9xZ
   ```

6. **Sačuvaj fajl** (Cmd/Ctrl + S)

---

## 🗄️ KORAK 4: Kreiranje Tabela u Supabase

1. **Vrati se u Supabase Dashboard** (ako si zatvorio)

2. **Otvori SQL Editor:**
   - U sidebar-u klikni na **"SQL Editor"** (ikonica SQL-a ili "SQL Editor" tekst)
   - Klikni na dugme **"New query"** (gore desno)

3. **Kopiraj SQL kod:**
   
   Otvori fajl `database/schema.sql` iz tvog projekta i kopiraj **CEO SADRŽAJ**:
   
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

4. **Zalepi SQL u Supabase SQL Editor:**
   - Klikni u tekstualno polje u SQL Editor-u
   - Zalepi kopirani SQL kod (Cmd/Ctrl + V)

5. **Izvrši SQL:**
   - Klikni na dugme **"Run"** (ili pritisni **Cmd + Enter** na Mac, **Ctrl + Enter** na Windows/Linux)
   - Sačekaj da se izvrši (trebalo bi da vidiš poruku "Success. No rows returned")

6. **Proveri da su tabele kreirane:**
   - U sidebar-u klikni na **"Table Editor"**
   - Trebalo bi da vidiš dve tabele:
     - ✅ `users`
     - ✅ `contact_messages`
   - Klikni na bilo koju tabelu da vidiš strukturu (kolone)

---

## ✅ KORAK 5: Testiranje da Sve Radi

1. **Vrati se u terminal** (u `mywebsite-backend` folderu)

2. **Pokreni backend server:**
   ```bash
   npm run dev
   ```

3. **Proveri da li server radi:**
   - Trebalo bi da vidiš poruku: `Server is running on port 3000`
   - Ako vidiš grešku o nedostajućim environment varijablama, proveri `.env` fajl

4. **Testiraj health endpoint:**
   - Otvori browser i idi na: [http://localhost:3000/health](http://localhost:3000/health)
   - Trebalo bi da vidiš: `{"status":"ok","message":"Server is running"}`

5. **Ako sve radi - uspešno si podesio Supabase! 🎉**

---

## 🔍 Provera da Li Sve Radi

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```
**Očekivani odgovor:** `{"status":"ok","message":"Server is running"}`

### Test 2: Test konekcije sa Supabase (opcionalno)
Možeš testirati da li backend može da se poveže sa Supabase tako što ćeš pokušati da kreiraš korisnika (preko frontend-a ili Postman-a).

---

## ❌ Troubleshooting (Rešavanje Problema)

### Problem: "Missing Supabase environment variables"
**Rešenje:**
- Proveri da li `.env` fajl postoji u `mywebsite-backend` folderu
- Proveri da li su `SUPABASE_URL` i `SUPABASE_ANON_KEY` ispravno uneti
- Proveri da nema razmaka oko `=` znaka
- Proveri da nema navodnika oko vrednosti (osim ako nisu deo stringa)

### Problem: "Invalid API key"
**Rešenje:**
- Proveri da li si kopirao **ceo** anon key (može biti dugačak, 200+ karaktera)
- Proveri da nema razmaka na početku ili kraju key-a
- Proveri da si kopirao **anon public** key, a ne service_role key

### Problem: "relation does not exist" ili "table does not exist"
**Rešenje:**
- Proveri da li si izvršio SQL iz `database/schema.sql` u SQL Editor-u
- Idi u **Table Editor** i proveri da li postoje tabele `users` i `contact_messages`
- Ako ne postoje, ponovo izvrši SQL

### Problem: Server se ne pokreće
**Rešenje:**
- Proveri da li si u `mywebsite-backend` folderu: `pwd`
- Proveri da li su instalirane dependencies: `npm install`
- Proveri da li port 3000 nije zauzet: `lsof -i :3000`
- Ako je zauzet, promeni PORT u `.env` fajlu

### Problem: "Cannot find module" greške
**Rešenje:**
- Instaliraj dependencies: `npm install`
- Proveri da li si u pravom folderu

---

## 📸 Vizuelni Vodič (Gde Naći Stvari)

### Supabase Dashboard Layout:
```
┌─────────────────────────────────────┐
│  Supabase Logo          [Settings]  │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │   Main Content Area      │
│          │                          │
│ [Home]   │                          │
│ [SQL]    │                          │
│ [Tables] │                          │
│ [API]    │                          │
│ [Auth]   │                          │
│ [Storage]│                          │
│ [Settings]│                         │
│          │                          │
└──────────┴──────────────────────────┘
```

### Gde Naći API Keys:
```
Settings → API → Project API keys
  ├─ Project URL: https://xxx.supabase.co
  ├─ anon public: eyJhbGciOiJIUzI1NiIs...
  └─ service_role: [NE KOPIRAJ OVO!]
```

---

## 🎯 Checklist - Proveri da Li Si Sve Uradio:

- [ ] Prijavljen u Supabase Dashboard
- [ ] Izabrao/kreirao projekat
- [ ] Kopirao Project URL iz Settings → API
- [ ] Kopirao anon public key iz Settings → API
- [ ] Kreirao `.env` fajl u `mywebsite-backend` folderu
- [ ] Zamenio `SUPABASE_URL` u `.env` fajlu
- [ ] Zamenio `SUPABASE_ANON_KEY` u `.env` fajlu
- [ ] Generisao `JWT_SECRET` i zamenio u `.env` fajlu
- [ ] Otvorio SQL Editor u Supabase
- [ ] Kopirao SQL iz `database/schema.sql`
- [ ] Zalepio i izvršio SQL u Supabase
- [ ] Proverio da postoje tabele u Table Editor-u
- [ ] Pokrenuo backend: `npm run dev`
- [ ] Testirao health endpoint: `http://localhost:3000/health`

---

## 🎉 Gotovo!

Ako si prošao kroz sve korake i sve radi, tvoj backend je sada povezan sa Supabase bazom podataka!

**Sledeći koraci:**
- Možeš testirati API endpoints preko frontend-a
- Možeš dodati više funkcionalnosti u backend
- Možeš koristiti Supabase Table Editor za pregled podataka

---

**Pitanja?** Proveri `SUPABASE_SETUP.md` za dodatne informacije ili troubleshooting.

