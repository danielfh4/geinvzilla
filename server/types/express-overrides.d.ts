// server/types/express-overrides.d.ts

import 'express-session'
import 'express'

declare module 'express-session' {
  interface SessionData {
    userId?: number
  }
}

declare module 'express' {
  interface User {
    id: string
    // Adicione outros campos que você usa, ex: nome, email
  }

  interface Request {
    user?: User
  }
}