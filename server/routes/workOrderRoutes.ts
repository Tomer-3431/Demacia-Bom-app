import express from 'express';
import * as workOrderController from '../controllers/workOrderController';

const router = express.Router();

router.get('/all', workOrderController.getAllWorkOrders);

router.get('/id/:id', workOrderController.getWorkOrderByID);
router.post('/id/:id', workOrderController.upsertWorkOrderByID);
router.delete('/id/:id', workOrderController.deleteWorkOrderByID);

export default router;
