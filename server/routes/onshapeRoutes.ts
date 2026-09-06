import express from 'express';
import * as onshapeController from '../controllers/onshapeController';

const router = express.Router();

router.get('/', onshapeController.checkConnection);

const partPath = '/part/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/p/:partID';
router.get(partPath, onshapeController.getPart);
router.post(partPath, onshapeController.updatePart);

const bomPath = '/bom/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elemntID';
router.get(bomPath, onshapeController.getBom);

export default router;
