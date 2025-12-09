# 🗄️ Supabase Database Schema - Complete Documentation

## 📋 Overview

This document describes the complete database schema for the MyWebsite application, built on Supabase (PostgreSQL). The schema includes tables for user management, contact messages, wheel of fortune spins, active rewards, global cat state, and activity logs.

---

## 📊 Database Tables

### 1. **`users`** - User Accounts

Stores user account information for authentication and profile management.

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Columns:**
- `id` (UUID, PRIMARY KEY) - Unique identifier for each user, auto-generated
- `email` (TEXT, UNIQUE, NOT NULL) - User's email address, must be unique
- `nickname` (TEXT, NOT NULL) - User's display name/nickname
- `created_at` (TIMESTAMP WITH TIME ZONE) - Account creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Last update timestamp

#### **Indexes:**
- `idx_users_email` on `email` - Fast email lookups for authentication

#### **Usage:**
- User registration and login
- Profile management
- Foreign key reference for other tables (wheel_spins, user_active_rewards, global_cat_state)

#### **Example Data:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "nickname": "CatLover123",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 2. **`contact_messages`** - Contact Form Submissions

Stores messages submitted through the contact form.

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Columns:**
- `id` (UUID, PRIMARY KEY) - Unique identifier for each message
- `name` (TEXT, NOT NULL) - Sender's name
- `email` (TEXT, NOT NULL) - Sender's email address
- `subject` (TEXT, NULLABLE) - Optional message subject
- `message` (TEXT, NOT NULL) - Message content
- `created_at` (TIMESTAMP WITH TIME ZONE) - Submission timestamp

#### **Indexes:**
- `idx_contact_messages_created_at` on `created_at` - Fast chronological queries

#### **Usage:**
- Contact form submissions
- Admin message management
- Email notifications

#### **Example Data:**
```json
{
  "id": "223e4567-e89b-12d3-a456-426614174001",
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question about the website",
  "message": "I love your website! How can I contribute?",
  "created_at": "2024-01-15T11:00:00Z"
}
```

---

### 3. **`global_cat_state`** - WebSocket Cat State

Stores the global state of the WebSocket cat (single row table with id=1).

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS global_cat_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current TEXT NOT NULL DEFAULT 'playing',
  is_resting BOOLEAN NOT NULL DEFAULT false,
  rest_end_time TIMESTAMP WITH TIME ZONE,
  rested_by UUID REFERENCES users(id),
  rested_by_name TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Columns:**
- `id` (INTEGER, PRIMARY KEY) - Always 1 (enforced by CHECK constraint)
- `current` (TEXT, NOT NULL) - Current cat state
  - Valid values: `'playing'`, `'zen'`, `'sleeping'`, `'happy'`, `'tired'`, `'angry'`
  - Default: `'playing'`
  - `'sleeping'` is only used when REST is active
- `is_resting` (BOOLEAN, NOT NULL) - Whether the cat is currently sleeping
  - Default: `false`
- `rest_end_time` (TIMESTAMP WITH TIME ZONE, NULLABLE) - When the rest period ends
- `rested_by` (UUID, NULLABLE) - User ID who put the cat to sleep (foreign key to users)
- `rested_by_name` (TEXT, NULLABLE) - Display name of user who put the cat to sleep
- `last_updated` (TIMESTAMP WITH TIME ZONE) - Last state update timestamp

#### **Constraints:**
- `CHECK (id = 1)` - Ensures only one row exists with id=1
- Foreign key to `users(id)` for `rested_by`

#### **Usage:**
- WebSocket cat state management
- Sleep/rest functionality
- Real-time state synchronization across all clients

#### **Example Data:**
```json
{
  "id": 1,
  "current": "sleeping",
  "is_resting": true,
  "rest_end_time": "2024-01-15T11:01:00Z",
  "rested_by": "123e4567-e89b-12d3-a456-426614174000",
  "rested_by_name": "CatLover123",
  "last_updated": "2024-01-15T11:00:00Z"
}
```

---

### 4. **`cat_logs`** - Cat Activity Logs

Stores activity logs for the WebSocket cat feature.

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS cat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Columns:**
- `id` (UUID, PRIMARY KEY) - Unique identifier for each log entry
- `action` (TEXT, NOT NULL) - Description of the action performed
  - Examples: `"Put cat to sleep"`, `"Attempted to put cat to sleep (DENIED - already sleeping)"`
- `user_name` (TEXT, NOT NULL) - Display name of user who performed the action
- `timestamp` (TIMESTAMP WITH TIME ZONE) - When the action occurred

#### **Indexes:**
- `idx_cat_logs_timestamp` on `timestamp DESC` - Fast chronological queries (newest first)

#### **Usage:**
- Activity tracking for WebSocket cat
- Terminal log display in frontend
- Debugging and monitoring

