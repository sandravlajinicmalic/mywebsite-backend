# 🗄️ Teorijski Vodič: Migracija sa Supabase (PostgreSQL) na DynamoDB

## 📋 Pregled

Ovaj dokument objašnjava teorijski kako da migrirate celu bazu podataka sa Supabase (PostgreSQL) na AWS DynamoDB i kako da povežete sve komponente sistema.

---

## 🎯 Zašto DynamoDB?

**Prednosti:**
- ✅ Potpuno upravljani servis (bez servera)
- ✅ Automatsko skaliranje
- ✅ Veoma brz (single-digit millisecond latencija)
- ✅ Integracija sa AWS servisima (Lambda, API Gateway, itd.)
- ✅ Pay-per-use model
- ✅ Built-in backup i restore

**Razlike od PostgreSQL:**
- ❌ Nema JOIN operacija (NoSQL)
- ❌ Nema transakcija između tabela (samo unutar jedne tabele)
- ❌ Dizajn tabela mora biti drugačiji (denormalizacija)
- ❌ Query pattern mora biti poznat unapred

---

## 📊 Mapiranje Tabela: PostgreSQL → DynamoDB

### 1. **`users` tabela**

**PostgreSQL struktura:**
```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**DynamoDB dizajn:**

**Tabela: `Users`**
- **Partition Key (PK)**: `userId` (String) - UUID
- **Sort Key (SK)**: `METADATA` (String) - fiksna vrednost
- **Global Secondary Index (GSI1)**: 
  - **PK**: `email` (String)
  - **SK**: `userId` (String)
- **Global Secondary Index (GSI2)**:
  - **PK**: `nickname` (String)
  - **SK**: `userId` (String)

**Struktura item-a:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "SK": "METADATA",
  "email": "user@example.com",
  "nickname": "CatLover123",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "GSI1PK": "user@example.com",
  "GSI1SK": "123e4567-e89b-12d3-a456-426614174000",
  "GSI2PK": "CatLover123",
  "GSI2SK": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Zašto ovako?**
- GSI1 omogućava lookup po email-u (za login)
- GSI2 omogućava lookup po nickname-u (za validaciju)
- SK = "METADATA" omogućava dodavanje drugih tipova podataka po userId-u u budućnosti

---

### 2. **`contact_messages` tabela**

**PostgreSQL struktura:**
```sql
contact_messages (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP
)
```

**DynamoDB dizajn:**

**Tabela: `ContactMessages`**
- **Partition Key (PK)**: `messageId` (String) - UUID
- **Sort Key (SK)**: `METADATA` (String) - fiksna vrednost
- **Global Secondary Index (GSI1)**:
  - **PK**: `createdAt` (String) - ISO timestamp (za sortiranje)
  - **SK**: `messageId` (String)

**Struktura item-a:**
```json
{
  "messageId": "456e7890-e89b-12d3-a456-426614174001",
  "SK": "METADATA",
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Question",
  "message": "Hello, I have a question...",
  "createdAt": "2024-01-15T10:30:00Z",
  "GSI1PK": "2024-01-15T10:30:00Z",
  "GSI1SK": "456e7890-e89b-12d3-a456-426614174001"
}
```

**Zašto ovako?**
- GSI1 omogućava sortiranje po datumu kreiranja
- Query pattern: `GSI1PK = createdAt` za listanje poruka

---

### 3. **`global_cat_state` tabela**

**PostgreSQL struktura:**
```sql
global_cat_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current TEXT NOT NULL,
  is_resting BOOLEAN,
  rest_end_time TIMESTAMP,
  rested_by UUID,
  rested_by_name TEXT,
  last_updated TIMESTAMP
)
```

**DynamoDB dizajn:**

**Tabela: `GlobalCatState`**
- **Partition Key (PK)**: `stateId` (String) - fiksna vrednost "GLOBAL"
- **Sort Key (SK)**: `METADATA` (String) - fiksna vrednost

**Struktura item-a:**
```json
{
  "stateId": "GLOBAL",
  "SK": "METADATA",
  "current": "playing",
  "isResting": false,
  "restEndTime": null,
  "restedBy": null,
  "restedByName": null,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

**Zašto ovako?**
- Single-row tabela → fiksni PK i SK
- Uvek query: `PK = "GLOBAL" AND SK = "METADATA"`

---

### 4. **`cat_logs` tabela**

**PostgreSQL struktura:**
```sql
cat_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  user_name TEXT NOT NULL,
  timestamp TIMESTAMP
)
```

**DynamoDB dizajn:**

**Tabela: `CatLogs`**
- **Partition Key (PK)**: `logId` (String) - UUID
- **Sort Key (SK)**: `timestamp` (String) - ISO timestamp (za sortiranje)
- **Global Secondary Index (GSI1)**:
  - **PK**: `timestamp` (String) - ISO timestamp
  - **SK**: `logId` (String)

**Struktura item-a:**
```json
{
  "logId": "789e0123-e89b-12d3-a456-426614174002",
  "SK": "2024-01-15T10:30:00Z",
  "action": "Cat started playing",
  "userName": "CatLover123",
  "timestamp": "2024-01-15T10:30:00Z",
  "GSI1PK": "2024-01-15T10:30:00Z",
  "GSI1SK": "789e0123-e89b-12d3-a456-426614174002"
}
```

**Zašto ovako?**
- SK = timestamp omogućava sortiranje po vremenu
- GSI1 omogućava query po vremenskom opsegu (npr. poslednjih 50 logova)

---

### 5. **`wheel_spins` tabela**

**PostgreSQL struktura:**
```sql
wheel_spins (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  reward TEXT NOT NULL,
  created_at TIMESTAMP
)
```

**DynamoDB dizajn:**

**Tabela: `WheelSpins`**
- **Partition Key (PK)**: `userId` (String) - UUID korisnika
- **Sort Key (SK)**: `createdAt#spinId` (String) - kombinacija timestampa i UUID-a
- **Global Secondary Index (GSI1)**:
  - **PK**: `createdAt` (String) - ISO timestamp
  - **SK**: `userId#spinId` (String)

**Struktura item-a:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "SK": "2024-01-15T10:30:00Z#spin-456e7890",
  "spinId": "spin-456e7890",
  "reward": "Paw-some Cursor",
  "createdAt": "2024-01-15T10:30:00Z",
  "GSI1PK": "2024-01-15T10:30:00Z",
  "GSI1SK": "123e4567-e89b-12d3-a456-426614174000#spin-456e7890"
}
```

**Zašto ovako?**
- PK = userId omogućava query svih spinova jednog korisnika
- SK = createdAt#spinId omogućava sortiranje po vremenu (najnoviji prvi)
- GSI1 omogućava query svih spinova po vremenu (npr. za admin panel)

**Query pattern za poslednji spin korisnika:**
```
Query: PK = userId, ScanIndexForward = false, Limit = 1
```

---

### 6. **`user_active_rewards` tabela**

**PostgreSQL struktura:**
```sql
user_active_rewards (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP,
  UNIQUE(user_id, reward_type)
)
```

**DynamoDB dizajn:**

**Tabela: `UserActiveRewards`**
- **Partition Key (PK)**: `userId` (String) - UUID korisnika
- **Sort Key (SK)**: `rewardType` (String) - tip nagrade (avatar, nickname, cursor, itd.)
- **Global Secondary Index (GSI1)**:
  - **PK**: `expiresAt` (String) - ISO timestamp
  - **SK**: `userId#rewardType` (String)

