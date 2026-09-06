import express from 'express';
import * as healthController from '../controllers/healthController';
import partRoutes from './partRoutes';
import bomRoutes from './bomRoutes';
import workOrderRoutes from './workOrderRoutes';

const router = express.Router();

router.get('/', healthController.checkDBConnection);

router.use('/part', partRoutes);
router.use('/bom', bomRoutes);
router.use('/workOrder', workOrderRoutes);

export default router;
