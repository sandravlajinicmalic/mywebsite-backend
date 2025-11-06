import express, { type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'

const router = express.Router()

interface ContactRequestBody {
  name: string
  email: string
  message: string
  subject?: string
}

// Submit contact form
router.post('/submit', async (req: Request<{}, {}, ContactRequestBody>, res: Response, next: NextFunction) => {
  try {
    const { name, email, message, subject } = req.body

    if (!name || !email || !message) {
      res.status(400).json({ 
        error: 'Ime, email i poruka su obavezni' 
      })
      return
    }

    // Validacija email formata
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        error: 'Nevažeći format email adrese' 
      })
      return
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
router.get('/messages', async (_req: Request, res: Response, next: NextFunction) => {
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