**Struktura item-a:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "SK": "avatar",
  "rewardType": "avatar",
  "rewardValue": "{\"avatarId\":5,\"avatarPath\":\"/images/user-profile-icons/cat5.svg\"}",
  "expiresAt": "2024-01-15T11:00:00Z",
  "createdAt": "2024-01-15T10:30:00Z",
  "GSI1PK": "2024-01-15T11:00:00Z",
  "GSI1SK": "123e4567-e89b-12d3-a456-426614174000#avatar"
}
```

**Zašto ovako?**
- PK = userId omogućava query svih aktivnih nagrada korisnika
- SK = rewardType omogućava unique constraint (jedna nagrada po tipu)
- GSI1 omogućava cleanup expired nagrada (query po expiresAt)

**Query pattern za aktivne nagrade korisnika:**
```
Query: PK = userId
```

**Query pattern za cleanup expired nagrada:**
```
Query GSI1: GSI1PK < currentTimestamp
```

---

## 🔧 Backend Promene

### 1. **Instalacija AWS SDK**

Dodaj u `package.json`:
```json
{
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.x.x",
    "@aws-sdk/lib-dynamodb": "^3.x.x"
  }
}
```

Zatim pokreni:
```bash
npm install
```

---

### 2. **Kreiranje DynamoDB Client-a**

Kreiraj novi fajl: `config/dynamodb.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import dotenv from 'dotenv'

dotenv.config()

// AWS Region (npr. 'eu-central-1')
const region = process.env.AWS_REGION || 'eu-central-1'

// Kreiraj DynamoDB client
const client = new DynamoDBClient({
  region,
  // Za lokalni development, koristi AWS credentials iz ~/.aws/credentials
  // Za production (Elastic Beanstalk), koristi IAM role
})

// Kreiraj Document Client (za lakši rad sa JavaScript objektima)
export const dynamoClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
})

