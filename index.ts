import express, { type Express, type Request, type Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer, type Server as HttpServer } from 'http'
import { Server, type Socket } from 'socket.io'
import authRoutes from './routes/auth.js'
import contactRoutes from './routes/contact.js'
import catRoutes, { getCurrentCatState, addLog } from './routes/cat.js'
import { errorHandler } from './middleware/errorHandler.js'
import { supabase } from './config/supabase.js'

// Load environment variables
dotenv.config()

const app: Express = express()
const httpServer: HttpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/cat', catRoutes)

// Cat State Machine - runs 24/7
let stateMachineInterval: NodeJS.Timeout | null = null

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
      console.log('Initializing cat state...')
      const { data: newState, error: insertError } = await supabase
        .from('global_cat_state')
        .insert([
          {
            id: 1,
            current: 'ziva',
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

      console.log('Cat state created:', newState)
      await addLog('Sistem: Mačka je inicijalizovana')
    } else if (selectError) {
      console.error('Error checking cat state:', selectError)
      throw selectError
    } else {
      console.log('Cat state already exists:', existingState)
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
          // REST period ended
          await supabase
            .from('global_cat_state')
            .update({
              current: 'ziva',
              is_resting: false,
              rest_end_time: null,
              rested_by: null,
              rested_by_name: null,
              last_updated: now.toISOString()
            })
            .eq('id', 1)

          await addLog('Sistem: Mačka se probudila')
          io.emit('cat-state-changed', { state: 'ziva' })
        }
        // If REST is still active, don't change state
        return
      }

      // Change state every 10 seconds (only if not resting)
      // Exclude 'mrtva' state (only for REST)
      const states: Array<'ziva' | 'igra_se' | 'dosadno' | 'angry'> = ['ziva', 'igra_se', 'dosadno', 'angry']
      
      // Filter out current state to ensure it changes
      const availableStates = states.filter(s => s !== state.current)
      const newState = availableStates.length > 0 
        ? availableStates[Math.floor(Math.random() * availableStates.length)]
        : states[Math.floor(Math.random() * states.length)]

      await supabase
        .from('global_cat_state')
        .update({
          current: newState,
          last_updated: now.toISOString()
        })
        .eq('id', 1)

      await addLog(`Sistem: Mačka prelazi u stanje '${newState}'`)
      io.emit('cat-state-changed', { state: newState })
    } catch (error) {
      console.error('State machine error:', error)
    }
  }, 10000) // Check every 10 seconds
}

// Socket.io connection handling
io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id)

  // Send current state on connection
  getCurrentCatState().then((state) => {
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
        socket.emit('rest-denied', { message: 'Cat state not found' })
        return
      }

      // Check if already resting
      if (state.is_resting) {
        socket.emit('rest-denied', { message: 'REST je već aktivan' })
        await addLog(`${data.userName}: Pokušao aktivirati REST (ODBIJENO - već aktivan)`)
        return
      }

      // Use transaction-like approach with SELECT FOR UPDATE
      const restEndTime = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

      const { error } = await supabase
        .from('global_cat_state')
        .update({
          current: 'mrtva',
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
        socket.emit('rest-denied', { message: 'Neko drugi je već aktivirao REST!' })
        await addLog(`${data.userName}: Pokušao aktivirati REST (ODBIJENO - race condition)`)
        return
      }

      // Success - broadcast to all clients
      await addLog(`${data.userName}: Aktivirao REST`)
      io.emit('cat-resting', {
        restUntil: restEndTime.toISOString(),
        userName: data.userName
      })
      io.emit('cat-state-changed', { state: 'mrtva' })
    } catch (error) {
      console.error('Activate REST error:', error)
      socket.emit('rest-denied', { message: 'Greška pri aktivaciji REST-a' })
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
    console.log('User disconnected:', socket.id)
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 3000

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
})

export { io }

