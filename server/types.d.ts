declare namespace Express {
  interface Request {
    session?: any;
    user?: any;
  }
}

import 'express-session'
import 'express'

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
}

declare module 'express' {
  interface User {
    id: string
    // adicione mais campos conforme necessário
  }

  interface Request {
    user?: User
  }
}