// Export client-a za direktan pristup ako treba
export { client as dynamoDBClient }
```

---

### 3. **Environment Variables**

Dodaj u `.env`:
```env
# AWS Configuration
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-access-key-id  # Samo za lokalni development
AWS_SECRET_ACCESS_KEY=your-secret-key  # Samo za lokalni development

# DynamoDB Table Names
DYNAMODB_USERS_TABLE=Users
DYNAMODB_CONTACT_MESSAGES_TABLE=ContactMessages
DYNAMODB_GLOBAL_CAT_STATE_TABLE=GlobalCatState
DYNAMODB_CAT_LOGS_TABLE=CatLogs
DYNAMODB_WHEEL_SPINS_TABLE=WheelSpins
DYNAMODB_USER_ACTIVE_REWARDS_TABLE=UserActiveRewards
```

**Napomena:** Za AWS Elastic Beanstalk, ne koristi `AWS_ACCESS_KEY_ID` i `AWS_SECRET_ACCESS_KEY`. Umesto toga, koristi IAM Role koji se automatski dodeljuje EC2 instanci.

---

### 4. **Helper Funkcije za DynamoDB**

Kreiraj novi fajl: `utils/dynamodb-helpers.ts`

```typescript
import { dynamoClient } from '../config/dynamodb.js'
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'

// Helper za Get item
export async function getItem(
  tableName: string,
  key: Record<string, any>
): Promise<any | null> {
  try {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    })
    const response = await dynamoClient.send(command)
    return response.Item || null
  } catch (error) {
    console.error(`Error getting item from ${tableName}:`, error)
    throw error
  }
}

// Helper za Put item
export async function putItem(
  tableName: string,
  item: Record<string, any>
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    })
    await dynamoClient.send(command)
  } catch (error) {
    console.error(`Error putting item to ${tableName}:`, error)
    throw error
  }
}

// Helper za Update item
export async function updateItem(
  tableName: string,
  key: Record<string, any>,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
): Promise<any> {
  try {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    })
    const response = await dynamoClient.send(command)
    return response.Attributes
  } catch (error) {
    console.error(`Error updating item in ${tableName}:`, error)
    throw error
  }
}

// Helper za Delete item
export async function deleteItem(
  tableName: string,
  key: Record<string, any>
): Promise<void> {
  try {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    })
    await dynamoClient.send(command)
  } catch (error) {
    console.error(`Error deleting item from ${tableName}:`, error)
    throw error
  }
}

// Helper za Query
export async function query(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>,
  indexName?: string,
  scanIndexForward: boolean = true,
  limit?: number
): Promise<any[]> {
  try {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      IndexName: indexName,
      ScanIndexForward: scanIndexForward,
      Limit: limit,
    })
    const response = await dynamoClient.send(command)
    return response.Items || []
  } catch (error) {
    console.error(`Error querying ${tableName}:`, error)
    throw error
  }
}

// Helper za Scan (koristi samo kada je neophodno)
export async function scan(
  tableName: string,
  filterExpression?: string,
  expressionAttributeValues?: Record<string, any>,
  limit?: number
): Promise<any[]> {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
    })
    const response = await dynamoClient.send(command)
    return response.Items || []
  } catch (error) {
    console.error(`Error scanning ${tableName}:`, error)
    throw error
  }
}
```

---

### 5. **Promena Auth Routes (`routes/auth.ts`)**

**Zameni Supabase pozive sa DynamoDB:**

```typescript
// Umesto:
import { supabase } from '../config/supabase.js'

// Koristi:
import { getItem, putItem, updateItem, query } from '../utils/dynamodb-helpers.js'
import { v4 as uuidv4 } from 'uuid'

const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'Users'

