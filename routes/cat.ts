import express, { type Request, type Response } from 'express'
import { supabase } from '../config/supabase.js'
import { io } from '../index.js'

const router = express.Router()

// Cat states
export type CatState = 'playing' | 'zen' | 'sleeping' | 'happy' | 'tired' | 'angry'

interface CatStateData {
  current: CatState
  is_resting: boolean
  rest_end_time: string | null
  rested_by: string | null
  rested_by_name: string | null
  last_updated: string
}

// Helper function to get current cat state
async function getCurrentCatState(): Promise<CatStateData | null> {
  const { data, error } = await supabase
    .from('global_cat_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return null
  }

  return data as CatStateData
}

// Helper function to add log
async function addLog(action: string, userName?: string): Promise<void> {
  const { data, error } = await supabase
    .from('cat_logs')
    .insert([
      {
        action,
        user_name: userName || 'Sistem',
        timestamp: new Date().toISOString()
      }
    ])
    .select()
    .single()

  if (!error && data) {
    // Broadcast new log to all connected clients
    io.emit('new-log', data)
  }
}

// Get current cat status (HTTP endpoint for debugging)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const state = await getCurrentCatState()
    if (!state) {
      res.status(404).json({ error: 'Cat state not found' })
      return
    }

    res.json({
      success: true,
      state: {
        current: state.current,
        isResting: state.is_resting,
        restEndTime: state.rest_end_time,
        restedBy: state.rested_by_name,
        lastUpdated: state.last_updated
      },
      activeConnections: io.engine.clientsCount,
      uptime: process.uptime()
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cat status' })
  }
})

// Initialize cat state (manual endpoint)
router.post('/init', async (_req: Request, res: Response) => {
  try {
    const { data: existingState } = await supabase
      .from('global_cat_state')
      .select('*')
      .eq('id', 1)
      .single()

    if (existingState) {
      res.json({
        success: true,
        message: 'Cat state already exists',
        state: existingState
      })
      return
    }

    const { data: newState, error: insertError } = await supabase
      .from('global_cat_state')
      .insert([
        {
          id: 1,
          current: 'playing',
          is_resting: false,
          rest_end_time: null,
          rested_by: null,
          rested_by_name: null,
          last_updated: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (insertError) {
      res.status(500).json({ error: 'Failed to initialize cat state', details: insertError })
      return
    }

    await addLog('System: Cat initialized')

    res.json({
      success: true,
      message: 'Cat state initialized',
      state: newState
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize cat state' })
  }
})

export { getCurrentCatState, addLog }
export default router

