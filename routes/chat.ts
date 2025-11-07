import express, { type Request, type Response } from 'express'
import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

// System prompt that restricts the chatbot to only talk about cats
const CAT_SYSTEM_PROMPT = `Ti si prijateljski AI asistent koji razgovara SAMO o mačkama. 
Tvoja uloga je da pomažeš ljudima da saznaju više o mačkama, njihovom ponašanju, zdravlju, negi, rasama, ishrani, i svemu što se tiče mačaka.

VAŽNO:
- Ako te neko pita o nečemu što NIJE vezano za mačke, ljubazno odgovori da možeš da razgovaraš samo o mačkama i preusmeri razgovor na temu mačaka.
- Budi prijateljski, informativan i entuzijastičan kada pričaš o mačkama.
- Odgovaraj na srpskom jeziku.
- Koristi emoji-je vezane za mačke (😸, 🐱, 😺, 🐾) kada je prikladno.
- Budi konkretan i informativan u svojim odgovorima.
- NIKADA ne generiši kod, slike, fajlove, ili bilo šta što nije običan tekst.
- Tvoji odgovori moraju biti SAMO tekstualni - bez kod blokova, bez markdown formata za kod, bez slika, bez fajlova.
- Ako te neko pita da generišeš kod, sliku, ili bilo šta što nije tekst, ljubazno odgovori da možeš da daješ samo tekstualne odgovore o mačkama.`

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Store conversation history (in production, you'd use a database)
const conversationHistory = new Map<string, ChatMessage[]>()

// Helper function to sanitize message - allow only text characters
function sanitizeMessage(message: string): string {
  // Allow only letters, numbers, spaces, and basic punctuation
  return message.replace(/[^\p{L}\p{N}\s.,!?;:'"()-]/gu, '')
}

// Helper function to check if message contains only text
function isTextOnly(message: string): boolean {
  // Check if message contains only allowed characters
  const sanitized = sanitizeMessage(message)
  return sanitized === message
}

// Helper function to check if message is requesting code, images, or non-text content
function isRequestingNonText(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  
  const nonTextKeywords = [
    // Code generation
    'generiši kod', 'generisi kod', 'napiši kod', 'napisi kod', 'napravi kod', 'kreiraj kod',
    'write code', 'generate code', 'create code', 'make code', 'code example',
    'javascript', 'python', 'html', 'css', 'react', 'vue', 'angular', 'node', 'sql',
    'function', 'class', 'import', 'export', 'const', 'let', 'var',
    // Image generation
    'generiši sliku', 'generisi sliku', 'napravi sliku', 'kreiraj sliku', 'nacrtaj sliku',
    'generate image', 'create image', 'make image', 'draw image', 'picture',
    'dall-e', 'midjourney', 'stable diffusion',
    // File generation
    'generiši fajl', 'generisi fajl', 'napravi fajl', 'kreiraj fajl',
    'generate file', 'create file', 'make file',
    // Other non-text requests
    'json', 'xml', 'yaml', 'markdown', '```', 'code block'
  ]
  
  return nonTextKeywords.some(keyword => lowerMessage.includes(keyword))
}

// Helper function to sanitize response - remove code blocks and ensure text only
function sanitizeResponse(response: string): string {
  let sanitized = response
  
  // Remove code blocks (```code``` or ```language\ncode\n```)
  sanitized = sanitized.replace(/```[\s\S]*?```/g, '')
  
  // Remove inline code (`code`)
  sanitized = sanitized.replace(/`[^`]+`/g, '')
  
  // Remove markdown links [text](url)
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  
  // Remove markdown bold/italic
  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '$1')
  sanitized = sanitized.replace(/\*([^*]+)\*/g, '$1')
  sanitized = sanitized.replace(/__([^_]+)__/g, '$1')
  sanitized = sanitized.replace(/_([^_]+)_/g, '$1')
  
  // Remove any remaining special formatting
  sanitized = sanitized.replace(/[#*_`\[\](){}]/g, '')
  
  // Clean up multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim()
  
  return sanitized
}

// Helper function to check if message is about cats
function isAboutCats(message: string): boolean {
  const catKeywords = [
    'mačka', 'mačke', 'mačak', 'mačić', 'mačići', 'macka', 'macke', 'macak', 'macic', 'macici',
    'cat', 'cats', 'kitten', 'kittens', 'feline', 'felines',
    'mjau', 'mjaukanje', 'meow', 'meowing',
    'rep', 'šape', 'brkovi', 'tail', 'paws', 'whiskers',
    'hrana za mačke', 'cat food', 'igračka', 'toy',
    'zdravlje mačaka', 'cat health', 'negovanje', 'grooming'
  ]
  
  const lowerMessage = message.toLowerCase()
  return catKeywords.some(keyword => lowerMessage.includes(keyword))
}

// Chat endpoint
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body

    console.log('[CHAT] Received message:', { message, sessionId })

    if (!message || typeof message !== 'string') {
      console.log('[CHAT] Invalid message format')
      res.status(400).json({ error: 'Message is required' })
      return
    }

    // Sanitize message - remove non-text characters
    const sanitizedMessage = sanitizeMessage(message)
    
    // Check if message contains only text
    if (!isTextOnly(message)) {
      console.log('[CHAT] Message contains non-text characters, sanitized:', sanitizedMessage)
    }

    // Use sanitized message if original contained non-text characters
    const finalMessage = sanitizedMessage.trim()

    if (!finalMessage || finalMessage.length === 0) {
      console.log('[CHAT] Message is empty after sanitization')
      res.status(400).json({ 
        error: 'Poruka mora da sadrži samo tekstualne karaktere',
        response: 'Izvinjavam se, poruka mora da sadrži samo tekstualne karaktere (slova, brojevi, razmaci i osnovna interpunkcija). 😸'
      })
      return
    }

    // Check if message is requesting code, images, or non-text content
    if (isRequestingNonText(finalMessage)) {
      console.log('[CHAT] Message is requesting non-text content (code/images/files)')
      res.json({
        response: 'Izvinjavam se, mogu da dajem samo tekstualne odgovore o mačkama. Ne mogu da generišem kod, slike, fajlove ili bilo šta što nije običan tekst. Postavi mi pitanje o mačkama! 😸',
        isAboutCats: false
      })
      return
    }

    // Check if message is about cats
    if (!isAboutCats(finalMessage)) {
      console.log('[CHAT] Message is not about cats')
      res.json({
        response: 'Postavi mi pitanje o mačkama, njihovom ponašanju, zdravlju, negi ili bilo čemu što se tiče mačaka.',
        isAboutCats: false
      })
      return
    }

    // Get or create conversation history for this session
    const session = sessionId || 'default'
    let history = conversationHistory.get(session) || []
    
    console.log('[CHAT] Session history length:', history.length)
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.log('[CHAT] OpenAI API key not configured, using fallback response')
      res.json({
        response: 'Izvinjavam se, AI servis nije konfigurisan. Molimo dodajte OPENAI_API_KEY u .env fajl. 😸',
        isAboutCats: true
      })
      return
    }

    // Add user message to history (use sanitized message)
    history.push({ role: 'user', content: finalMessage })

    try {
      // Prepare messages for OpenAI API
      // Always include system prompt first, then conversation history
      const messages: ChatMessage[] = [
        { role: 'system', content: CAT_SYSTEM_PROMPT }
      ]
      
      // Include last 10 messages for context (user + assistant pairs)
      const recentHistory = history.slice(-10)
      messages.push(...recentHistory)

      console.log('[CHAT] Calling OpenAI API with', messages.length, 'messages (including system prompt)')

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini for better performance and lower cost
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 500,
      })

      let assistantResponse = completion.choices[0]?.message?.content || 'Izvinjavam se, nisam mogao da generišem odgovor. Pokušaj ponovo! 😸'
      
      console.log('[CHAT] OpenAI response received:', assistantResponse.substring(0, 50) + '...')

      // Sanitize response - remove code blocks and ensure text only
      const sanitizedResponse = sanitizeResponse(assistantResponse)
      
      // If response was heavily modified (contains code blocks), use fallback
      if (sanitizedResponse.length < assistantResponse.length * 0.5 && assistantResponse.includes('```')) {
        console.log('[CHAT] Response contained code blocks, using fallback')
        assistantResponse = 'Izvinjavam se, mogu da dajem samo tekstualne odgovore o mačkama. Postavi mi pitanje o mačkama! 😸'
      } else {
        assistantResponse = sanitizedResponse || assistantResponse
      }

      // Final check - ensure response is not empty
      if (!assistantResponse || assistantResponse.trim().length === 0) {
        assistantResponse = 'Izvinjavam se, nisam mogao da generišem odgovor. Pokušaj ponovo! 😸'
      }

      // Add assistant response to history
      history.push({ role: 'assistant', content: assistantResponse })
      
      // Keep history limited to last 20 messages (to maintain context)
      if (history.length > 20) {
        history = history.slice(-20)
      }
      
      conversationHistory.set(session, history)

      res.json({
        response: assistantResponse,
        isAboutCats: true
      })
    } catch (error: any) {
      console.error('[CHAT] OpenAI API error:', error)
      
      // Fallback response if API fails
      const fallbackResponse = 'Izvinjavam se, došlo je do greške pri komunikaciji sa AI servisom. Pokušaj ponovo za nekoliko trenutaka! 😸'
      
      res.json({
        response: fallbackResponse,
        isAboutCats: true
      })
    }
  } catch (error) {
    console.error('[CHAT] Error:', error)
    res.status(500).json({ 
      error: 'Greška pri komunikaciji sa chatbotom',
      response: 'Izvinjavam se, došlo je do greške. Pokušaj ponovo! 😸'
    })
  }
})

// Clear conversation history
router.post('/clear', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body
    const session = sessionId || 'default'
    conversationHistory.delete(session)
    res.json({ success: true, message: 'Istorija razgovora obrisana' })
  } catch (error) {
    res.status(500).json({ error: 'Greška pri brisanju istorije' })
  }
})

export default router