// Login/Register endpoint - promenjeno
router.post('/login', async (req, res, next) => {
  try {
    const { email, nickname } = req.body

    // Validacija (ista kao pre)

    // Proveri da li korisnik postoji po email-u (GSI1)
    const usersByEmail = await query(
      USERS_TABLE,
      'GSI1PK = :email',
      { ':email': email },
      'GSI1'
    )

    const existingUserByEmail = usersByEmail.length > 0 ? usersByEmail[0] : null

    // Proveri da li korisnik postoji po nickname-u (GSI2)
    const usersByNickname = await query(
      USERS_TABLE,
      'GSI2PK = :nickname',
      { ':nickname': nickname },
      'GSI2'
    )

    const existingUserByNickname = usersByNickname.length > 0 ? usersByNickname[0] : null

    // Validacija (ista logika kao pre)

    let user

    if (existingUserByEmail) {
      // User exists - update nickname if changed
      const now = new Date().toISOString()
      const updatedUser = await updateItem(
        USERS_TABLE,
        { userId: existingUserByEmail.userId, SK: 'METADATA' },
        'SET nickname = :nickname, updatedAt = :updatedAt, GSI2PK = :nickname, GSI2SK = :userId',
        {
          ':nickname': nickname,
          ':updatedAt': now,
          ':userId': existingUserByEmail.userId,
        }
      )
      user = updatedUser
    } else {
      // Create new user
      const userId = uuidv4()
      const now = new Date().toISOString()
      const newUser = {
        userId,
        SK: 'METADATA',
        email,
        nickname,
        createdAt: now,
        updatedAt: now,
        GSI1PK: email,
        GSI1SK: userId,
        GSI2PK: nickname,
        GSI2SK: userId,
      }
      await putItem(USERS_TABLE, newUser)
      user = newUser

      // Send welcome email
      emailService.sendWelcomeEmail(email, nickname).catch(console.error)
    }

    // Generate JWT token (ista logika)
    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      user: {
        id: user.userId,
        email: user.email,
        nickname: user.nickname,
      },
      token,
    })
  } catch (error) {
    next(error)
  }
})

// Verify token endpoint - promenjeno
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      res.status(401).json({ error: 'Token not found' })
      return
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JwtPayload

    // Get user from DynamoDB
    const user = await getItem(USERS_TABLE, {
      userId: decoded.userId,
      SK: 'METADATA',
    })

    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    res.json({
      success: true,
      user: {
        id: user.userId,
        email: user.email,
        nickname: user.nickname,
      },
    })
  } catch (error) {
    // Error handling
  }
})

// Forgot nickname endpoint - promenjeno
router.post('/forgot-nickname', async (req, res, next) => {
  try {
    const { email } = req.body

    // Validacija

    // Query po email-u (GSI1)
    const users = await query(
      USERS_TABLE,
      'GSI1PK = :email',
      { ':email': email },
      'GSI1'
    )

    const user = users.length > 0 ? users[0] : null

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'No account found with this email address',
      })
      return
    }

    // Send email
    emailService.sendForgotNicknameEmail(user.email, user.nickname).catch(console.error)

    res.json({
      success: true,
      message: 'We have sent your nickname to your email address',
    })
  } catch (error) {
    next(error)
  }
})

// Delete account endpoint - promenjeno
router.delete('/delete', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.userId

    // Get user
    const user = await getItem(USERS_TABLE, {
      userId,
      SK: 'METADATA',
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Delete user (cascade delete se mora ručno uraditi)
    await deleteItem(USERS_TABLE, {
      userId,
      SK: 'METADATA',
    })

    // Delete related data (wheel spins, active rewards)
    // Ovo mora biti u transakciji ili batch delete
    // Za sada, možemo koristiti batch delete ili Lambda za cleanup

    // Send email
    emailService.sendDeleteAccountEmail(user.email, user.nickname).catch(console.error)

    res.json({
      success: true,
      message: 'Account deleted successfully',
    })
  } catch (error) {
    next(error)
  }
})
```

---

### 6. **Promena Wheel Routes (`routes/wheel.ts`)**

```typescript
import { getItem, putItem, query } from '../utils/dynamodb-helpers.js'
import { v4 as uuidv4 } from 'uuid'

const WHEEL_SPINS_TABLE = process.env.DYNAMODB_WHEEL_SPINS_TABLE || 'WheelSpins'
const USER_ACTIVE_REWARDS_TABLE = process.env.DYNAMODB_USER_ACTIVE_REWARDS_TABLE || 'UserActiveRewards'

// Check cooldown - promenjeno
const checkCooldown = async (userId: string): Promise<{ canSpin: boolean; remainingMs: number }> => {
  // Query poslednji spin korisnika (sort descending)
  const spins = await query(
    WHEEL_SPINS_TABLE,
    'userId = :userId',
    { ':userId': userId },
    undefined, // no index
    false, // ScanIndexForward = false (descending)
    1 // Limit = 1
  )

  if (spins.length === 0) {
    return { canSpin: true, remainingMs: 0 }
  }

  const lastSpin = spins[0]

  // Skip cooldown ako je "Spin Again"
  if (lastSpin.reward === 'Spin Again, Brave Soul') {
    return { canSpin: true, remainingMs: 0 }
  }

  const lastSpinTime = new Date(lastSpin.createdAt)
  const now = new Date()
  const timeDiff = now.getTime() - lastSpinTime.getTime()
  const remainingMs = COOLDOWN_MS - timeDiff

  return {
    canSpin: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
  }
}

