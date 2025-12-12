import { type Request, type Response, type NextFunction } from 'express'

export interface CustomError extends Error {
  status?: number
  code?: string
}

export const errorHandler = (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err)

  // Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    res.status(400).json({
      errorCode: 'error.databaseError',
      message: err.message
    })
    return
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      errorCode: 'auth.invalidToken'
    })
    return
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      errorCode: 'auth.tokenExpired'
    })
    return
  }

  // Default error
  res.status(err.status || 500).json({
    errorCode: err.message ? undefined : 'error.internalServerError',
    error: err.message || undefined,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

