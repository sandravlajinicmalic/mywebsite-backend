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
// This will be dynamically generated based on user's language
function getSystemPrompt(language: string = 'en'): string {
  if (language === 'sr') {
    return `Ti si prijateljski AI asistent koji razgovara SAMO o mačkama. 
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
  } else {
    return `You are a friendly AI assistant that talks ONLY about cats. 
Your role is to help people learn more about cats, their behavior, health, grooming, breeds, nutrition, and everything related to cats.

IMPORTANT:
- If someone asks you about something that is NOT related to cats, politely respond that you can only talk about cats and redirect the conversation to the topic of cats.
- Be friendly, informative and enthusiastic when talking about cats.
- Respond in English.
- Use cat-related emojis (😸, 🐱, 😺, 🐾) when appropriate.
- Be specific and informative in your responses.
- NEVER generate code, images, files, or anything that is not plain text.
- Your responses must be ONLY textual - no code blocks, no markdown formats for code, no images, no files.
- If someone asks you to generate code, an image, or anything that is not text, politely respond that you can only provide text responses about cats.`
  }
}

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
    const { message, sessionId, language } = req.body

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' })
      return
    }

    // Sanitize message - remove non-text characters
    const sanitizedMessage = sanitizeMessage(message)

    // Use sanitized message if original contained non-text characters
    const finalMessage = sanitizedMessage.trim()

    if (!finalMessage || finalMessage.length === 0) {
      res.status(400).json({ 
        error: 'Message must contain only text characters',
        response: 'Sorry, message must contain only text characters (letters, numbers, spaces and basic punctuation).'
      })
      return
    }

    // Check if message is requesting code, images, or non-text content
    if (isRequestingNonText(finalMessage)) {
      res.json({
        response: 'Sorry, I can only provide text responses about cats. I cannot generate code, images, files or anything that is not plain text. Ask me a question about cats!',
        isAboutCats: false
      })
      return
    }

    // Check if message is about cats
    if (!isAboutCats(finalMessage)) {
      res.json({
        response: 'Ask me a question about cats, their behavior, health, grooming or anything related to cats.',
        isAboutCats: false
      })
      return
    }

    // Get or create conversation history for this session
    const session = sessionId || 'default'
    let history = conversationHistory.get(session) || []
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      res.json({
        response: 'Sorry, AI service is not configured. Please add OPENAI_API_KEY to the .env file.',
        isAboutCats: true
      })
      return
    }

    // Add user message to history (use sanitized message)
    history.push({ role: 'user', content: finalMessage })

    try {
      // Prepare messages for OpenAI API
      // Always include system prompt first, then conversation history
      // Use language from request or default to English
      const userLanguage = language || 'en'
      const systemPrompt = getSystemPrompt(userLanguage)
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt }
      ]
      
      // Include last 10 messages for context (user + assistant pairs)
      const recentHistory = history.slice(-10)
      messages.push(...recentHistory)

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini for better performance and lower cost
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 500,
      })

      let assistantResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response. Please try again!'

      // Sanitize response - remove code blocks and ensure text only
      const sanitizedResponse = sanitizeResponse(assistantResponse)
      
      // If response was heavily modified (contains code blocks), use fallback
      if (sanitizedResponse.length < assistantResponse.length * 0.5 && assistantResponse.includes('```')) {
        assistantResponse = 'Sorry, I can only provide text responses about cats. Ask me a question about cats!'
      } else {
        assistantResponse = sanitizedResponse || assistantResponse
      }

      // Final check - ensure response is not empty
      if (!assistantResponse || assistantResponse.trim().length === 0) {
        assistantResponse = 'Sorry, I could not generate a response. Please try again!'
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
      console.error('OpenAI API error:', error)
      
      // Fallback response if API fails
      const fallbackResponse = 'Sorry, an error occurred while communicating with the AI service. Please try again in a few moments!'
      
      res.json({
        response: fallbackResponse,
        isAboutCats: true
      })
    }
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ 
      error: 'Error communicating with chatbot',
      response: 'Sorry, an error occurred. Please try again!'
    })
  }
})

// Clear conversation history
router.post('/clear', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body
    const session = sessionId || 'default'
    conversationHistory.delete(session)
    res.json({ success: true, message: 'Conversation history cleared' })
  } catch (error) {
    res.status(500).json({ error: 'Error clearing history' })
  }
})

export default router

