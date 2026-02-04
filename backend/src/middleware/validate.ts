import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { AppError, errorCodes } from '../utils/errors';

export const validate = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For query params, convert strings to numbers if needed
    let dataToValidate = req[property];
    if (property === 'query') {
      dataToValidate = { ...req[property] };
      Object.keys(dataToValidate).forEach(key => {
        const value = (dataToValidate as any)[key];
        if (typeof value === 'string' && !isNaN(Number(value))) {
          (dataToValidate as any)[key] = Number(value);
        }
      });
    }

    const { error, value } = schema.validate(dataToValidate, {
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

    // For query params, we need to merge back since query is read-only in Express 5
    if (property === 'query') {
      Object.assign(req.query, value);
    } else {
      req[property] = value;
    }
    next();
  };
};
