import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer, type Server as HttpServer } from 'http'
import { Server, type Socket } from 'socket.io'
import authRoutes from './routes/auth.js'
import contactRoutes from './routes/contact.js'
import catRoutes, { getCurrentCatState, addLog } from './routes/cat.js'
import chatRoutes from './routes/chat.js'
import wheelRoutes from './routes/wheel.js'
import userRoutes from './routes/user.js'
import { errorHandler } from './middleware/errorHandler.js'
import { supabase } from './config/supabase.js'

// Load environment variables from .env file (if it exists)
// In production, environment variables are set via Render dashboard, but this won't cause errors
dotenv.config()

// Normalize FRONTEND_URL to remove trailing slash
const normalizeUrl = (url: string | undefined): string => {
  if (!url) return 'http://localhost:5173'
  return url.replace(/\/+$/, '') // Remove trailing slashes
}

const frontendUrl = normalizeUrl(process.env.FRONTEND_URL)
// Support multiple frontend URLs (comma-separated)
const frontendUrls = process.env.FRONTEND_URLS
  ? process.env.FRONTEND_URLS.split(',').map(url => normalizeUrl(url.trim()))
  : []

// CORS origin checker
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true // Allow requests with no origin (like mobile apps or curl)
  
  const normalizedOrigin = normalizeUrl(origin)
  
  // Allowed origins list
  const allowedOrigins = [
    frontendUrl,
    ...frontendUrls, // Add multiple frontend URLs if provided
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000'
  ]
  
  // Check exact match
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true
  }
  
  // Allow all Vercel preview/production domains (*.vercel.app)
  if (normalizedOrigin.includes('.vercel.app')) {
    return true
  }
  
  // Allow all Amplify domains (*.amplifyapp.com)
  if (normalizedOrigin.includes('.amplifyapp.com')) {
    return true
  }
    
  // Only log blocked origins (not allowed ones)
  console.log(`❌ CORS blocked origin: ${normalizedOrigin}`)
  console.log(`   Allowed origins: ${allowedOrigins.join(', ')}`)
  return false
}

const app: Express = express()
const httpServer: HttpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  transports: ['polling', 'websocket'], // Try polling first
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000
})

// Middleware - CORS (only log blocked requests)
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true)
    } else {
      // Only log blocked origins
      console.log(`❌ CORS blocked for origin: ${origin || 'undefined'}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Log all incoming requests
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`)
  next()
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend API is running', version: '1.0.0' })
})

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/cat', catRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/wheel', wheelRoutes)
app.use('/api/user', userRoutes)

// Cat State Machine - runs 24/7
let stateMachineInterval: NodeJS.Timeout | null = null
let cleanupInterval: NodeJS.Timeout | null = null
let previousState: string | null = null // Track previous state to avoid repetition

