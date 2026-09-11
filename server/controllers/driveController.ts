import { NextFunction, Request, Response } from "express";
import { GoogleDriveService } from "../services/driveService";

export async function checkConnection(
  client: GoogleDriveService,
  req: Request,
  res: Response,
) {
  const connected = await client.checkConnection();
  return res.status(connected.connected ? 200 : 503).json(connected);
}

export async function getFilesFromFolder(
  client: GoogleDriveService,
  req: Request<{ folderID: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const folderID = req.params.folderID;
    if (!folderID)
      return res.status(400).json({ message: "folder id is required" });
    const files = await client.getAllFilesInFolder(folderID);
    if (!files)
      return res.status(404).json({ message: `Folder ${folderID} not found` });
    return res.status(200).json(files);
  } catch (err) {
    next(err);
  }
}

export async function getFileFromId(
  client: GoogleDriveService,
  req: Request<{ fileID: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const fileID = req.params.fileID;
    if (!fileID)
      return res.status(400).json({ message: "file id is required" });

    const meta = await client.getFile(fileID);
    const file = await client.getFileContent(fileID);

    if (!meta || !file)
      return res.status(404).json({ message: `file ${fileID} not found` });

    res.setHeader("Content-Type", meta.mimeType);
    return res.status(200).json(file);
  } catch (err) {
    return next(err);
  }
}

export async function uploadFile(
  client: GoogleDriveService,
  req: Request<
    { fileName: string; mimeType: string},
    unknown,
    Buffer
  >,
  res: Response,
  next: NextFunction,
) {
  try {
    const buffer = req.body;
    let safeBuffer: Buffer;

    if (Buffer.isBuffer(buffer)) {
      safeBuffer = buffer;
    } else if (
      buffer &&
      typeof buffer === "object" &&
      "data" in buffer &&
      Array.isArray((buffer as any).data)
    ) {
      safeBuffer = Buffer.from((buffer as any).data);
    } else {
      return res.status(400).json({
        message: `Invalid buffer provided for file upload: exprected Buffer, got ${typeof buffer}`,
      });
    }

    const file = await client.uploadFile({
      buffer: safeBuffer,
      fileName: req.params.fileName,
      mimeType: req.params.mimeType
    });
    return res.status(201).json(file);
  } catch (err) {
    return next(err);
  }
}

export async function deleteFile(
  client: GoogleDriveService,
  req: Request<{ fileID: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.fileID;
    if (!id) return res.status(400).json({ message: "file id is required" });
    await client.deleteFile(id);
    return res.status(204);
  } catch (err) {
    return next(err);
  }
}
