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

-- Global Cat State tabela (samo jedna redica sa id=1)
-- Valid states: 'playing', 'zen', 'sleeping', 'happy', 'tired', 'angry'
-- 'sleeping' is only used when REST is active
CREATE TABLE IF NOT EXISTS global_cat_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current TEXT NOT NULL DEFAULT 'playing',
  is_resting BOOLEAN NOT NULL DEFAULT false,
  rest_end_time TIMESTAMP WITH TIME ZONE,
  rested_by UUID REFERENCES users(id),
  rested_by_name TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cat Logs tabela
CREATE TABLE IF NOT EXISTS cat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wheel Spins tabela
CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Active Rewards tabela - za privremene efekte nagrada
CREATE TABLE IF NOT EXISTS user_active_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL, -- 'avatar', 'nickname', 'cursor', etc.
  reward_value TEXT NOT NULL, -- JSON string sa podacima nagrade (npr. avatar path)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, reward_type) -- Jedan korisnik može imati samo jednu aktivnu nagradu određenog tipa
);

-- Index za brže pretraživanje
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_cat_logs_timestamp ON cat_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON wheel_spins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_user_id ON user_active_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_expires_at ON user_active_rewards(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_user_type ON user_active_rewards(user_id, reward_type);

-- ============================================================================
-- RLS (Row Level Security) - Omogućavanje i kreiranje politika
-- ============================================================================

-- Omogući RLS na svim tabelama
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_cat_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wheel_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_active_rewards ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Politike
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS tabela
-- ----------------------------------------------------------------------------
-- Korisnici mogu da vide i ažuriraju samo svoje podatke
-- INSERT i DELETE se obično rade kroz backend (service_role)

CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- 2. CONTACT_MESSAGES tabela
-- ----------------------------------------------------------------------------
-- Svi mogu slati poruke, ali samo backend može čitati/ažurirati/brisati
-- (Kontakt poruke su privatne - svi korisnici imaju jednaka prava)

CREATE POLICY "Anyone can insert contact messages" ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Backend only can view contact messages" ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "Backend only can update contact messages" ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Backend only can delete contact messages" ON public.contact_messages
  FOR DELETE
  TO authenticated
  USING (false);

-- ----------------------------------------------------------------------------
-- 3. GLOBAL_CAT_STATE tabela
-- ----------------------------------------------------------------------------
-- Svi mogu čitati, autentifikovani korisnici mogu ažurirati
-- (Single-row tabela za globalno stanje mačke)

CREATE POLICY "Anyone can read global cat state" ON public.global_cat_state
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update global cat state" ON public.global_cat_state
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. CAT_LOGS tabela
-- ----------------------------------------------------------------------------
-- Svi mogu čitati logove, autentifikovani korisnici mogu dodavati

CREATE POLICY "Anyone can read cat logs" ON public.cat_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cat logs" ON public.cat_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. WHEEL_SPINS tabela
-- ----------------------------------------------------------------------------
-- Korisnici mogu da vide i upravljaju samo svojim spinovima

CREATE POLICY "Users can view own wheel spins" ON public.wheel_spins
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own wheel spins" ON public.wheel_spins
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own wheel spins" ON public.wheel_spins
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own wheel spins" ON public.wheel_spins
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 6. USER_ACTIVE_REWARDS tabela
-- ----------------------------------------------------------------------------
-- Korisnici mogu da vide i upravljaju samo svojim nagradama

CREATE POLICY "Users can view own active rewards" ON public.user_active_rewards
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own active rewards" ON public.user_active_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own active rewards" ON public.user_active_rewards
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own active rewards" ON public.user_active_rewards
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- Napomene:
-- ============================================================================
-- - Backend procesi koji koriste service_role key zaobilaze RLS
-- - Ovo je namerno i potrebno za registraciju korisnika, čitanje kontakt
--   poruka, i background jobove
-- - NIKADA ne izlažite service_role key u frontend kodu!
-- - Svi autentifikovani korisnici imaju jednaka prava (nema admin sistema)