async function initializeCatStateMachine() {
  try {
    // Initialize cat state if it doesn't exist
    const { data: existingState, error: selectError } = await supabase
      .from('global_cat_state')
      .select('*')
      .eq('id', 1)
      .single()

    if (selectError && selectError.code === 'PGRST116') {
      // No rows returned - need to create initial state
      const { data: _newState, error: insertError } = await supabase
        .from('global_cat_state')
        .insert([
          {
            id: 1,
            current: 'playing',
            is_resting: false,
            rest_end_time: null,
            rested_by: null,
            rested_by_name: null,
            last_updated: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (insertError) {
        console.error('Error creating initial cat state:', insertError)
        throw insertError
      }

      previousState = null // No previous state on initialization
      await addLog('System: Cat initialized')
    } else if (selectError) {
      console.error('Error checking cat state:', selectError)
      throw selectError
    } else if (existingState) {
      // Initialize previousState with current state to avoid immediate repetition
      previousState = existingState.current
    }
  } catch (error) {
    console.error('Failed to initialize cat state machine:', error)
    throw error
  }

  // State machine loop - runs every 10 seconds
  stateMachineInterval = setInterval(async () => {
    try {
      const state = await getCurrentCatState()
      if (!state) return

      const now = new Date()

      // Check if REST period has ended
      if (state.is_resting && state.rest_end_time) {
        const restEndTime = new Date(state.rest_end_time)
        if (now >= restEndTime) {
          // REST period ended - go to 'wake' state
          await supabase
            .from('global_cat_state')
            .update({
              current: 'wake',
              is_resting: false,
              rest_end_time: null,
              rested_by: null,
              rested_by_name: null,
              last_updated: now.toISOString()
            })
            .eq('id', 1)

          await addLog('System: Cat woke up')
          io.emit('cat-rest-ended')
          io.emit('cat-state-changed', { state: 'wake' })
          
          // Update previousState to 'sleeping' so 'wake' won't be immediately repeated
          previousState = 'sleeping'
        }
        // If REST is still active, don't change state
        return
      }

      // Handle 'wake' state - wait at least 10 seconds before transitioning
      // This ensures 'wake' state is visible to users before changing
      if (state.current === 'wake') {
        const lastUpdated = new Date(state.last_updated)
        const timeSinceWake = now.getTime() - lastUpdated.getTime()
        // Wait at least 10 seconds before transitioning from 'wake' to normal state
        if (timeSinceWake < 10000) {
          return // Don't change state yet - 'wake' needs to be visible
        }
      }

      // Change state every 10 seconds (only if not resting)
      // Exclude 'sleeping' state (only for REST)
      // 'wake' state will be replaced by normal state machine after 10 seconds
      const states: Array<'playing' | 'zen' | 'happy' | 'tired' | 'angry'> = ['playing', 'zen', 'happy', 'tired', 'angry']
      
      // Filter out current state AND previous state to avoid repetition
      // Also handle 'wake' state - treat it as if previous state was 'sleeping'
      const effectivePreviousState = (state.current === 'wake') ? 'sleeping' : previousState
      const availableStates = states.filter(s => s !== state.current && s !== effectivePreviousState)
      
      // If no available states (shouldn't happen with 5 states, but just in case), 
      // filter out only current state
      const finalAvailableStates = availableStates.length > 0 
        ? availableStates 
        : states.filter(s => s !== state.current)
      
      // Ensure we have at least one available state
      if (finalAvailableStates.length === 0) {
        return // Shouldn't happen, but skip if no states available
      }
      
      // Pick random state from available ones
      const newState = finalAvailableStates[Math.floor(Math.random() * finalAvailableStates.length)]

      // Double check - should never be the same as current state
      if (newState === state.current) {
        return // Skip if somehow the same state was selected
      }

      const { error } = await supabase
        .from('global_cat_state')
        .update({
          current: newState,
          last_updated: now.toISOString()
        })
        .eq('id', 1)

      if (error) {
        console.error('Error updating cat state:', error)
        return
      }

      // Update previous state AFTER successful database update
      previousState = state.current

      await addLog(`System: Cat transitioning to state '${newState}'`)
      io.emit('cat-state-changed', { state: newState })
    } catch (error) {
      console.error('State machine error:', error)
    }
  }, 10000) // Check every 10 seconds
}

// Cleanup old cat logs (older than 1 hour)
async function cleanupOldLogs(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
    
    // Add timeout to prevent hanging requests
    let timeoutId: NodeJS.Timeout | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Cleanup request timeout')), 10000) // 10 second timeout
    })
    
    const deletePromise = Promise.resolve(supabase
      .from('cat_logs')
      .delete()
      .lt('timestamp', oneHourAgo.toISOString()))
      .then((result) => {
        if (timeoutId) clearTimeout(timeoutId)
        return result
      })

    try {
      const result = await Promise.race([deletePromise, timeoutPromise])
      const { error } = result as { error: any }

      if (error) {
        // Only log if it's not a network/fetch error (these are usually temporary)
        if (error.message && error.message.includes('fetch failed')) {
          console.warn(`[Cleanup] Temporary network issue at ${new Date().toISOString()} - will retry on next run`)
        } else {
          console.error('Error cleaning up old logs:', {
            message: error.message,
            details: error.details || error.toString(),
            hint: error.hint || '',
            code: error.code || ''
          })
        }
        return
      }

      console.log(`Cleaned up old cat logs (older than 1 hour) at ${new Date().toISOString()}`)
    } catch (raceError: any) {
      // This catches timeout errors from Promise.race
      if (timeoutId) clearTimeout(timeoutId)
      if (raceError.message && raceError.message.includes('timeout')) {
        console.warn(`[Cleanup] Request timeout at ${new Date().toISOString()} - will retry on next run`)
      } else {
        throw raceError // Re-throw if it's not a timeout
      }
    }
  } catch (error: any) {
    // Handle network and other errors gracefully
    if (error.message && error.message.includes('fetch failed')) {
      console.warn(`[Cleanup] Network error at ${new Date().toISOString()} - will retry on next run`)
    } else {
      console.error('Failed to cleanup old logs:', {
        message: error?.message || 'Unknown error',
        details: error?.details || error?.toString() || '',
        hint: error?.hint || '',
        code: error?.code || ''
      })
    }
  }
}

