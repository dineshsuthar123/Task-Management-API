import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';
import logger from '../config/logger';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      logger.info(`User registered: ${req.body.email}`);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      logger.info(`User logged in: ${req.body.email}`);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
