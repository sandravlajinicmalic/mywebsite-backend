import express, { type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { getUserDefaultAvatar } from '../utils/avatar.js'

const router = express.Router()

// Cache for tracking last log time per user (to throttle logging to once per minute)
const lastLogTime = new Map<string, number>()
const LOG_THROTTLE_MS = 60 * 1000 // 1 minute

/**
 * Check if we should log for this user (throttle to once per minute)
 */
const shouldLog = (userId: string): boolean => {
  const now = Date.now()
  const lastLog = lastLogTime.get(userId)
  
  if (!lastLog || (now - lastLog) >= LOG_THROTTLE_MS) {
    lastLogTime.set(userId, now)
    return true
  }
  
  return false
}

/**
 * Get user data and default avatar (helper function to avoid duplication)
 */
const getUserDataAndAvatar = async (userId: string) => {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, nickname')
      .eq('id', userId)
      .single()

    if (userError) {
      // Enhanced error logging
      console.error('❌ Supabase query error:', {
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
        userId
      })
      throw userError
    }

    const defaultAvatar = getUserDefaultAvatar(userData.id, userData.nickname)
    return { userData, defaultAvatar }
  } catch (error: any) {
    // Catch network/connection errors
    if (error.message?.includes('fetch failed') || error.cause?.code === 'ECONNREFUSED') {
      console.error('❌ Supabase connection error:', {
        message: error.message,
        cause: error.cause,
        hint: 'Check if SUPABASE_URL is correct and Supabase project is active'
      })
      throw new Error('Failed to connect to Supabase. Please check your SUPABASE_URL and ensure the project is active.')
    }
    throw error
  }
}

// Get all active rewards for current user
router.get('/active-rewards', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'User is not authenticated' })
      return
    }

    // Get user info for default avatar calculation
    let defaultAvatar: string
    try {
      const userData = await getUserDataAndAvatar(userId)
      defaultAvatar = userData.defaultAvatar
    } catch (error: any) {
      console.error('Error getting user data for avatar:', error)
      // Fallback to a default avatar if we can't get user data
      defaultAvatar = '/images/user-profile-icons/cat1.svg'
    }

    // Get all active rewards (non-expired)
    const { data: activeRewards, error: rewardError } = await supabase
      .from('user_active_rewards')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString()) // Only get non-expired rewards
      .order('created_at', { ascending: false })

    if (rewardError) {
      throw rewardError
    }

    // Parse rewards and build response
    const rewards: Record<string, any> = {}
    
    if (activeRewards && activeRewards.length > 0) {
      for (const reward of activeRewards) {
        try {
          const rewardData = JSON.parse(reward.reward_value)
          rewards[reward.reward_type] = {
            value: rewardData,
            expiresAt: reward.expires_at,
            createdAt: reward.created_at
          }
        } catch {
          // If parsing fails, use reward_value directly
          rewards[reward.reward_type] = {
            value: reward.reward_value,
            expiresAt: reward.expires_at,
            createdAt: reward.created_at
          }
        }
      }
      
      // Log active rewards (throttled to once per minute per user)
      const activeRewardTypes = Object.keys(rewards)
      if (activeRewardTypes.length > 0 && shouldLog(userId)) {
        console.log('✅ Active rewards:', {
          userId,
          rewardTypes: activeRewardTypes,
          rewards: activeRewardTypes.reduce((acc, type) => {
            acc[type] = {
              expiresAt: rewards[type].expiresAt,
              createdAt: rewards[type].createdAt
            }
            return acc
          }, {} as Record<string, any>)
        })
      }
    }

    // Always include avatar (either active or default)
    if (!rewards.avatar) {
      rewards.avatar = {
        value: { avatar: defaultAvatar },
        expiresAt: null,
        createdAt: null
      }
    } else {
      // Ensure avatar has originalAvatar field
      if (!rewards.avatar.value.originalAvatar) {
        rewards.avatar.value.originalAvatar = defaultAvatar
      }
    }

    res.json({
      success: true,
      rewards: rewards
    })
  } catch (error) {
    next(error)
  }
})

// Get active avatar specifically (for backward compatibility)
router.get('/active-avatar', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'User is not authenticated' })
      return
    }

    // Get user info for default avatar calculation
    let defaultAvatar: string
    try {
      const userData = await getUserDataAndAvatar(userId)
      defaultAvatar = userData.defaultAvatar
    } catch (error: any) {
      console.error('Error getting user data for avatar:', error)
      // Fallback to a default avatar if we can't get user data
      defaultAvatar = '/images/user-profile-icons/cat1.svg'
    }

    // Check for active avatar reward
    const { data: activeReward, error: rewardError } = await supabase
      .from('user_active_rewards')
      .select('*')
      .eq('user_id', userId)
      .eq('reward_type', 'avatar')
      .gt('expires_at', new Date().toISOString()) // Only get non-expired rewards
      .single()

    if (rewardError && rewardError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      throw rewardError
    }

    if (activeReward) {
      // Parse reward_value (should be JSON string with avatar path)
      let avatarPath = defaultAvatar
      try {
        const rewardData = JSON.parse(activeReward.reward_value)
        avatarPath = rewardData.avatar || defaultAvatar
      } catch {
        // If parsing fails, use reward_value directly as avatar path
        avatarPath = activeReward.reward_value || defaultAvatar
      }

      // Log active avatar reward (throttled to once per minute per user)
      if (shouldLog(userId)) {
        console.log('✅ Active avatar reward:', {
          userId,
          avatar: avatarPath,
          originalAvatar: defaultAvatar,
          expiresAt: activeReward.expires_at
        })
      }

      res.json({
        success: true,
        avatar: avatarPath,
        isTemporary: true,
        expiresAt: activeReward.expires_at,
        originalAvatar: defaultAvatar
      })
    } else {
      // No active reward, return default avatar
      res.json({
        success: true,
        avatar: defaultAvatar,
        isTemporary: false,
        expiresAt: null,
        originalAvatar: defaultAvatar
      })
    }
  } catch (error) {
    next(error)
  }
})

// Cleanup expired rewards (can be called periodically)
router.post('/cleanup-expired-rewards', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({ error: 'User is not authenticated' })
      return
    }

    // Delete expired rewards for this user
    const { error } = await supabase
      .from('user_active_rewards')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())

    if (error) throw error

    res.json({
      success: true,
      message: 'Expired rewards cleaned up'
    })
  } catch (error) {
    next(error)
  }
})

export default router
