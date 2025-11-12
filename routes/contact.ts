import express, { type Request, type Response, type NextFunction } from 'express'
import { supabase } from '../config/supabase.js'

const router = express.Router()

interface ContactRequestBody {
  name: string
  email: string
  message: string
  subject?: string
}

interface ValidationError {
  field: string
  message: string
}

/**
 * Validation for disallowed characters and potentially dangerous patterns
 * Blocks SQL injection, XSS and other dangerous characters
 */
function validateInput(fieldName: string, value: string): ValidationError | null {
  if (!value || typeof value !== 'string') {
    return null
  }

  // Dangerous characters and patterns for SQL injection
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(['";\\])/g,
    /(--|\/\*|\*\/|;)/g,
  ]

  // Dangerous patterns for XSS
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick=, onerror=, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi,
  ]

  // Check for SQL injection patterns
  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(value)) {
      return {
        field: fieldName,
        message: `Please remove special characters like quotes, semicolons, or SQL keywords.`
      }
    }
  }

  // Check for XSS patterns
  for (const pattern of xssPatterns) {
    if (pattern.test(value)) {
      return {
        field: fieldName,
        message: `Please remove HTML tags and JavaScript code.`
      }
    }
  }

  // Check for control characters (except newline and tab which are allowed in messages)
  const controlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g
  if (controlChars.test(value)) {
    return {
      field: fieldName,
      message: `Please use only standard text characters.`
    }
  }

  return null
}

// Submit contact form
router.post('/submit', async (req: Request<{}, {}, ContactRequestBody>, res: Response, next: NextFunction) => {
  try {
    const { name, email, message, subject } = req.body

    if (!name || !email || !message) {
      res.status(400).json({ 
        error: 'Name, email and message are required',
        field: 'general'
      })
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        error: 'Invalid email format',
        field: 'email'
      })
      return
    }

    // Validation for disallowed characters
    const validationErrors: ValidationError[] = []
    
    const nameError = validateInput('name', name)
    if (nameError) validationErrors.push(nameError)
    
    const emailError = validateInput('email', email)
    if (emailError) validationErrors.push(emailError)
    
    const messageError = validateInput('message', message)
    if (messageError) validationErrors.push(messageError)
    
    if (subject) {
      const subjectError = validateInput('subject', subject)
      if (subjectError) validationErrors.push(subjectError)
    }

    if (validationErrors.length > 0) {
      // Return the first error with field information
      const firstError = validationErrors[0]
      res.status(400).json({
        error: firstError.message,
        field: firstError.field
      })
      return
    }

    // Save message to database
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([
        {
          name,
          email,
          subject: subject || 'No subject',
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
      message: 'Message sent successfully!',
      data
    })
  } catch (error) {
    next(error)
  }
})

// Get all contact messages (for admin panel, optional)
router.get('/messages', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Add authentication for admin access
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

