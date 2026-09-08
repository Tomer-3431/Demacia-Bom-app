import express from "express";
import * as onshapeController from "../controllers/onshapeController";

const router = express.Router();

router.get("/", onshapeController.checkConnection);

const partPath =
  "/part/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/p/:partID";
router.get(partPath, onshapeController.getPart);
router.post(partPath, onshapeController.updatePart);

const bomPath = "/bom/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elemntID";
router.get(bomPath, onshapeController.getBom);

router.get(`${partPath}/thumbnail/s/:size`, onshapeController.getPartThumbnail);
router.post(
  `${partPath}/thumbnail`,
  express.raw({ type: "image/*", limit: "50mb"}),
  onshapeController.setPartThumbnail,
);

router.get(
  `${bomPath}/thumbnail/s/:size`,
  onshapeController.getElementThumbnail,
);
router.post(
  `${bomPath}/thumbnail`,
  express.raw({ type: "image/*", limit: "50mb"}),
  onshapeController.setElementThumbnail,
);

router.get(`${partPath}/stl`, onshapeController.exportSTL);
router.get(`${partPath}/parasolid`, onshapeController.exportParasolid);
router.get(`${partPath}/solidworks`, onshapeController.exportSolidworks);

export default router;
