import express from 'express'
import { supabase } from '../config/supabase.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

// Login/Register endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { email, nickname } = req.body

    if (!email || !nickname) {
      return res.status(400).json({ 
        error: 'Email i nickname su obavezni' 
      })
    }

    // Provjeri da li korisnik već postoji
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    let user

    if (existingUser) {
      // Ažuriraj nickname ako je promijenjen
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ nickname })
        .eq('email', email)
        .select()
        .single()

      if (updateError) throw updateError
      user = updatedUser
    } else {
      // Kreiraj novog korisnika
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ email, nickname }])
        .select()
        .single()

      if (insertError) throw insertError
      user = newUser
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
router.get('/verify', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Token nije pronađen' })
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    )

    // Dohvati korisnika iz baze
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Korisnik nije pronađen' })
    }

    res.json({ success: true, user })
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Nevažeći token' })
    }
    next(error)
  }
})

export default router