#### **Example Data:**
```json
{
  "id": "323e4567-e89b-12d3-a456-426614174002",
  "action": "Put cat to sleep",
  "user_name": "CatLover123",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

---

### 5. **`wheel_spins`** - Wheel of Fortune Spins

Stores all wheel spin results for users.

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **Columns:**
- `id` (UUID, PRIMARY KEY) - Unique identifier for each spin
- `user_id` (UUID, NOT NULL) - User who performed the spin (foreign key to users)
- `reward` (TEXT, NOT NULL) - Prize won from the wheel
  - Valid values: `"New Me, Who Dis?"`, `"Fancy Schmancy Nickname"`, `"Chase the Yarn!"`, `"Paw-some Cursor"`, `"Royal Meowjesty"`, `"Color Catastrophe"`, `"Spin Again, Brave Soul"`, `"Total Cat-astrophe"`
- `created_at` (TIMESTAMP WITH TIME ZONE) - When the spin occurred

#### **Constraints:**
- Foreign key to `users(id)` with `ON DELETE CASCADE` - Deletes spins when user is deleted

#### **Indexes:**
- `idx_wheel_spins_user_id` on `user_id` - Fast user-specific queries
- `idx_wheel_spins_created_at` on `created_at DESC` - Fast chronological queries (newest first)

#### **Usage:**
- Wheel of Fortune spin history
- Cooldown calculation
- Statistics and analytics

#### **Example Data:**
```json
{
  "id": "423e4567-e89b-12d3-a456-426614174003",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "reward": "Paw-some Cursor",
  "created_at": "2024-01-15T11:30:00Z"
}
```

---

### 6. **`user_active_rewards`** - Active User Rewards

Stores temporary active rewards for users (avatar, nickname, cursor, color, yarn).

#### **Schema:**
```sql
CREATE TABLE IF NOT EXISTS user_active_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, reward_type)
);
```

#### **Columns:**
- `id` (UUID, PRIMARY KEY) - Unique identifier for each reward entry
- `user_id` (UUID, NOT NULL) - User who owns the reward (foreign key to users)
- `reward_type` (TEXT, NOT NULL) - Type of reward
  - Valid values: `'avatar'`, `'nickname'`, `'cursor'`, `'color'`, `'yarn'`
- `reward_value` (TEXT, NOT NULL) - JSON string containing reward data
  - Format varies by reward type (see examples below)
- `expires_at` (TIMESTAMP WITH TIME ZONE, NOT NULL) - When the reward expires
- `created_at` (TIMESTAMP WITH TIME ZONE) - When the reward was activated

#### **Constraints:**
- Foreign key to `users(id)` with `ON DELETE CASCADE` - Deletes rewards when user is deleted
- `UNIQUE(user_id, reward_type)` - One active reward per type per user

#### **Indexes:**
- `idx_user_active_rewards_user_id` on `user_id` - Fast user-specific queries
- `idx_user_active_rewards_expires_at` on `expires_at` - Fast expiration queries
- `idx_user_active_rewards_user_type` on `(user_id, reward_type)` - Fast unique constraint checks

#### **Reward Value Formats:**

**Avatar Reward:**
```json
{
  "avatarId": 5,
  "avatarPath": "/images/user-profile-icons/cat5.svg"
}
```

**Nickname Reward:**
```json
{
  "style": "cursive",
  "fontSize": "1.5",
  "prefix": "Royal Meowjesty"
}
```

**Cursor Reward:**
```json
{
  "enabled": true,
  "cursorPath": "/images/paw.png"
}
```

**Color Reward:**
```json
{
  "enabled": true,
  "swap": "pink-blue"
}
```

**Yarn Reward:**
```json
{
  "enabled": true
}
```

#### **Usage:**
- Temporary visual effects (30 seconds duration)
- Reward activation from wheel spins
- Automatic expiration handling

#### **Example Data:**
```json
{
  "id": "523e4567-e89b-12d3-a456-426614174004",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "reward_type": "avatar",
  "reward_value": "{\"avatarId\":5,\"avatarPath\":\"/images/user-profile-icons/cat5.svg\"}",
  "expires_at": "2024-01-15T11:31:00Z",
  "created_at": "2024-01-15T11:00:00Z"
}
```

---

## 🔗 Relationships

### **Entity Relationship Diagram:**

```
users (1) ──< (many) wheel_spins
users (1) ──< (many) user_active_rewards
users (1) ──< (many) global_cat_state.rested_by
```

### **Foreign Key Relationships:**
- `wheel_spins.user_id` → `users.id` (CASCADE DELETE)
- `user_active_rewards.user_id` → `users.id` (CASCADE DELETE)
- `global_cat_state.rested_by` → `users.id` (NO ACTION)

---

## 📈 Indexes

All indexes are created for performance optimization:

### **User Indexes:**
- `idx_users_email` - Fast email lookups for authentication

### **Contact Message Indexes:**
- `idx_contact_messages_created_at` - Chronological message queries

### **Cat Log Indexes:**
- `idx_cat_logs_timestamp` - Chronological log queries (newest first)

### **Wheel Spin Indexes:**
- `idx_wheel_spins_user_id` - User-specific spin queries
- `idx_wheel_spins_created_at` - Chronological spin queries (newest first)

### **Active Reward Indexes:**
- `idx_user_active_rewards_user_id` - User-specific reward queries
- `idx_user_active_rewards_expires_at` - Expiration queries
- `idx_user_active_rewards_user_type` - Unique constraint optimization

---

## 🔒 Row Level Security (RLS)

RLS policies are **optional** and currently **disabled** by default. To enable RLS:

### **Enable RLS:**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
```

