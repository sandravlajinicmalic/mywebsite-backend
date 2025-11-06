export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err)

  // Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    return res.status(400).json({
      error: 'Greška u bazi podataka',
      message: err.message
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Nevažeći token'
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token je istekao'
    })
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Interna greška servera',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

