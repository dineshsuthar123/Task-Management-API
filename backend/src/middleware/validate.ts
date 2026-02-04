import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError, errorCodes } from '../utils/errors';

export const validate = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Validation failed', details);
    }

    req[property] = value;
    next();
  };
};
