/**
 * Home Routes - Root and version endpoints
 */
import { Router } from 'express';
import { info, version } from '../controllers/home.controller.js';

const router = Router();

router.get('/', info);
router.get('/version', version);

export default router;
