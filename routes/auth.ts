import express, { type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import jwt from 'jsonwebtoken'
import { emailService } from '../services/email.js'
import { authenticateToken, type AuthRequest } from '../middleware/auth.js'

const router = express.Router()

interface LoginRequestBody {
  email: string
  nickname: string
}

interface User {
  id: string
  email: string
  nickname: string
}

interface JwtPayload {
  userId: string
  email: string
}

// Login/Register endpoint
router.post('/login', async (req: Request<{}, {}, LoginRequestBody>, res: Response, next: NextFunction) => {
  try {
    const { email, nickname } = req.body

    const errors: { email?: string; nickname?: string } = {}

    // Email format validation
    if (!email) {
      errors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        errors.email = 'Invalid email format'
      }
    }

    // Nickname validation - only letters, numbers, underscore and dash are allowed
    if (!nickname) {
      errors.nickname = 'Nickname is required'
    } else {
      // Nickname must not contain special characters except underscore and dash
      const nicknameRegex = /^[a-zA-Z0-9_-]+$/
      if (!nicknameRegex.test(nickname)) {
        errors.nickname = 'Nickname can only contain letters, numbers, underscore (_) and dash (-)'
      }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ 
        error: 'Validation failed',
        errors 
      })
      return
    }

    // Check if user already exists with this email
    const { data: existingUserByEmail, error: emailError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (emailError) throw emailError

    // Check if user already exists with this nickname
    const { data: existingUserByNickname, error: nicknameError } = await supabase
      .from('users')
      .select('*')
      .eq('nickname', nickname)
      .maybeSingle()

    if (nicknameError) throw nicknameError

    // Check if there is a mismatch or attempt to create with existing data
    if (existingUserByEmail && existingUserByNickname) {
      // Both exist, but check if they are the same user
      if (existingUserByEmail.id !== existingUserByNickname.id) {
        // Different users - email and nickname do not match
        res.status(400).json({
          error: 'Email and nickname do not match',
          errors: {
            email: 'This email is already registered with a different nickname',
            nickname: 'This nickname is already registered with a different email'
          }
        })
        return
      }
      // Same user - continue with login
    } else if (existingUserByEmail && !existingUserByNickname) {
      // Email exists, but nickname does not - attempt to login with wrong nickname
      res.status(400).json({
        error: 'Nickname does not match email',
        errors: {
          nickname: 'This nickname does not match the email address'
        }
      })
      return
    } else if (!existingUserByEmail && existingUserByNickname) {
      // Nickname exists, but email does not - attempt to create new user with taken nickname
      res.status(400).json({
        error: 'Nickname already exists',
        errors: {
          nickname: 'This nickname is already taken'
        }
      })
      return
    }

    let user: User

    if (existingUserByEmail) {
      // User exists - update nickname if it has changed
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ nickname })
        .eq('email', email)
        .select()
        .single()

      if (updateError) throw updateError
      user = updatedUser as User
    } else {
      // Create new user - check if email or nickname already exist
      // (This should already be checked above, but we add an additional check for security)
      if (existingUserByEmail) {
        res.status(400).json({
          error: 'Email already exists',
          errors: {
            email: 'This email is already taken'
          }
        })
        return
      }
      
      if (existingUserByNickname) {
        res.status(400).json({
          error: 'Nickname already exists',
          errors: {
            nickname: 'This nickname is already taken'
          }
        })
        return
      }

      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email, nickname }])
        .select()
        .single()

      if (insertError) throw insertError
      user = newUser as User

      // Send welcome email to new user (asynchronously, does not block response)
      emailService.sendWelcomeEmail(email, nickname).catch((error) => {
        console.error('Failed to send welcome email:', error)
        // Don't throw error - login is successful even if email fails
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname
      },
      token
    })
  } catch (error) {
    next(error)
  }
})

// Verify token endpoint
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ error: 'Token not found' })
      return
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    ) as JwtPayload

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    res.json({ success: true, user })
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    next(error)
  }
})

// Forgot nickname endpoint
router.post('/forgot-nickname', async (req: Request<{}, {}, { email: string }>, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body

    // Email format validation
    if (!email) {
      res.status(400).json({ 
        error: 'Email is required'
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        error: 'Invalid email format'
      })
      return
    }

    // Check if user exists with this email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user:', userError)
      res.status(500).json({
        success: false,
        error: 'An error occurred while checking your email. Please try again.'
      })
      return
    }

    // If user does not exist, return message
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'No account found with this email address'
      })
      return
    }

    // User exists - send email with nickname
    emailService.sendForgotNicknameEmail(user.email, user.nickname).catch((error) => {
      console.error('Failed to send forgot nickname email:', error)
      // Don't throw error - response is already sent
    })

    // Return success message
    res.json({
      success: true,
      message: 'We have sent your nickname to your email address'
    })
  } catch (error) {
    next(error)
  }
})

// Delete account endpoint
router.delete('/delete', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const userId = req.user.userId

    // Get user to retrieve nickname for email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Delete user from database
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      res.status(500).json({ error: 'Failed to delete account' })
      return
    }

    // Send delete account email (asynchronously, does not block response)
    emailService.sendDeleteAccountEmail(user.email, user.nickname).catch((error) => {
      console.error('Failed to send delete account email:', error)
      // Don't throw error - delete is successful even if email fails
    })

    res.json({
      success: true,
      message: 'Account deleted successfully'
    })
  } catch (error) {
    next(error)
  }
})

export default router

