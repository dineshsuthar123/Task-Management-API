import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import taskService from '../services/taskService';
import logger from '../config/logger';

export class TaskController {
  async createTask(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.createTask(req.user!.id, req.body);
      logger.info(`Task created: ${task.id} by user ${req.user!.id}`);
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }

  async getTasks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await taskService.getTasks(req.user!.id, req.query as any);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTaskById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.getTaskById(String(req.params.id), req.user!.id);
      res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const task = await taskService.updateTask(String(req.params.id), req.user!.id, req.body);
      logger.info(`Task updated: ${task.id} by user ${req.user!.id}`);
      res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await taskService.deleteTask(String(req.params.id), req.user!.id);
      logger.info(`Task deleted: ${req.params.id} by user ${req.user!.id}`);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // Admin only
  async getAllTasks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await taskService.getAllTasks(req.query as any);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new TaskController();
