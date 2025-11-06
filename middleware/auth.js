import jwt from 'jsonwebtoken'

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token je potreban' })
  }

  jwt.verify(
    token,
    process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Nevažeći ili istekao token' })
      }
      req.user = user
      next()
    }
  )
}

