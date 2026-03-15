declare namespace Express {
  interface Request {
    steamResolvedPath?: string
    steamKeySource?: 'user' | 'server'
  }
}

