# MyWebsite Backend

Backend server for MyWebsite application, built with Node.js, Express, TypeScript, Supabase, and Socket.io. Provides RESTful API endpoints, real-time WebSocket communication, AI-powered chat functionality, and email services.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Socket.io Events](#socketio-events)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Email Service](#email-service)
- [Error Handling](#error-handling)
- [Security](#security)
- [Deployment](#deployment)
- [Development](#development)

---

## 🎯 Overview

This backend server powers the MyWebsite application, providing:

- **User Authentication**: JWT-based authentication with email/nickname login
- **Real-time Communication**: WebSocket support for live cat state updates
- **AI Chatbot**: OpenAI-powered chat that exclusively talks about cats
- **Wheel of Fortune**: Reward system with temporary visual effects
- **Contact Form**: Email notifications for contact submissions
- **User Management**: Profile management, active rewards, and avatar system

---

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js 5.x
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.io
- **Authentication**: JWT (jsonwebtoken)
- **AI**: OpenAI API (gpt-4o-mini)
- **Email**: Nodemailer (SMTP)
- **Development**: tsx (TypeScript execution)

---

## ✨ Features

### Authentication & User Management
- Email/nickname-based login/registration
- JWT token generation and verification
- Forgot nickname functionality
- Account deletion
- User profile management

### Real-time Features
- WebSocket cat state machine
- Live cat state updates across all clients
- Cat sleep/rest functionality
- Activity logging

### AI Chatbot
- OpenAI GPT-4o-mini integration
- Cat-only conversation restriction
- Multi-language support (English, Serbian)
- Conversation history management
- Text-only responses (no code/images)

### Wheel of Fortune
- 8 different prizes
- Cooldown system (30 seconds)
- Temporary reward effects (30 seconds)
- Spin history tracking
- Weighted random selection

### Email Service
- Welcome emails for new users
- Contact form notifications
- Forgot nickname emails
- Account deletion confirmations
- HTML email templates

---

## 📦 Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project
- OpenAI API key (for chatbot)
- SMTP email credentials (for email service)

### Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- Express.js
- TypeScript
- Supabase client
- Socket.io
- OpenAI SDK
- Nodemailer
- JWT
- CORS

---

## ⚙️ Configuration

### 1. Create `.env` File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
# Backend requires SERVICE_ROLE_KEY to bypass RLS (Row Level Security)
# Get this from Supabase Dashboard → Settings → API → service_role key (secret)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
# Optional: ANON_KEY can be used as fallback, but SERVICE_ROLE_KEY is required for RLS
# SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Secret (generate a strong random string for production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OpenAI API Key (for AI chatbot)
OPENAI_API_KEY=your-openai-api-key

# Email Configuration (SMTP) - for sending emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

### 3. Generate JWT Secret

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

Copy the output to `JWT_SECRET` in your `.env` file.

---

## 🗄️ Database Setup

### Step 1: Get Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Navigate to **Settings** → **API**
4. Copy the following values:
   - **Project URL** → This is your `SUPABASE_URL`
   - **service_role key (secret)** → This is your `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ **IMPORTANT**: This key bypasses Row Level Security (RLS)
     - 🔒 **NEVER** expose this key in frontend code or client-side
     - ✅ Safe to use in backend/server-side code only

### Step 2: Create Database Tables

1. Go to **SQL Editor** in Supabase dashboard
2. Copy and execute the entire SQL from `database/schema.sql`

Or execute the following SQL:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact Messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Global Cat State table (single row with id=1)
CREATE TABLE IF NOT EXISTS global_cat_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current TEXT NOT NULL DEFAULT 'playing',
  is_resting BOOLEAN NOT NULL DEFAULT false,
  rest_end_time TIMESTAMP WITH TIME ZONE,
  rested_by UUID REFERENCES users(id),
  rested_by_name TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cat Logs table
CREATE TABLE IF NOT EXISTS cat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wheel Spins table
CREATE TABLE IF NOT EXISTS wheel_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Active Rewards table
CREATE TABLE IF NOT EXISTS user_active_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, reward_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_cat_logs_timestamp ON cat_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_user_id ON wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_wheel_spins_created_at ON wheel_spins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_user_id ON user_active_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_expires_at ON user_active_rewards(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_active_rewards_user_type ON user_active_rewards(user_id, reward_type);
```

### Step 3: Initialize Global Cat State

Insert the initial row for global cat state:

```sql
INSERT INTO global_cat_state (id, current, is_resting)
VALUES (1, 'playing', false)
ON CONFLICT (id) DO NOTHING;
```

For detailed database documentation, see [SUPABASE_DATABASE_SCHEMA.md](./database/SUPABASE_DATABASE_SCHEMA.md).

---

## 🚀 Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

This uses `tsx watch` to automatically restart the server on file changes.

### Production Mode

1. Build TypeScript:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

The server will run on `http://localhost:3000` (or the port specified in `.env`).

### Health Check

Test if the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

## 📡 API Endpoints

### Health Check

#### `GET /health`
Check server status.

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

### Authentication

#### `POST /api/auth/login`
Login or register a user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "nickname": "username"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "username",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "token": "jwt-token-here"
}
```

**Errors:**
- `400`: Invalid email format or nickname format
- `500`: Server error

#### `GET /api/auth/verify`
Verify JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "username"
  }
}
```

**Errors:**
- `401`: Invalid or missing token

#### `POST /api/auth/forgot-nickname`
Send nickname reminder email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a nickname reminder has been sent."
}
```

#### `DELETE /api/auth/delete`
Delete user account (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### Contact

#### `POST /api/contact/submit`
Submit a contact form message.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question",
  "message": "Hello, I have a question..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Question",
    "message": "Hello, I have a question...",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- `400`: Validation errors
- `500`: Server error

#### `GET /api/contact/messages`
Get all contact messages (admin only - authentication should be added).

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Question",
      "message": "Hello...",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### Chat (AI Chatbot)

#### `POST /api/chat/message`
Send a message to the AI chatbot.

**Request Body:**
```json
{
  "message": "Tell me about cats",
  "sessionId": "optional-session-id",
  "language": "en"
}
``` 

**Response:**
```json
{
  "response": "Cats are wonderful pets...",
  "isAboutCats": true
}
```

**Errors:**
- `400`: Invalid message format
- `500`: Server error

#### `POST /api/chat/clear`
Clear conversation history.

**Request Body:**
```json
{
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation history cleared"
}
```

For detailed chat documentation, see [SmartChat Documentation](../mywebsite-frontend/SMARTCHAT_DOCUMENTATION.md).

---

### Wheel of Fortune

#### `POST /api/wheel/spin`
Spin the wheel (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reward": "Paw-some Cursor"
}
```

**Response:**
```json
{
  "success": true,
  "spin": {
    "id": "uuid",
    "user_id": "uuid",
    "reward": "Paw-some Cursor",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "canSpin": false,
  "cooldownSeconds": 30
}
```

**Errors:**
- `400`: Invalid reward
- `401`: Not authenticated
- `429`: Cooldown active

#### `GET /api/wheel/history`
Get spin history (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "spins": [
    {
      "id": "uuid",
      "reward": "Paw-some Cursor",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### `GET /api/wheel/can-spin`
Check if user can spin (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "canSpin": true,
  "cooldownSeconds": 0
}
```

For detailed wheel documentation, see [Wheel of Fortune Documentation](../mywebsite-frontend/WHEEL_OF_FORTUNE_DOCUMENTATION.md).

---

### User

#### `GET /api/user/active-rewards`
Get all active rewards for user (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "avatar": {
    "value": {
      "avatarId": 5,
      "avatarPath": "/images/user-profile-icons/cat5.svg"
    },
    "expiresAt": "2024-01-15T11:00:00Z"
  },
  "nickname": {
    "value": {
      "style": "cursive",
      "fontSize": "1.5"
    },
    "expiresAt": "2024-01-15T11:00:00Z"
  }
}
```

#### `GET /api/user/active-avatar`
Get active avatar for user (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "avatar": {
    "avatarId": 5,
    "avatarPath": "/images/user-profile-icons/cat5.svg"
  }
}
```

#### `POST /api/user/cleanup-expired-rewards`
Clean up expired rewards (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Expired rewards cleaned up",
  "deletedCount": 2
}
```

---

### Cat (WebSocket Cat State)

#### `GET /api/cat/status`
Get current cat state.

**Response:**
```json
{
  "current": "playing",
  "is_resting": false,
  "rest_end_time": null,
  "rested_by": null,
  "rested_by_name": null,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

#### `POST /api/cat/init`
Initialize cat state (creates initial state if doesn't exist).

**Response:**
```json
{
  "success": true,
  "message": "Cat state initialized"
}
```

---

## 🔌 Socket.io Events

### Client → Server Events

#### `get-current-state`
Request current cat state.

**Emit:**
```javascript
socket.emit('get-current-state')
```

#### `get-logs`
Request cat activity logs.

**Emit:**
```javascript
socket.emit('get-logs', { limit: 50 })
```

#### `activate-rest`
Put the cat to sleep.

**Emit:**
```javascript
socket.emit('activate-rest', {
  userId: 'user-uuid',
  userName: 'username'
})
```

### Server → Client Events

#### `connect`
Connection established.

**Listen:**
```javascript
socket.on('connect', () => {
  console.log('Connected to server')
})
```

#### `cat-state-changed`
Cat state has changed.

**Listen:**
```javascript
socket.on('cat-state-changed', (data) => {
  console.log('Cat state:', data.state) // 'playing', 'sleeping', etc.
})
```

#### `cat-resting`
Cat is now sleeping.

**Listen:**
```javascript
socket.on('cat-resting', (data) => {
  console.log('Cat resting until:', data.restUntil)
  console.log('Put to sleep by:', data.userName)
})
```

#### `rest-denied`
Rest request was denied.

**Listen:**
```javascript
socket.on('rest-denied', (data) => {
  console.log('Rest denied:', data.message)
})
```

#### `cat-rest-ended`
Cat rest period has ended.

**Listen:**
```javascript
socket.on('cat-rest-ended', () => {
  console.log('Cat is awake!')
})
```

#### `initial-logs`
Initial cat logs (sent on connection).

**Listen:**
```javascript
socket.on('initial-logs', (logs) => {
  console.log('Cat logs:', logs)
})
```

#### `new-log`
New cat activity log.

**Listen:**
```javascript
socket.on('new-log', (log) => {
  console.log('New log:', log.action)
})
```

---

## 📁 Project Structure

```
mywebsite-backend/
├── config/
│   └── supabase.ts              # Supabase client configuration
├── database/
│   ├── schema.sql               # Database schema
│   └── SUPABASE_DATABASE_SCHEMA.md  # Database documentation
├── middleware/
│   ├── auth.ts                  # JWT authentication middleware
│   └── errorHandler.ts          # Global error handler
├── routes/
│   ├── auth.ts                  # Authentication routes
│   ├── contact.ts               # Contact form routes
│   ├── chat.ts                  # AI chatbot routes
│   ├── wheel.ts                 # Wheel of Fortune routes
│   ├── user.ts                  # User management routes
│   └── cat.ts                   # Cat state routes
├── services/
│   └── email.ts                 # Email service (Nodemailer)
├── templates/
│   ├── welcome-email.html       # Welcome email template
│   ├── contact-form.html        # Contact form notification template
│   ├── forgot-nickname.html     # Forgot nickname email template
│   └── delete-account.html      # Account deletion confirmation template
├── utils/
│   └── avatar.ts                # Avatar generation utilities
├── dist/                        # Compiled JavaScript (generated)
├── .ebextensions/               # Elastic Beanstalk configuration
│   ├── 01-nodecommand.config    # Environment variables & health check
│   ├── 02-nginx.config          # Nginx proxy & CORS
│   ├── 03-websocket.config      # WebSocket configuration
│   └── 04-cors.config           # CORS settings
├── .ebignore                    # Files excluded from deployment
├── .elasticbeanstalk/           # EB CLI configuration
│   └── config.yml               # EB environment config
├── index.ts                     # Main server file
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

---

## 🔐 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | Yes | - |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Yes | - |
| `JWT_SECRET` | Secret for JWT token signing | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key for chatbot | Yes | - |
| `SMTP_HOST` | SMTP server host | Yes | - |
| `SMTP_PORT` | SMTP server port | No | `587` |
| `SMTP_SECURE` | Use TLS/SSL | No | `false` |
| `SMTP_USER` | SMTP username | Yes | - |
| `SMTP_PASSWORD` | SMTP password/app password | Yes | - |
| `SMTP_FROM` | From email address | Yes | - |

---

## 📧 Email Service

The email service uses Nodemailer to send HTML emails.

### Email Types

1. **Welcome Email**: Sent to new users after registration
2. **Contact Form Notification**: Sent when contact form is submitted
3. **Forgot Nickname**: Sent when user requests nickname reminder
4. **Account Deletion Confirmation**: Sent when account is deleted

### Email Templates

Templates are located in `templates/` directory:
- `welcome-email.html`
- `contact-form.html`
- `forgot-nickname.html`
- `delete-account.html`

### Configuration

Email service is configured via environment variables:
- `SMTP_HOST`: SMTP server (e.g., `smtp.gmail.com`)
- `SMTP_PORT`: SMTP port (usually `587` for TLS)
- `SMTP_SECURE`: Use TLS (`false` for port 587, `true` for port 465)
- `SMTP_USER`: Email address
- `SMTP_PASSWORD`: App password (not regular password for Gmail)
- `SMTP_FROM`: From address

### Gmail Setup

For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an app password
3. Use the app password in `SMTP_PASSWORD`

---

## ⚠️ Error Handling

### Global Error Handler

All errors are handled by the global error handler middleware (`middleware/errorHandler.ts`).

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details (in development)"
}
```

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (cooldown active)
- `500`: Internal Server Error

### Error Logging

Errors are logged to console with:
- Error message
- Stack trace (in development)
- Request details

---

## 🔒 Security

### Authentication

- JWT tokens for authentication
- Tokens expire (configurable)
- Secure token generation with strong secret

### Input Validation

- Email format validation
- Nickname format validation (alphanumeric, underscore, dash only)
- Message sanitization (text-only)
- SQL injection prevention (using Supabase client)

### CORS

- Configured to allow frontend URL and Amplify domains
- Credentials support enabled
- Automatic origin whitelist for `*.amplifyapp.com`
- Detailed logging for CORS debugging

### Environment Variables

- Never commit `.env` file
- Use strong JWT secret
- Keep API keys secure
- Use app passwords for email (not regular passwords)

### Rate Limiting

- Cooldown system for wheel spins (30 seconds)
- Consider adding rate limiting middleware for production

---

## 🚀 Deployment

### AWS Elastic Beanstalk

This backend is deployed on AWS Elastic Beanstalk.

#### Quick Deployment

```bash
# Build and deploy
npm run deploy

# Or separately:
npm run build
eb deploy

# Check logs
eb logs

# Check health
eb health
```

#### Initial Setup (First Time Only)

```bash
# Install EB CLI
pip3 install awsebcli

# Configure AWS credentials
aws configure

# Initialize EB
eb init

# Create environment
eb create meowcrafts-backend-prod
```

#### Environment Variables

Set all required environment variables in AWS Elastic Beanstalk Console:

**Required Variables:**
- `NODE_ENV=production`
- `PORT=8080`
- `FRONTEND_URL=https://www.meow-crafts.com` (⚠️ **Important**: Must match your frontend domain exactly, without trailing slash)
- `SUPABASE_URL=your-supabase-url`
- `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
- `JWT_SECRET=your-jwt-secret` (generate a strong random string)
- `OPENAI_API_KEY=your-openai-key`
- `SMTP_HOST=your-smtp-host` (e.g., `smtp.gmail.com`)
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=your-smtp-user`
- `SMTP_PASSWORD=your-smtp-password`
- `SMTP_FROM=your-email@example.com`

**How to Set:**
1. Go to **Elastic Beanstalk Console** → Your environment
2. **Configuration** → **Software** → **Environment properties**
3. Add/edit each variable
4. **Save** and wait for environment restart (2-5 minutes)

**⚠️ Important Notes:**
- `FRONTEND_URL` must match your frontend domain exactly (with or without www)
- No trailing slash in `FRONTEND_URL` (e.g., `https://www.meow-crafts.com` not `https://www.meow-crafts.com/`)
- This is critical for CORS functionality
- After changing `FRONTEND_URL`, restart the environment

#### Custom Domain Setup

The backend is configured with a custom domain: `api.meow-crafts.com`

**Setup Process:**

1. **Create SSL Certificate:**
   - Go to **AWS Certificate Manager (ACM)** → **eu-central-1** region
   - **Request a certificate** → **Request a public certificate**
   - Domain name: `api.meow-crafts.com`
   - Validation method: **DNS validation**
   - Add DNS validation records to Route 53
   - Wait for certificate validation (can take up to 24 hours)

2. **Configure DNS:**
   - Go to **Route 53** → **Hosted zones** → Your domain
   - Add **CNAME record**:
     - **Name**: `api`
     - **Type**: CNAME
     - **Value**: Your Elastic Beanstalk environment URL (e.g., `meowcrafts-backend-prod.eba-msrp3v5m.eu-central-1.elasticbeanstalk.com`)
     - **TTL**: 300 (or default)

3. **Configure Load Balancer:**
   - Go to **EC2 Console** → **Load Balancers**
   - Find your Elastic Beanstalk Load Balancer
   - **Listeners** tab → **Add listener** (if not exists)
   - **HTTPS** → Port **443**
   - **Default action**: Forward to target group
   - **SSL certificate**: Select your ACM certificate for `api.meow-crafts.com`
   - **Save**

4. **Verify Target Group:**
   - Go to **EC2 Console** → **Target Groups**
   - Find target group used by Load Balancer
   - **Details** tab → Verify:
     - **Protocol**: **HTTP** (not HTTPS!)
     - **Port**: **80**
     - **Health check protocol**: **HTTP**
     - **Health check path**: `/health`

**⚠️ Important:**
- Load Balancer listener uses **HTTPS** (port 443) for SSL termination
- Target group uses **HTTP** (port 80) for backend communication
- Backend application listens on HTTP (port 8080)

5. **Update Frontend:**
   - Update frontend `VITE_API_URL` to: `https://api.meow-crafts.com/api`

**Architecture:**
```
Frontend (HTTPS) 
  → Load Balancer Listener (HTTPS/443) [SSL Termination]
    → Target Group (HTTP/80) 
      → Nginx (HTTP/8080)
        → Node.js App (HTTP/8080)
```

#### Build Process

The deployment process:
1. TypeScript is compiled locally before deployment (`npm run build`)
2. Compiled `dist/` folder is deployed to AWS
3. Server starts with `npm start` (runs `node dist/index.js`)

#### Health Check

Elastic Beanstalk uses `/health` endpoint for health checks. The endpoint returns:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

**Health Check Configuration:**
- **Path**: `/health`
- **Protocol**: HTTP
- **Port**: 80 (Load Balancer) → 8080 (Backend)
- **Interval**: 30 seconds
- **Timeout**: 5 seconds
- **Healthy threshold**: 3 consecutive successes
- **Unhealthy threshold**: 5 consecutive failures

**Test Health Check:**
```bash
# Direct Elastic Beanstalk URL
curl http://meowcrafts-backend-prod.eba-msrp3v5m.eu-central-1.elasticbeanstalk.com/health

# Custom domain
curl https://api.meow-crafts.com/health
```

#### Configuration Files

- `.ebextensions/` - Elastic Beanstalk configuration files
  - `01-nodecommand.config` - Environment variables and health check configuration
  - `02-nginx.config` - Nginx proxy configuration with CORS support and WebSocket handling
  - `03-websocket.config` - WebSocket/Socket.io sticky sessions configuration
  - `04-cors.config` - CORS and static files configuration
- `.ebignore` - Files to exclude from deployment (similar to .gitignore)
- `.elasticbeanstalk/config.yml` - EB CLI configuration

**Load Balancer Configuration:**
- Elastic Beanstalk automatically creates an Application Load Balancer (ALB)
- Load Balancer handles SSL termination (HTTPS on port 443)
- Target group uses HTTP protocol (port 80) to communicate with backend
- Backend application listens on HTTP (port 8080) via Nginx proxy

#### Educational Purpose Tags

To mark resources for educational purposes:
1. Go to **Elastic Beanstalk Console** → Your environment
2. **Configuration** → **Tags**
3. Add tag: **Key**: `Purpose`, **Value**: `Educational`
4. **Apply**

---

## 💻 Development

### TypeScript

The project uses TypeScript for type safety.

**Build:**
```bash
npm run build
```

**Watch mode (development):**
```bash
npm run dev
```

### Code Structure

- **Routes**: Handle HTTP requests
- **Middleware**: Authentication, error handling
- **Services**: Business logic (email, etc.)
- **Utils**: Helper functions
- **Config**: Configuration files

### Adding New Routes

1. Create route file in `routes/` directory
2. Import and use in `index.ts`:
```typescript
import newRoutes from './routes/new.js'
app.use('/api/new', newRoutes)
```

### Adding New Middleware

1. Create middleware file in `middleware/` directory
2. Import and use in route or `index.ts`:
```typescript
import { newMiddleware } from './middleware/new.js'
router.get('/endpoint', newMiddleware, handler)
```

---

## 📚 Related Documentation

- [Database Schema Documentation](./database/SUPABASE_DATABASE_SCHEMA.md)
- [Wheel of Fortune Documentation](../mywebsite-frontend/WHEEL_OF_FORTUNE_DOCUMENTATION.md)
- [SmartChat Documentation](../mywebsite-frontend/SMARTCHAT_DOCUMENTATION.md)
- [Frontend README](../mywebsite-frontend/README.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📝 License

ISC

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change PORT in .env or kill process using port 3000
lsof -ti:3000 | xargs kill
```

**Supabase connection errors:**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check Supabase project is active
- Verify network connectivity
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is used (not `SUPABASE_ANON_KEY`)

**Email not sending:**
- Verify SMTP credentials
- Check app password for Gmail
- Verify SMTP port and secure settings
- Check Elastic Beanstalk logs for email errors

**JWT token errors:**
- Verify `JWT_SECRET` is set in environment variables
- Check token expiration
- Ensure token is sent in Authorization header
- Verify `JWT_SECRET` matches between frontend and backend

**CORS errors:**
- Verify `FRONTEND_URL` environment variable is set correctly
- Check that `FRONTEND_URL` matches your frontend domain exactly (with or without www)
- Ensure no trailing slash in `FRONTEND_URL` (e.g., `https://www.meow-crafts.com` not `https://www.meow-crafts.com/`)
- Restart Elastic Beanstalk environment after changing `FRONTEND_URL`
- Check backend logs for CORS error messages

**502 Bad Gateway errors:**
- Check Elastic Beanstalk health status (should be "Ok")
- Verify Load Balancer target group is using **HTTP** protocol (not HTTPS)
- Check target group health: EC2 Console → Target Groups → Your target group → Targets tab
- Verify health check path is `/health` and protocol is HTTP
- Check backend logs: `eb logs` or Elastic Beanstalk Console → Logs
- Verify backend application is running: Check logs for startup errors

**Load Balancer issues:**
- Verify HTTPS listener (port 443) exists and uses correct SSL certificate
- Verify target group protocol is **HTTP** (not HTTPS)
- Check that Load Balancer forwards to correct target group
- Verify target group has healthy instances

**CloudFormation stack issues:**
- If stack is in `UPDATE_ROLLBACK_FAILED` state:
  ```bash
  aws cloudformation continue-update-rollback \
    --stack-name awseb-e-spnu4ap2s8-stack \
    --resources-to-skip AWSEBV2LoadBalancerListener \
    --region eu-central-1
  ```
- Check CloudFormation events for specific errors
- Verify all required resources exist (Load Balancer, Target Group, etc.)

**Custom domain not working:**
- Verify DNS CNAME record in Route 53 points to Elastic Beanstalk URL
- Check DNS propagation: Use [dnschecker.org](https://dnschecker.org/)
- Verify SSL certificate is valid and covers your domain
- Check Load Balancer listener is configured with correct SSL certificate
- Test: `curl https://api.meow-crafts.com/health`

**WebSocket connection issues:**
- Verify Socket.io server is running
- Check that WebSocket upgrade headers are properly configured
- Verify Load Balancer supports WebSocket (should work by default)
- Check backend logs for WebSocket connection errors
- Test WebSocket connection from frontend

**Environment variable not updating:**
- After changing environment variables, wait for environment restart (2-5 minutes)
- Check environment status in Elastic Beanstalk Console
- Verify variables are saved: Configuration → Software → Environment properties
- Restart environment manually if needed: Actions → Restart app server(s)

---

*Last updated: 2025*