// Create active reward - promenjeno
const createActiveReward = async (
  userId: string,
  rewardType: string,
  rewardValue: any,
  durationMs: number = REWARD_DURATION_MS
): Promise<void> => {
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  const rewardValueStr = JSON.stringify(rewardValue)
  const now = new Date().toISOString()

  // Upsert (Put overwrites existing item)
  await putItem(USER_ACTIVE_REWARDS_TABLE, {
    userId,
    SK: rewardType,
    rewardType,
    rewardValue: rewardValueStr,
    expiresAt,
    createdAt: now,
    GSI1PK: expiresAt,
    GSI1SK: `${userId}#${rewardType}`,
  })
}

// Spin endpoint - promenjeno
router.post('/spin', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { reward } = req.body
    const userId = req.user?.userId

    // Validacija

    // Check cooldown
    const { canSpin, remainingMs } = await checkCooldown(userId)

    if (!canSpin) {
      res.status(429).json({
        error: 'Cooldown active',
        canSpin: false,
        cooldownSeconds: Math.ceil(remainingMs / 1000),
      })
      return
    }

    // Create spin record
    const spinId = `spin-${uuidv4()}`
    const now = new Date().toISOString()

    await putItem(WHEEL_SPINS_TABLE, {
      userId,
      SK: `${now}#${spinId}`,
      spinId,
      reward,
      createdAt: now,
      GSI1PK: now,
      GSI1SK: `${userId}#${spinId}`,
    })

    // Handle rewards (ista logika kao pre)
    // ...

    res.json({
      success: true,
      spin: {
        id: spinId,
        user_id: userId,
        reward,
        created_at: now,
      },
      canSpin: false,
      cooldownSeconds: 30,
    })
  } catch (error) {
    next(error)
  }
})