// Initialize cleanup job - runs every hour
function initializeCleanupJob(): void {
  // Run cleanup immediately on startup
  cleanupOldLogs()
  
  // Then run every hour
  cleanupInterval = setInterval(() => {
    cleanupOldLogs()
  }, 60 * 60 * 1000) // Every hour (60 minutes * 60 seconds * 1000 ms)
  
  console.log('Cat logs cleanup job initialized (runs every hour)')
}

// Socket.io connection handling
io.on('connection', (socket: Socket) => {

  // Send current state and logs on connection
  getCurrentCatState().then(async (state) => {
    if (state) {
      socket.emit('cat-state-changed', { state: state.current })
      if (state.is_resting) {
        socket.emit('cat-resting', {
          restUntil: state.rest_end_time,
          userName: state.rested_by_name
        })
      }
    }
    
    // Also send initial logs on connection
    try {
      const { data: logs, error } = await supabase
        .from('cat_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching logs on connection:', error)
        socket.emit('initial-logs', [])
        return
      }

      socket.emit('initial-logs', logs || [])
    } catch (error) {
      console.error('Exception sending initial logs on connection:', error)
      socket.emit('initial-logs', [])
    }
  })

  // Get current state
  socket.on('get-current-state', async () => {
    const state = await getCurrentCatState()
    if (state) {
      socket.emit('cat-state-changed', { state: state.current })
      if (state.is_resting) {
        socket.emit('cat-resting', {
          restUntil: state.rest_end_time,
          userName: state.rested_by_name
        })
      }
    }
  })

  // Activate REST
  socket.on('activate-rest', async (data: { userId: string; userName: string }) => {
    try {
      const state = await getCurrentCatState()
      if (!state) {
        socket.emit('rest-denied', { errorCode: 'cat.stateNotFound' })
        return
      }

      // Check if already resting
      if (state.is_resting) {
        socket.emit('rest-denied', { errorCode: 'cat.alreadySleeping' })
        await addLog(`${data.userName}: Attempted to put cat to sleep (DENIED - already sleeping)`)
        return
      }

      // Check if cat is in 'wake' state (transitional state after waking up)
      if (state.current === 'wake') {
        socket.emit('rest-denied', { errorCode: 'cat.stillWakingUp' })
        await addLog(`${data.userName}: Attempted to put cat to sleep (DENIED - still waking up)`)
        return
      }

      // Use transaction-like approach with SELECT FOR UPDATE
      const restEndTime = new Date(Date.now() + 1 * 60 * 1000) // 1 minute from now

      const { error } = await supabase
        .from('global_cat_state')
        .update({
          current: 'sleeping',
          is_resting: true,
          rest_end_time: restEndTime.toISOString(),
          rested_by: data.userId,
          rested_by_name: data.userName,
          last_updated: new Date().toISOString()
        })
        .eq('id', 1)
        .eq('is_resting', false) // Only update if not already resting (atomic check)

      if (error) {
        // Race condition - someone else activated REST
        socket.emit('rest-denied', { errorCode: 'cat.someoneElsePutToSleep' })
        await addLog(`${data.userName}: Attempted to put cat to sleep (DENIED - race condition)`)
        return
      }

      // Success - broadcast to all clients
      console.log(`😴 Cat put to sleep by: ${data.userName}`)
      await addLog(`${data.userName}: Put cat to sleep`)
      io.emit('cat-resting', {
        restUntil: restEndTime.toISOString(),
        userName: data.userName
      })
      io.emit('cat-state-changed', { state: 'sleeping' })
    } catch (error) {
      console.error('Activate REST error:', error)
      socket.emit('rest-denied', { errorCode: 'cat.errorPuttingToSleep' })
    }
  })

  // Get logs
  socket.on('get-logs', async (data: { limit?: number }) => {
    try {
      const limit = data.limit || 50
      const { data: logs, error } = await supabase
        .from('cat_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) throw error

      socket.emit('initial-logs', logs || [])
    } catch (error) {
      console.error('Get logs error:', error)
      socket.emit('initial-logs', [])
    }
  })

  socket.on('disconnect', () => {
    // Handle disconnect if needed
  })
  
  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 8080

httpServer.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  
  // Initialize state machine after server starts
  try {
    await initializeCatStateMachine()
    console.log('Cat state machine initialized successfully')
  } catch (error) {
    console.error('Failed to initialize cat state machine:', error)
  }
  
  // Initialize cleanup job
  initializeCleanupJob()
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...')
  if (stateMachineInterval) clearInterval(stateMachineInterval)
  if (cleanupInterval) clearInterval(cleanupInterval)
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...')
  if (stateMachineInterval) clearInterval(stateMachineInterval)
  if (cleanupInterval) clearInterval(cleanupInterval)
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export { io }

