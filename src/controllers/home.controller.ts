/**
 * Home Controller - Root endpoint handlers
 */
import { Request, Response } from 'express';
import config from '../core/config.js';

export function info(req: Request, res: Response): void {
  res.json({
    message: 'Welcome to the Cart Service',
    service: config.service.name,
    description: 'Shopping cart management service for xshopai platform',
    environment: config.service.nodeEnv,
  });
}

export function version(req: Request, res: Response): void {
  res.json({
    service: config.service.name,
    version: config.service.version,
  });
}
