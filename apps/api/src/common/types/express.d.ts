import type { RequestUser } from '../../auth/types/request-user';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export {};
