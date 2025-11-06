import express from 'express'
import { supabase } from '../config/supabase.js'

const router = express.Router()

// Submit contact form
router.post('/submit', async (req, res, next) => {
  try {
    const { name, email, message, subject } = req.body

    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Ime, email i poruka su obavezni' 
      })
    }

    // Validacija email formata
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Nevažeći format email adrese' 
      })
    }

    // Spremi poruku u bazu
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([
        {
          name,
          email,
          subject: subject || 'Nema naslova',
          message,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    res.json({
      success: true,
      message: 'Poruka je uspješno poslana!',
      data
    })
  } catch (error) {
    next(error)
  }
})

// Get all contact messages (za admin panel, opcionalno)
router.get('/messages', async (req, res, next) => {
  try {
    // TODO: Dodati autentifikaciju za admin pristup
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({
      success: true,
      messages: data
    })
  } catch (error) {
    next(error)
  }
})

export default router

