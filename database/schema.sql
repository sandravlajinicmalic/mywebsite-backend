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

-- RLS (Row Level Security) policies - opcionalno, za dodatnu sigurnost
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy za users - korisnici mogu vidjeti samo svoje podatke
-- CREATE POLICY "Users can view own data" ON users
--   FOR SELECT USING (auth.uid() = id);

-- Policy za contact_messages - svi mogu insertati, ali samo admin može čitati
-- CREATE POLICY "Anyone can insert contact messages" ON contact_messages
--   FOR INSERT WITH CHECK (true);

-- CREATE POLICY "Only admins can view contact messages" ON contact_messages
--   FOR SELECT USING (false); -- Promijeni ovo ako imaš admin role sistem

