/**
 * Operational Routes - Health, readiness, and info endpoints
 */
import { Router } from 'express';
import {
  getInfo,
  getReadiness,
  getLiveness,
  getMetrics,
} from '../controllers/operational.controller.js';

const router = Router();

router.get('/info', getInfo);
router.get('/health/ready', getReadiness);
router.get('/health/live', getLiveness);
router.get('/metrics', getMetrics);

export default router;
