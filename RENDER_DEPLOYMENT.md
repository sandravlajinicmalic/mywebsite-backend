# Render Deployment - Brzi Vodič

## Šta je urađeno

✅ Kreiran `render.yaml` fajl za automatsku konfiguraciju  
✅ Dodate instrukcije u README.md  
✅ Health check endpoint (`/health`) je već implementiran  
✅ Build i start skripte su ispravno konfigurisane  

## Brzi koraci za deployment

### 1. Push na GitHub
```bash
git add .
git commit -m "Add Render deployment configuration"
git push
```

### 2. Kreiraj Web Service na Render

**Opcija A: Koristi Render Blueprint (preporučeno)**

1. Idi na https://dashboard.render.com
2. Klikni na **"New +"** → **"Blueprint"** (ili **"New +"** → **"Apply Render Blueprint"**)
3. Poveži GitHub repozitorijum
4. Render će automatski detektovati `render.yaml` fajl u repozitorijumu
5. Render će prikazati preview konfiguracije iz `render.yaml`
6. Klikni **"Apply"** da kreiraš service sa konfiguracijom iz `render.yaml`
7. **VAŽNO**: Još uvek moraš da dodaš Environment Variables ručno (vidi Korak 3)

**Opcija B: Manual Setup**

1. Idi na https://dashboard.render.com
2. **New +** → **Web Service**
3. Poveži GitHub repozitorijum (`mywebsite-backend`)
4. **Root Directory**: Ostavi **PRAZNO** (ili `.`) ako je repozitorijum samo backend kod
   - Ako je monorepo (ceo workspace), onda postavi na `mywebsite-backend`
5. Konfiguriši:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### 3. Dodaj Environment Variables

U Render dashboardu (Settings → Environment), dodaj:

```
NODE_ENV=production
FRONTEND_URL=https://tvoj-domen.vercel.app
SUPABASE_URL=tvoj_supabase_url
SUPABASE_ANON_KEY=tvoj_supabase_anon_key
JWT_SECRET=generiši-sa-openssl-rand-base64-32
OPENAI_API_KEY=tvoj-openai-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tvoj-email@gmail.com
SMTP_PASSWORD=tvoj-app-password
SMTP_FROM=tvoj-email@gmail.com
```

### 4. Deploy

Render će automatski:
- Instalirati dependencies (`npm install`)
- Build-ovati TypeScript (`npm run build`)
- Pokrenuti server (`npm start`)
- Koristiti `/health` za health checks

### 5. Ažuriraj Frontend URL

Kada dobiješ Render URL (npr. `https://mywebsite-backend.onrender.com`), ažuriraj:
- Frontend API konfiguraciju da koristi Render URL
- `FRONTEND_URL` u Render environment variables na tvoj Vercel URL

## Važne napomene

⚠️ **Free plan**: Render free plan ima "spin down" nakon 15 minuta neaktivnosti. Prvi request može biti spor (cold start).

⚠️ **WebSocket**: Render free plan podržava WebSocket, ali može biti nestabilnije nego paid plan.

⚠️ **Environment Variables**: Ne zaboravi da postaviš sve environment variables pre prvog deploy-a.

## Troubleshooting

**Error: Cannot find module '/opt/render/project/src/dist/index.js'**
- ✅ **Rešenje 1**: Proveri da li je **Root Directory** prazno (za single repo) ili postavljeno na `mywebsite-backend` (za monorepo)
- Idi na **Settings** → **Build & Deploy** → **Root Directory**
- Ako je repozitorijum samo backend kod → ostavi **PRAZNO**
- Ako je monorepo → postavi na `mywebsite-backend`

- ✅ **Rešenje 2**: Proveri Build logs u Render dashboardu
  - Idi na **Logs** tab
  - Proveri da li `npm run build` uspešno završava
  - Ako build pada, proveri TypeScript greške
  - Proveri da li se `dist/index.js` kreira nakon build-a

- ✅ **Rešenje 3**: Proveri da li su sve dependencies instalirane
  - U build logs, proveri da li `npm install` uspešno završava
  - Proveri da li TypeScript (`typescript`) i sve dependencies postoje

**Service Root Directory "/opt/render/project/src/mywebsite-backend" is missing**
- ✅ **Rešenje**: Repozitorijum je samo backend kod, ne monorepo
- **Root Directory** treba da bude **PRAZNO** ili `.` (trenutni direktorijum)
- Ukloni `rootDir` iz `render.yaml` ili postavi na `.`

**Build fails?**
- Proveri da li su sve dependencies u `package.json`
- Proveri logs u Render dashboardu
- Proveri da li TypeScript build prolazi (možeš testirati lokalno sa `npm run build`)

**Server ne startuje?**
- Proveri da li su sve environment variables postavljene
- Proveri logs za greške
- Proveri da li `dist/index.js` postoji nakon build-a

**CORS errors?**
- Proveri da li je `FRONTEND_URL` ispravno postavljen (bez trailing slash)
- Proveri da li frontend koristi ispravan backend URL

## Next Steps

1. ✅ Deploy backend na Render
2. ⏳ Deploy frontend na Vercel
3. ⏳ Poveži domen
4. ⏳ Ažuriraj CORS i API URLs

 