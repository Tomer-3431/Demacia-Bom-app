import express from "express";
import * as driveController from "../controllers/driveController";
import { createGoogleDriveService } from "../services/driveService";
import "dotenv/config";
import { google } from "googleapis";

const router = express.Router();
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);
auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = createGoogleDriveService(auth);

router.get(
  "/",
  async (req, res) => await driveController.checkConnection(drive, req, res),
);

router.get(
  "/file/id/:fileID",
  async (req, res, next) => await driveController.getFileFromId(drive, req, res, next),
);
router.post(
  "/file/name/:fileName/mime/:mimeType/folder/:folderID",
  express.raw({ type: "*/*", limit: "50mb",  }),
  async (req, res, next) => await driveController.uploadFile(drive, req, res, next),
);
router.delete(
  "/file/id/:fileID",
  async (req, res, next) => await driveController.deleteFile(drive, req, res, next),
);

router.get(
  "/folder/id/:folderID",
  async (req, res, next) => await driveController.getFilesFromFolder(drive, req, res, next),
);

export default router;
