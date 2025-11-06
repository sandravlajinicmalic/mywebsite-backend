import express, { type Express, type Request, type Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createServer, type Server as HttpServer } from 'http'
import { Server, type Socket } from 'socket.io'
import authRoutes from './routes/auth.js'
import contactRoutes from './routes/contact.js'
import { errorHandler } from './middleware/errorHandler.js'

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

// Socket.io connection handling
io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id)

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })

  // Example: Handle custom events here
  socket.on('message', (data: unknown) => {
    console.log('Message received:', data)
    // Broadcast to all clients
    io.emit('message', data)
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 3000

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

export { io }

