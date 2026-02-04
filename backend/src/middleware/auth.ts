import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import authService from '../services/authService';
import { AppError, errorCodes } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: Role;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, errorCodes.INVALID_TOKEN, 'No token provided');
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, errorCodes.INVALID_TOKEN, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(403, errorCodes.FORBIDDEN, 'Insufficient permissions');
    }

    next();
  };
};
