import express, { type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { getUserDefaultAvatar, getRandomAvatar } from '../utils/avatar.js'

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

const COOLDOWN_MS = 30 * 1000 // 30 seconds
const REWARD_DURATION_MS = 30 * 1000 // 30 seconds

// Helper function to create an active reward
// Note: This will delete all existing active rewards for the user before creating the new one
// (only one active reward can exist at a time)
const createActiveReward = async (
  userId: string,
  rewardType: string,
  rewardValue: any,
  durationMs: number = REWARD_DURATION_MS
): Promise<void> => {
  // Delete all existing active rewards for this user (only one active reward at a time)
  const { error: deleteError } = await supabase
    .from('user_active_rewards')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error(`❌ Error deleting existing rewards for user ${userId}:`, deleteError)
    throw deleteError
  }

  // Create the new reward
  const expiresAt = new Date(Date.now() + durationMs).toISOString()
  const rewardValueStr = JSON.stringify(rewardValue)

  const { error } = await supabase
    .from('user_active_rewards')
    .insert({
      user_id: userId,
      reward_type: rewardType,
      reward_value: rewardValueStr,
      expires_at: expiresAt
    })

  if (error) {
    console.error(`❌ Error creating ${rewardType} reward:`, error)
    throw error
  }
}

// Helper function to check cooldown
const checkCooldown = async (userId: string): Promise<{ canSpin: boolean; remainingMs: number }> => {
  const { data: lastSpin, error } = await supabase
    .from('wheel_spins')
    .select('created_at, reward')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (!lastSpin) {
    return { canSpin: true, remainingMs: 0 }
  }

  // Skip cooldown if last spin was "Spin Again, Brave Soul"
  if (lastSpin.reward === 'Spin Again, Brave Soul') {
    return { canSpin: true, remainingMs: 0 }
  }

  const lastSpinTime = new Date(lastSpin.created_at)
  const now = new Date()
  const timeDiff = now.getTime() - lastSpinTime.getTime()
  const remainingMs = COOLDOWN_MS - timeDiff

  return {
    canSpin: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs)
  }
}

// Spin wheel endpoint - saves reward and checks cooldown (2 minutes)
router.post('/spin', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reward } = req.body as SpinRequestBody
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'User is not authenticated' })
      return
    }

    if (!reward || typeof reward !== 'string') {
      res.status(400).json({ error: 'Reward is required' })
      return
    }

    // Check cooldown
    const { canSpin, remainingMs } = await checkCooldown(userId)
    
    if (!canSpin) {
      const remainingSeconds = Math.ceil(remainingMs / 1000)
      res.status(429).json({ 
        error: 'You must wait before the next spin',
        cooldownSeconds: remainingSeconds,
        canSpin: false
      })
      return
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

    // Get user info for logging
    const { data: userData } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', userId)
      .single()

    const userName = userData?.nickname || userId
    console.log(`🎁 Reward received: ${userName} won "${reward}"`)

    // Handle rewards that create active effects
    try {
      const rewardHandlers: Record<string, () => Promise<void>> = {
        'New Me, Who Dis?': async () => {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, nickname')
            .eq('id', userId)
            .single()

          if (!userError && userData) {
            const defaultAvatar = getUserDefaultAvatar(userData.id, userData.nickname)
            const newAvatar = getRandomAvatar(defaultAvatar)
            
            await createActiveReward(userId, 'avatar', {
              avatar: newAvatar,
              originalAvatar: defaultAvatar
            })
          }
        },
        'Fancy Schmancy Nickname': async () => {
          await createActiveReward(userId, 'nickname', { style: 'cursive', fontSize: '1.5' })
        },
        'Royal Meowjesty': async () => {
          await createActiveReward(userId, 'nickname', { prefix: 'Royal Meowjesty' })
        },
        'Chase the Yarn!': async () => {
          await createActiveReward(userId, 'yarn', { enabled: true })
        },
        'Paw-some Cursor': async () => {
          await createActiveReward(userId, 'cursor', { cursor: '/images/paw.png' })
        },
        'Color Catastrophe': async () => {
          await createActiveReward(userId, 'color', { enabled: true, swap: 'pink-blue' })
        },
        'Spin Again, Brave Soul': async () => {
          // User can spin immediately again
        },
        'Total Cat-astrophe': async () => {
          // User got nothing
        }
      }

      const handler = rewardHandlers[reward]
      if (handler) {
        await handler()
      }
    } catch (error) {
      // Don't fail the spin if reward handling fails
      console.error(`Error handling reward "${reward}":`, error)
    }

    // Determine if user can spin again based on reward
    const canSpinAgain = reward === 'Spin Again, Brave Soul'

    res.json({
      success: true,
      spin: newSpin as WheelSpin,
      canSpin: canSpinAgain,
      cooldownSeconds: canSpinAgain ? 0 : 30 // 30 seconds, or 0 if Spin Again
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
      res.status(401).json({ error: 'User is not authenticated' })
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
      res.status(401).json({ error: 'User is not authenticated' })
      return
    }

    const { canSpin, remainingMs } = await checkCooldown(userId)
    const remainingSeconds = canSpin ? 0 : Math.ceil(remainingMs / 1000)
    
    res.json({
      canSpin,
      cooldownSeconds: remainingSeconds
    })
  } catch (error) {
    next(error)
  }
})

export default router

