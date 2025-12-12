import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: {
    userId: string
    email: string
  }
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    res.status(401).json({ errorCode: 'auth.accessTokenRequired' })
    return
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    (err, user) => {
      if (err) {
        res.status(403).json({ errorCode: 'auth.invalidOrExpiredToken' })
        return
      }
      req.user = user as { userId: string; email: string }
      next()
    }
  )
}

