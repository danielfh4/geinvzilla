import "express-session";
import { User } from "./schema"; // ajuste o caminho se necessário

declare module "express-session" {
  interface SessionData {
    userId?: string;
    isAdmin?: boolean;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
      file?: Express.Multer.File;
    }
  }
}