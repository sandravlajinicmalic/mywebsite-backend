import express, { type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'
import { getUserDefaultAvatar } from '../utils/avatar.js'

const router = express.Router()

// Logging throttling removed - no longer needed since we removed active rewards logging

/**
 * Check if error is a connection/network error
 */
const isConnectionError = (error: any): boolean => {
  if (!error) return false
  
  // Check for fetch failed errors
  if (error.message?.includes('fetch failed')) return true
  if (error.cause?.code === 'ECONNREFUSED') return true
  if (error.cause?.code === 'ENOTFOUND') return true
  if (error.cause?.code === 'ETIMEDOUT') return true
  
  // Check error type
  if (error instanceof TypeError && error.message?.includes('fetch')) return true
  
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
    let activeRewards: any[] | null = null
    try {
      const { data, error: rewardError } = await supabase
        .from('user_active_rewards')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString()) // Only get non-expired rewards
        .order('created_at', { ascending: false })

      if (rewardError) {
        // If it's a connection error, log and continue with empty rewards
        if (isConnectionError(rewardError)) {
          console.error('❌ Supabase connection error when fetching active rewards:', {
            message: rewardError.message,
            userId,
            hint: 'No internet connection or Supabase is unreachable. Returning empty rewards.'
          })
          activeRewards = []
        } else {
          // For other errors, throw them
          throw rewardError
        }
      } else {
        activeRewards = data
      }
    } catch (error: any) {
      // Catch any connection errors that might not be caught above
      if (isConnectionError(error)) {
        console.error('❌ Supabase connection error when fetching active rewards:', {
          message: error.message,
          userId,
          hint: 'No internet connection or Supabase is unreachable. Returning empty rewards.'
        })
        activeRewards = []
      } else {
        throw error
      }
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
      
      // Log active rewards removed to reduce console noise
      // (throttled logging was still too frequent due to multiple component calls)
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
    let activeReward: any = null
    try {
      const { data, error: rewardError } = await supabase
        .from('user_active_rewards')
        .select('*')
        .eq('user_id', userId)
        .eq('reward_type', 'avatar')
        .gt('expires_at', new Date().toISOString()) // Only get non-expired rewards
        .single()

      if (rewardError) {
        // PGRST116 means no rows found, which is fine
        if (rewardError.code === 'PGRST116') {
          activeReward = null
        } else if (isConnectionError(rewardError)) {
          // Connection error - log and continue with default avatar
          console.error('❌ Supabase connection error when fetching active avatar:', {
            message: rewardError.message,
            userId,
            hint: 'No internet connection or Supabase is unreachable. Returning default avatar.'
          })
          activeReward = null
        } else {
          // For other errors, throw them
          throw rewardError
        }
      } else {
        activeReward = data
      }
    } catch (error: any) {
      // Catch any connection errors that might not be caught above
      if (isConnectionError(error)) {
        console.error('❌ Supabase connection error when fetching active avatar:', {
          message: error.message,
          userId,
          hint: 'No internet connection or Supabase is unreachable. Returning default avatar.'
        })
        activeReward = null
      } else {
        throw error
      }
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

      // Log active avatar reward removed to reduce console noise

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
    try {
      const { error } = await supabase
        .from('user_active_rewards')
        .delete()
        .eq('user_id', userId)
        .lt('expires_at', new Date().toISOString())

      if (error) {
        // If it's a connection error, log and return success (cleanup can wait)
        if (isConnectionError(error)) {
          console.error('❌ Supabase connection error when cleaning up expired rewards:', {
            message: error.message,
            userId,
            hint: 'No internet connection. Cleanup will be retried later.'
          })
          res.json({
            success: true,
            message: 'Cleanup skipped due to connection issue. Will retry when connection is restored.'
          })
          return
        }
        throw error
      }

      res.json({
        success: true,
        message: 'Expired rewards cleaned up'
      })
    } catch (error: any) {
      // Catch any connection errors that might not be caught above
      if (isConnectionError(error)) {
        console.error('❌ Supabase connection error when cleaning up expired rewards:', {
          message: error.message,
          userId,
          hint: 'No internet connection. Cleanup will be retried later.'
        })
        res.json({
          success: true,
          message: 'Cleanup skipped due to connection issue. Will retry when connection is restored.'
        })
        return
      }
      throw error
    }
  } catch (error) {
    next(error)
  }
})

export default router
