import express from 'express';
import * as healthController from '../controllers/healthController';
import dbRoutes from './dbRoutes';
import enumRoutes from './enumRoutes';
import onshapeRoutes from './onshapeRoutes';

const router = express.Router();

router.get('/', healthController.checkAuth);

router.use('/db', dbRoutes);
router.use('/enum', enumRoutes);
router.use('/onshape', onshapeRoutes);

export default router;
