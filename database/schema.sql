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

