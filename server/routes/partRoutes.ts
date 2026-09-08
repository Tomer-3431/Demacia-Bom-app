import express from 'express';
import * as partController from '../controllers/partController';

const router = express.Router();

router.get('/all', partController.getAllParts);

router.get('/id/:id', partController.getPartByID);
router.post('/id/:id', partController.upsertPartByID);
router.delete('/id/:id', partController.deletePartByID);

const onshapeKeyPath = '/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/p/:partID';
router.get(onshapeKeyPath, partController.getPartByOnshapeKey);
router.post(onshapeKeyPath, partController.upsertPartByOnshapeKey);
router.delete(onshapeKeyPath, partController.deletePartByOnshapeKey);

export default router;
