import express from 'express';
import * as enumController from '../controllers/enumController';

const router = express.Router();

router.get('/productionType/all', enumController.getAllProductionTypes);
router.get('/productionType/id/:id', enumController.getProductionTypeByID);

router.get('/status/all', enumController.getAllStatuses);
router.get('/status/id/:id', enumController.getStatusByID);

export default router;
