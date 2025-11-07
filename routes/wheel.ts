import express, { type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = express.Router()

interface SpinRequestBody {
  reward: string
}

interface WheelSpin {
  id: string
  user_id: string
  reward: string
  created_at: string
}

// Spin wheel endpoint - saves reward and checks cooldown (2 minutes)
router.post('/spin', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reward } = req.body as SpinRequestBody
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'Korisnik nije autentifikovan' })
      return
    }

    if (!reward || typeof reward !== 'string') {
      res.status(400).json({ error: 'Nagrada je obavezna' })
      return
    }

    // Check last spin time - cooldown is 2 minutes
    const { data: lastSpin, error: lastSpinError } = await supabase
      .from('wheel_spins')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastSpinError && lastSpinError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine for first spin
      throw lastSpinError
    }

    if (lastSpin) {
      const lastSpinTime = new Date(lastSpin.created_at)
      const now = new Date()
      const timeDiff = now.getTime() - lastSpinTime.getTime()
      const cooldownMs = 2 * 60 * 1000 // 2 minutes in milliseconds
      const remainingMs = cooldownMs - timeDiff

      if (remainingMs > 0) {
        const remainingSeconds = Math.ceil(remainingMs / 1000)
        res.status(429).json({ 
          error: 'Morate sačekati pre sljedećeg spina',
          cooldownSeconds: remainingSeconds,
          canSpin: false
        })
        return
      }
    }

    // Save the spin
    const { data: newSpin, error: insertError } = await supabase
      .from('wheel_spins')
      .insert([
        {
          user_id: userId,
          reward: reward
        }
      ])
      .select()
      .single()

    if (insertError) throw insertError

    res.json({
      success: true,
      spin: newSpin as WheelSpin,
      canSpin: false,
      cooldownSeconds: 120 // 2 minutes
    })
  } catch (error) {
    next(error)
  }
})

// Get spin history for current user
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'Korisnik nije autentifikovan' })
      return
    }

    const { data: spins, error } = await supabase
      .from('wheel_spins')
      .select('id, reward, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50) // Last 50 spins

    if (error) throw error

    res.json({
      success: true,
      spins: spins || []
    })
  } catch (error) {
    next(error)
  }
})

// Check if user can spin (get cooldown status)
router.get('/can-spin', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'Korisnik nije autentifikovan' })
      return
    }

    // Check last spin time
    const { data: lastSpin, error: lastSpinError } = await supabase
      .from('wheel_spins')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastSpinError && lastSpinError.code !== 'PGRST116') {
      throw lastSpinError
    }

    if (!lastSpin) {
      res.json({
        canSpin: true,
        cooldownSeconds: 0
      })
      return
    }

    const lastSpinTime = new Date(lastSpin.created_at)
    const now = new Date()
    const timeDiff = now.getTime() - lastSpinTime.getTime()
    const cooldownMs = 2 * 60 * 1000 // 2 minutes
    const remainingMs = cooldownMs - timeDiff

    if (remainingMs > 0) {
      const remainingSeconds = Math.ceil(remainingMs / 1000)
      res.json({
        canSpin: false,
        cooldownSeconds: remainingSeconds
      })
    } else {
      res.json({
        canSpin: true,
        cooldownSeconds: 0
      })
    }
  } catch (error) {
    next(error)
  }
})

export default router

