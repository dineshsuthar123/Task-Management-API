import { Task, TaskStatus } from '@prisma/client';
import prisma from '../config/database';
import { AppError, errorCodes } from '../utils/errors';

export interface CreateTaskDTO {
  title: string;
  description?: string | null;
  status?: TaskStatus;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export class TaskService {
  async createTask(userId: string, data: CreateTaskDTO): Promise<Task> {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || TaskStatus.PENDING,
        userId,
      },
    });
  }

  async getTasks(userId: string, params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.count({ where: { userId } }),
    ]);

    return {
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTaskById(taskId: string, userId: string): Promise<Task> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new AppError(404, errorCodes.NOT_FOUND, 'Task not found');
    }

    return task;
  }

  async updateTask(taskId: string, userId: string, data: UpdateTaskDTO): Promise<Task> {
    const task = await this.getTaskById(taskId, userId);

    return prisma.task.update({
      where: { id: task.id },
      data,
    });
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskById(taskId, userId);

    await prisma.task.delete({
      where: { id: task.id },
    });
  }

  // Admin only - get all tasks
  async getAllTasks(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.task.count(),
    ]);

    return {
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new TaskService();