// Get history - promenjeno
router.get('/history', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.userId

    // Query sve spinove korisnika (sort descending)
    const spins = await query(
      WHEEL_SPINS_TABLE,
      'userId = :userId',
      { ':userId': userId },
      undefined,
      false // descending
    )

    res.json({
      success: true,
      spins: spins.map((spin) => ({
        id: spin.spinId,
        reward: spin.reward,
        created_at: spin.createdAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})
```

---

### 7. **Promena Cat Routes (`routes/cat.ts`)**

```typescript
import { getItem, putItem, updateItem, query, putItem } from '../utils/dynamodb-helpers.js'
import { v4 as uuidv4 } from 'uuid'

const GLOBAL_CAT_STATE_TABLE = process.env.DYNAMODB_GLOBAL_CAT_STATE_TABLE || 'GlobalCatState'
const CAT_LOGS_TABLE = process.env.DYNAMODB_CAT_LOGS_TABLE || 'CatLogs'

// Get current cat state - promenjeno
async function getCurrentCatState(): Promise<CatStateData | null> {
  const state = await getItem(GLOBAL_CAT_STATE_TABLE, {
    stateId: 'GLOBAL',
    SK: 'METADATA',
  })

  if (!state) {
    return null
  }

  // Map DynamoDB format to expected format
  return {
    current: state.current,
    is_resting: state.isResting,
    rest_end_time: state.restEndTime,
    rested_by: state.restedBy,
    rested_by_name: state.restedByName,
    last_updated: state.lastUpdated,
  }
}

// Add log - promenjeno
async function addLog(action: string, userName?: string): Promise<void> {
  try {
    const logId = uuidv4()
    const timestamp = new Date().toISOString()

    const logItem = {
      logId,
      SK: timestamp,
      action,
      userName: userName || 'System',
      timestamp,
      GSI1PK: timestamp,
      GSI1SK: logId,
    }

    await putItem(CAT_LOGS_TABLE, logItem)

    // Broadcast to Socket.io (ista logika)
    io.emit('new-log', {
      id: logId,
      action,
      user_name: userName || 'System',
      timestamp,
    })
  } catch (error) {
    console.error('Error adding log to database:', error)
  }
}

// Update cat state - promenjeno
async function updateCatState(updates: Partial<CatStateData>): Promise<void> {
  const now = new Date().toISOString()
  const updateExpression: string[] = []
  const expressionAttributeValues: Record<string, any> = { ':lastUpdated': now }
  const expressionAttributeNames: Record<string, string> = {}

  if (updates.current !== undefined) {
    updateExpression.push('#current = :current')
    expressionAttributeNames['#current'] = 'current'
    expressionAttributeValues[':current'] = updates.current
  }

  if (updates.is_resting !== undefined) {
    updateExpression.push('isResting = :isResting')
    expressionAttributeValues[':isResting'] = updates.is_resting
  }

  if (updates.rest_end_time !== undefined) {
    updateExpression.push('restEndTime = :restEndTime')
    expressionAttributeValues[':restEndTime'] = updates.rest_end_time
  }

  if (updates.rested_by !== undefined) {
    updateExpression.push('restedBy = :restedBy')
    expressionAttributeValues[':restedBy'] = updates.rested_by
  }

  if (updates.rested_by_name !== undefined) {
    updateExpression.push('restedByName = :restedByName')
    expressionAttributeValues[':restedByName'] = updates.rested_by_name
  }

  updateExpression.push('lastUpdated = :lastUpdated')

  await updateItem(
    GLOBAL_CAT_STATE_TABLE,
    { stateId: 'GLOBAL', SK: 'METADATA' },
    `SET ${updateExpression.join(', ')}`,
    expressionAttributeValues,
    expressionAttributeNames
  )
}

// Get logs - promenjeno (za Socket.io)
async function getLogs(limit: number = 50): Promise<any[]> {
  // Query po GSI1 (timestamp) - descending
  const logs = await query(
    CAT_LOGS_TABLE,
    'GSI1PK >= :timestamp',
    { ':timestamp': new Date(0).toISOString() }, // All logs
    'GSI1',
    false, // descending
    limit
  )

  return logs.map((log) => ({
    id: log.logId,
    action: log.action,
    user_name: log.userName,
    timestamp: log.timestamp,
  }))
}
```

---

### 8. **Promena User Routes (`routes/user.ts`)**

```typescript
import { getItem, query, scan } from '../utils/dynamodb-helpers.js'

const USER_ACTIVE_REWARDS_TABLE = process.env.DYNAMODB_USER_ACTIVE_REWARDS_TABLE || 'UserActiveRewards'

// Get active rewards - promenjeno
router.get('/active-rewards', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.userId

    // Query sve aktivne nagrade korisnika
    const rewards = await query(
      USER_ACTIVE_REWARDS_TABLE,
      'userId = :userId',
      { ':userId': userId }
    )

    // Filter expired rewards
    const now = new Date().toISOString()
    const activeRewards = rewards.filter((reward) => reward.expiresAt > now)

    // Format response (ista logika kao pre)
    const formattedRewards: Record<string, any> = {}

    for (const reward of activeRewards) {
      formattedRewards[reward.rewardType] = {
        value: JSON.parse(reward.rewardValue),
        expiresAt: reward.expiresAt,
      }
    }

    res.json(formattedRewards)
  } catch (error) {
    next(error)
  }
})

// Cleanup expired rewards - promenjeno
router.post('/cleanup-expired-rewards', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user?.userId
    const now = new Date().toISOString()

    // Query expired rewards za korisnika (GSI1)
    const expiredRewards = await query(
      USER_ACTIVE_REWARDS_TABLE,
      'GSI1PK < :now',
      { ':now': now },
      'GSI1'
    )

    // Filter samo za ovog korisnika
    const userExpiredRewards = expiredRewards.filter(
      (reward) => reward.userId === userId
    )

    // Delete expired rewards
    let deletedCount = 0
    for (const reward of userExpiredRewards) {
      await deleteItem(USER_ACTIVE_REWARDS_TABLE, {
        userId: reward.userId,
        SK: reward.rewardType,
      })
      deletedCount++
    }

    res.json({
      success: true,
      message: 'Expired rewards cleaned up',
      deletedCount,
    })
  } catch (error) {
    next(error)
  }
})
```

---

### 9. **Promena Contact Routes (`routes/contact.ts`)**

```typescript
import { putItem, scan } from '../utils/dynamodb-helpers.js'
import { v4 as uuidv4 } from 'uuid'

const CONTACT_MESSAGES_TABLE = process.env.DYNAMODB_CONTACT_MESSAGES_TABLE || 'ContactMessages'

