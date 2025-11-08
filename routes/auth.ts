import express, { type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'
import jwt from 'jsonwebtoken'

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

    if (!email || !nickname) {
      res.status(400).json({ 
        error: 'Email and nickname are required' 
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

export default router