### **Example Policies:**

**Users Table:**
```sql
-- Users can view only their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);
```

**Contact Messages Table:**
```sql
-- Anyone can insert contact messages
CREATE POLICY "Anyone can insert contact messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

-- Only admins can view contact messages
CREATE POLICY "Only admins can view contact messages" ON contact_messages
  FOR SELECT USING (false); -- Modify based on your admin role system
```

**Note:** RLS policies require Supabase Auth to be properly configured. Adjust policies based on your authentication and authorization requirements.

---

## 🚀 Setup Instructions

### **Step 1: Access Supabase SQL Editor**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**

### **Step 2: Execute Schema**

Copy and execute the entire SQL from `database/schema.sql`:

```sql
-- Copy all SQL from database/schema.sql
-- Execute in Supabase SQL Editor
```

### **Step 3: Verify Tables**

Check that all tables are created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Expected tables:
- `users`
- `contact_messages`
- `global_cat_state`
- `cat_logs`
- `wheel_spins`
- `user_active_rewards`

### **Step 4: Initialize Global Cat State**

Insert the initial row for global cat state:

```sql
INSERT INTO global_cat_state (id, current, is_resting)
VALUES (1, 'playing', false)
ON CONFLICT (id) DO NOTHING;
```

---

## 🔄 Common Queries

### **Get User by Email:**
```sql
SELECT * FROM users WHERE email = 'user@example.com';
```

### **Get User's Spin History:**
```sql
SELECT * FROM wheel_spins 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC
LIMIT 50;
```

### **Get Active Rewards for User:**
```sql
SELECT * FROM user_active_rewards
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'
  AND expires_at > NOW();
```

### **Get Expired Rewards (for cleanup):**
```sql
SELECT * FROM user_active_rewards
WHERE expires_at < NOW();
```

### **Get Last Spin for Cooldown Check:**
```sql
SELECT created_at, reward FROM wheel_spins
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at DESC
LIMIT 1;
```

### **Get Recent Cat Logs:**
```sql
SELECT * FROM cat_logs
ORDER BY timestamp DESC
LIMIT 50;
```

### **Get Global Cat State:**
```sql
SELECT * FROM global_cat_state WHERE id = 1;
```

---

## 🧹 Maintenance Queries

### **Cleanup Expired Rewards:**
```sql
DELETE FROM user_active_rewards
WHERE expires_at < NOW();
```

### **Get Table Sizes:**
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **Get Row Counts:**
```sql
SELECT 
  'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'contact_messages', COUNT(*) FROM contact_messages
UNION ALL
SELECT 'wheel_spins', COUNT(*) FROM wheel_spins
UNION ALL
SELECT 'user_active_rewards', COUNT(*) FROM user_active_rewards
UNION ALL
SELECT 'cat_logs', COUNT(*) FROM cat_logs;
```

---

## ⚠️ Important Notes

### **Cascade Deletes:**
- Deleting a user automatically deletes all their `wheel_spins` and `user_active_rewards`
- This prevents orphaned records

### **Global Cat State:**
- Only one row should exist (id=1)
- The CHECK constraint enforces this
- Always use `UPDATE` instead of `INSERT` for this table

### **Reward Expiration:**
- All rewards expire after 30 seconds
- Backend sets `expires_at` to `NOW() + 30 seconds`
- Frontend and backend both check expiration before applying rewards

### **Unique Constraints:**
- `users.email` must be unique
- `user_active_rewards(user_id, reward_type)` must be unique (one active reward per type per user)

### **Timestamps:**
- All timestamps use `TIMESTAMP WITH TIME ZONE`
- Default to `NOW()` for creation timestamps
- Always use UTC for consistency

---

## 📁 File Structure

```
mywebsite-backend/
├── database/
│   ├── schema.sql                          # Complete SQL schema
│   └── SUPABASE_DATABASE_SCHEMA.md        # This documentation
└── ...
```

---

## 🔮 Future Enhancements

Potential improvements:
- Add indexes for full-text search on messages
- Add soft deletes (deleted_at column) instead of hard deletes
- Add audit logging table for all data changes
- Add database migrations system (e.g., using Supabase migrations)
- Add database backup/restore procedures
- Add performance monitoring queries
- Add data retention policies for old logs
- Add user roles and permissions table

---

## 📚 Related Documentation

- [Wheel of Fortune Documentation](../mywebsite-frontend/WHEEL_OF_FORTUNE_DOCUMENTATION.md)
- [Backend README](../README.md)
- [Supabase Documentation](https://supabase.com/docs)

---

*Last updated: 2025*

