import express from 'express';
import * as bomController from '../controllers/bomController';

const router = express.Router();

router.get('/all', bomController.getAllBoms);

router.get('/id/:id', bomController.getBomByID);
router.post('/id/:id', bomController.upsertBomByID);
router.delete('/id/:id', bomController.deleteBomByID);

const onshapeKeyPath = '/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/b/:bomID';
router.get(onshapeKeyPath, bomController.getBomByOnsahpeKey);
router.post(onshapeKeyPath, bomController.upsertBomByOnshapeKey);
router.delete(onshapeKeyPath, bomController.deleteBomByOnshapeKey);

export default router;