// Submit contact - promenjeno
router.post('/submit', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body

    // Validacija

    const messageId = uuidv4()
    const now = new Date().toISOString()

    const messageItem = {
      messageId,
      SK: 'METADATA',
      name,
      email,
      subject: subject || null,
      message,
      createdAt: now,
      GSI1PK: now,
      GSI1SK: messageId,
    }

    await putItem(CONTACT_MESSAGES_TABLE, messageItem)

    // Send email (ista logika)

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: messageId,
        name,
        email,
        subject,
        message,
        created_at: now,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get messages - promenjeno (admin only)
router.get('/messages', async (req, res, next) => {
  try {
    // Scan sve poruke (ili query po GSI1 za sortiranje)
    const messages = await scan(CONTACT_MESSAGES_TABLE)

    // Sort po createdAt (descending)
    messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    res.json({
      success: true,
      messages: messages.map((msg) => ({
        id: msg.messageId,
        name: msg.name,
        email: msg.email,
        subject: msg.subject,
        message: msg.message,
        created_at: msg.createdAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})
```

---

## 🏗️ Kreiranje DynamoDB Tabela

### Opcija 1: AWS Console (Ručno)

1. **Idi na AWS Console → DynamoDB**
2. **Kreiraj tabelu za svaku od 6 tabela:**

#### Tabela: `Users`
- **Table name**: `Users`
- **Partition key**: `userId` (String)
- **Sort key**: `SK` (String)
- **Settings**: On-demand billing (ili Provisioned sa 5 RCU/WCU)
- **Global Secondary Indexes**:
  - **GSI1**:
    - **Index name**: `GSI1`
    - **Partition key**: `GSI1PK` (String)
    - **Sort key**: `GSI1SK` (String)
  - **GSI2**:
    - **Index name**: `GSI2`
    - **Partition key**: `GSI2PK` (String)
    - **Sort key**: `GSI2SK` (String)

#### Tabela: `ContactMessages`
- **Table name**: `ContactMessages`
- **Partition key**: `messageId` (String)
- **Sort key**: `SK` (String)
- **Global Secondary Index**:
  - **GSI1**:
    - **Index name**: `GSI1`
    - **Partition key**: `GSI1PK` (String)
    - **Sort key**: `GSI1SK` (String)

#### Tabela: `GlobalCatState`
- **Table name**: `GlobalCatState`
- **Partition key**: `stateId` (String)
- **Sort key**: `SK` (String)
- **Nema GSI**

#### Tabela: `CatLogs`
- **Table name**: `CatLogs`
- **Partition key**: `logId` (String)
- **Sort key**: `SK` (String)
- **Global Secondary Index**:
  - **GSI1**:
    - **Index name**: `GSI1`
    - **Partition key**: `GSI1PK` (String)
    - **Sort key**: `GSI1SK` (String)

#### Tabela: `WheelSpins`
- **Table name**: `WheelSpins`
- **Partition key**: `userId` (String)
- **Sort key**: `SK` (String)
- **Global Secondary Index**:
  - **GSI1**:
    - **Index name**: `GSI1`
    - **Partition key**: `GSI1PK` (String)
    - **Sort key**: `GSI1SK` (String)

#### Tabela: `UserActiveRewards`
- **Table name**: `UserActiveRewards`
- **Partition key**: `userId` (String)
- **Sort key**: `SK` (String)
- **Global Secondary Index**:
  - **GSI1**:
    - **Index name**: `GSI1`
    - **Partition key**: `GSI1PK` (String)
    - **Sort key**: `GSI1SK` (String)

---

### Opcija 2: AWS CloudFormation / Terraform

Možeš kreirati CloudFormation template ili Terraform konfiguraciju za automatsko kreiranje svih tabela.

---

### Opcija 3: AWS CLI

Možeš koristiti AWS CLI komande za kreiranje tabela (ali to zahteva terminal, što ne želiš).

---

## 🔄 Migracija Podataka

### Strategija Migracije

1. **Dual Write Period** (Preporučeno):
   - Piši u obe baze (Supabase i DynamoDB) tokom migracije
   - Čitaj iz Supabase dok se ne migriraju svi podaci
   - Nakon migracije, prebaci čitanje na DynamoDB

2. **Full Migration Script**:
   - Kreiraj Node.js script koji čita iz Supabase i piše u DynamoDB
   - Pokreni script ručno kada si spreman

### Primer Migracije Script-a

Kreiraj `scripts/migrate-to-dynamodb.ts`:

```typescript
import { supabase } from '../config/supabase.js'
import { putItem } from '../utils/dynamodb-helpers.js'
import { v4 as uuidv4 } from 'uuid'

const USERS_TABLE = 'Users'
const CONTACT_MESSAGES_TABLE = 'ContactMessages'
// ... ostale tabele

async function migrateUsers() {
  console.log('Migrating users...')
  
  // Read all users from Supabase
  const { data: users, error } = await supabase
    .from('users')
    .select('*')

  if (error) {
    console.error('Error reading users:', error)
    return
  }

  // Write to DynamoDB
  for (const user of users) {
    const dynamoItem = {
      userId: user.id,
      SK: 'METADATA',
      email: user.email,
      nickname: user.nickname,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      GSI1PK: user.email,
      GSI1SK: user.id,
      GSI2PK: user.nickname,
      GSI2SK: user.id,
    }
    
    await putItem(USERS_TABLE, dynamoItem)
    console.log(`Migrated user: ${user.email}`)
  }

  console.log(`Migrated ${users.length} users`)
}

async function migrateContactMessages() {
  console.log('Migrating contact messages...')
  
  const { data: messages, error } = await supabase
    .from('contact_messages')
    .select('*')

  if (error) {
    console.error('Error reading messages:', error)
    return
  }

  for (const msg of messages) {
    const dynamoItem = {
      messageId: msg.id,
      SK: 'METADATA',
      name: msg.name,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      createdAt: msg.created_at,
      GSI1PK: msg.created_at,
      GSI1SK: msg.id,
    }
    
    await putItem(CONTACT_MESSAGES_TABLE, dynamoItem)
  }

  console.log(`Migrated ${messages.length} messages`)
}

// ... ostale migracije

async function main() {
  try {
    await migrateUsers()
    await migrateContactMessages()
    // ... ostale migracije
    console.log('Migration completed!')
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

main()
```

**Pokreni script:**
```bash
tsx scripts/migrate-to-dynamodb.ts
```

---

## 🔐 AWS IAM Permissions

### Za Elastic Beanstalk (Production)

Kreiraj IAM Role sa sledećim permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-central-1:*:table/Users",
        "arn:aws:dynamodb:eu-central-1:*:table/Users/index/*",
        "arn:aws:dynamodb:eu-central-1:*:table/ContactMessages",
        "arn:aws:dynamodb:eu-central-1:*:table/ContactMessages/index/*",
        "arn:aws:dynamodb:eu-central-1:*:table/GlobalCatState",
        "arn:aws:dynamodb:eu-central-1:*:table/CatLogs",
        "arn:aws:dynamodb:eu-central-1:*:table/CatLogs/index/*",
        "arn:aws:dynamodb:eu-central-1:*:table/WheelSpins",
        "arn:aws:dynamodb:eu-central-1:*:table/WheelSpins/index/*",
        "arn:aws:dynamodb:eu-central-1:*:table/UserActiveRewards",
        "arn:aws:dynamodb:eu-central-1:*:table/UserActiveRewards/index/*"
      ]
    }
  ]
}
```

**Dodeli Role EC2 instanci u Elastic Beanstalk:**
1. **Elastic Beanstalk Console** → **Configuration** → **Security**
2. **IAM instance profile** → Izaberi Role sa DynamoDB permissions

---

## 📝 Checklist Migracije

### Pre Migracije
- [ ] Kreiraj sve DynamoDB tabele u AWS Console
- [ ] Kreiraj GSI za sve tabele koje ih zahtevaju
- [ ] Instaliraj AWS SDK u backend (`npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb`)
- [ ] Kreiraj `config/dynamodb.ts`
- [ ] Kreiraj `utils/dynamodb-helpers.ts`
- [ ] Dodaj environment variables u `.env`
- [ ] Testiraj lokalno sa AWS credentials

### Tokom Migracije
- [ ] Promeni sve route fajlove da koriste DynamoDB umesto Supabase
- [ ] Testiraj sve API endpoints lokalno
- [ ] Migriraj podatke iz Supabase u DynamoDB (script)
- [ ] Verifikuj da su svi podaci migrirani

### Posle Migracije
- [ ] Kreiraj IAM Role sa DynamoDB permissions
- [ ] Dodeli Role Elastic Beanstalk environment-u
- [ ] Dodaj environment variables u Elastic Beanstalk
- [ ] Deploy backend na Elastic Beanstalk
- [ ] Testiraj production API endpoints
- [ ] Monitor DynamoDB metrike (CloudWatch)
- [ ] Ukloni Supabase dependency iz `package.json` (opciono)

---

## ⚠️ Važne Napomene

### 1. **Transakcije**
DynamoDB ne podržava transakcije između različitih tabela. Ako imaš operacije koje zahtevaju transakcije (npr. delete user + delete related data), moraš koristiti:
- **DynamoDB Transactions** (za operacije unutar jedne tabele)
- **Lambda funkcije** za cleanup operacije
- **Event-driven architecture** (DynamoDB Streams + Lambda)

### 2. **Cascade Delete**
PostgreSQL automatski briše related records sa `ON DELETE CASCADE`. U DynamoDB, moraš ručno:
- Query sve related items
- Delete ih jedan po jedan (ili batch delete)

### 3. **Query Patterns**
DynamoDB zahteva da znaš query pattern unapred. Ako trebaš novi query pattern, moraš kreirati novi GSI.

### 4. **Cost Optimization**
- Koristi **On-demand billing** za početak (automatsko skaliranje)
- Prebaci na **Provisioned** ako imaš predvidljiv traffic
- Monitoruj CloudWatch metrike za cost optimization

### 5. **Backup**
- Omogući **Point-in-time recovery** za production tabele
- Kreiraj **On-demand backups** pre većih promena

---

## 🎓 Dodatni Resursi

- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [DynamoDB Data Modeling](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html#bp-data-modeling)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)

---

**Napomena:** Ovaj vodič je teorijski i objašnjava koncepte. Sve komande i skripte treba pokrenuti ručno kada si spreman za migraciju.

