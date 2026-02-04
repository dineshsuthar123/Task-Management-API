import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, Role } from '@prisma/client';
import prisma from '../config/database';
import { AppError, errorCodes } from '../utils/errors';
import { config } from '../config';

export interface RegisterDTO {
  email: string;
  password: string;
  role?: Role;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface TokenPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export class AuthService {
  async register(data: RegisterDTO): Promise<{ userId: string }> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, errorCodes.CONFLICT, 'User already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role || Role.USER,
      },
    });

    return { userId: user.id };
  }

  async login(data: LoginDTO): Promise<{ token: string; user: Partial<User> }> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, errorCodes.AUTH_FAILED, 'Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new AppError(401, errorCodes.AUTH_FAILED, 'Invalid credentials');
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry } as jwt.SignOptions
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as TokenPayload;
    } catch (error) {
      throw new AppError(401, errorCodes.INVALID_TOKEN, 'Invalid or expired token');
    }
  }
}

export default new AuthService();
