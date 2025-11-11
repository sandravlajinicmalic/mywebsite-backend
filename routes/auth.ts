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

    // Validacija email formata
    if (!email) {
      errors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        errors.email = 'Invalid email format'
      }
    }

    // Validacija nickname - dozvoljeni su samo slova, brojevi, underscore i dash
    if (!nickname) {
      errors.nickname = 'Nickname is required'
    } else {
      // Nickname ne smije sadržavati specijalne znakove osim underscore i dash
      const nicknameRegex = /^[a-zA-Z0-9_-]+$/
      if (!nicknameRegex.test(nickname)) {
        errors.nickname = 'Nickname can only contain letters, numbers, underscore (_) and dash (-)'
      }
    }

    // Ako ima grešaka, vrati ih
    if (Object.keys(errors).length > 0) {
      res.status(400).json({ 
        error: 'Validation failed',
        errors 
      })
      return
    }

    // Provjeri da li korisnik već postoji
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    let user: User

    if (existingUser) {
      // Ažuriraj nickname ako je promijenjen
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ nickname })
        .eq('email', email)
        .select()
        .single()

      if (updateError) throw updateError
      user = updatedUser as User
    } else {
      // Kreiraj novog korisnika
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email, nickname }])
        .select()
        .single()

      if (insertError) throw insertError
      user = newUser as User

      // Pošalji welcome email novom korisniku (asinhrono, ne blokira response)
      emailService.sendWelcomeEmail(email, nickname).catch((error) => {
        console.error('Failed to send welcome email:', error)
        // Ne baci error - login je uspješan čak i ako email ne uspije
      })
    }

    // Generiši JWT token
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

    // Dohvati korisnika iz baze
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

// Delete account endpoint
router.delete('/delete', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' })
      return
    }

    const userId = req.user.userId

    // Dohvati korisnika da dobijemo nickname za email
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('id', userId)
      .single()

    if (fetchError || !user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Obriši korisnika iz baze
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      res.status(500).json({ error: 'Failed to delete account' })
      return
    }

    // Pošalji delete account email (asinhrono, ne blokira response)
    emailService.sendDeleteAccountEmail(user.email, user.nickname).catch((error) => {
      console.error('Failed to send delete account email:', error)
      // Ne baci error - delete je uspješan čak i ako email ne uspije
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

