import { Request, Response } from "express";
import onshapeService, {
  OnshapeApiError,
  UnsupportedOnshapeOperationError,
} from "../services/onshapeService";

interface OnshapePartParams {
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
  partID: string;
}

interface OnshapeBomParams {
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
}

/**
 * Maps a thrown error to an HTTP response. Distinguishes the three
 * error shapes onshapeService.ts can raise, rather than flattening
 * everything to one status:
 *   - UnsupportedOnshapeOperationError -> 501: the operation has no
 *     REST equivalent in Onshape (e.g. delete a part, update a BOM).
 *     This isn't a failure to reach Onshape, so 502 would be misleading.
 *   - OnshapeApiError -> passes through Onshape's own status code
 *     (404, 403, etc.) so the caller sees the real cause.
 *   - anything else (network failure, missing credentials, etc.) -> 502,
 *     since that genuinely means "couldn't get a good response from
 *     the upstream Onshape API."
 */
function handleOnshapeError(
  res: Response,
  err: unknown,
  fallbackMessage: string,
): Response {
  if (err instanceof UnsupportedOnshapeOperationError) {
    return res.status(501).json({ message: err.message });
  }
  if (err instanceof OnshapeApiError) {
    return res
      .status(err.status)
      .json({ message: err.message, onshapeResponse: err.body });
  }
  const message = err instanceof Error ? err.message : String(err);
  return res.status(502).json({ message: fallbackMessage, error: message });
}

/** GET /api/onshape/ */
export async function checkConnection(req: Request, res: Response) {
  const connected = await onshapeService.checkConnection();
  return res.status(connected ? 200 : 503).json({ connected });
}

/** GET /api/onshape/part/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/p/:partID */
export async function getPart(req: Request<OnshapePartParams>, res: Response) {
  try {
    const part = await onshapeService.getPartForDb(req.params);
    return res.status(200).json(part);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to fetch part from Onshape");
  }
}

/** POST /api/onshape/part/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID/p/:partID */
export async function updatePart(
  req: Request<OnshapePartParams, unknown, Record<string, unknown>>,
  res: Response,
) {
  try {
    const part = await onshapeService.updatePart(req.params, req.body);
    return res.status(200).json(part);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to update part in Onshape");
  }
}

/** GET /api/onshape/bom/d/:documentID/wvmT/:wvmType/wvmI/:wvmID/e/:elementID */
export async function getBom(req: Request<OnshapeBomParams>, res: Response) {
  try {
    const bom = await onshapeService.getBom(req.params);
    return res.status(200).json(bom["bomTable"]);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to fetch bom from Onshape");
  }
}

export async function getPartThumbnail(
  req: Request<OnshapePartParams & { size?: string }>,
  res: Response,
) {
  try {
    const thumbnail = await onshapeService.getPartThumbnail(
      req.params,
      req.params.size,
    );
    if (!thumbnail)
      return res
        .status(404)
        .json({ message: `onshape part was not found ${req.params}` });
    res.setHeader("Content-Type", "image/png");
    return res.status(200).json(thumbnail);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to fetch thumbnail for part");
  }
}

export async function setPartThumbnail(
  req: Request<OnshapePartParams, unknown, Buffer>,
  res: Response,
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
        message: `Invalid buffer provided for file upload: expected Buffer, got ${typeof buffer}`,
      });
    }

    await onshapeService.setPartThumbnail(req.params, safeBuffer);

    return res.status(204);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to set thumbnail for part");
  }
}

export async function getElementThumbnail(
  req: Request<OnshapeBomParams & { size?: string }>,
  res: Response,
) {
  try {
    const thumbnail = await onshapeService.getElementThumbnail(
      req.params,
      req.params.size,
    );
    if (!thumbnail)
      return res
        .status(404)
        .json({ message: `onshape element was not found ${req.params}` });

    res.setHeader("Content-Type", "image/png");
    return res.status(200).json(thumbnail);
  } catch (err) {
    return handleOnshapeError(
      res,
      err,
      "Failed to fetch thumbnail for element",
    );
  }
}

export async function setElementThumbnail(
  req: Request<OnshapeBomParams, unknown, Buffer>,
  res: Response,
) {
  try {
    const buffer = req.body;
    let safeBuffer: Buffer;

    if (Buffer.isBuffer(buffer)) {
      safeBuffer = buffer;
    } else if (
      buffer &&
      typeof buffer === "object" &&
      "data" in Buffer &&
      Array.isArray((buffer as any).data)
    ) {
      safeBuffer = Buffer.from((buffer as any).data);
    } else {
      return res.status(400).json({ message: `Invalid buffer provided for file upload: expected Buffer, got ${typeof buffer}`});
    }

    await onshapeService.setElementThumbnail(req.params, safeBuffer);
    
    return res.status(204);
  } catch (err) {
    return handleOnshapeError(res, err, "Failed to set thumbnail for element");
  }
}

export async function exportSTL(
  req: Request<OnshapePartParams>,
  res: Response
) {
  try {
    const stl = await onshapeService.exportPartToStl(req.params);
    if (!stl) res.status(404).json({ message: `part not found ${req.params}`});

    res.setHeader("Content-Type", "model/stl");
    return res.status(200).json(stl);
  } catch (err) {
    return handleOnshapeError(res, err, 'Failed to export stl');
  }
}

export async function exportParasolid(
  req: Request<OnshapePartParams>,
  res: Response
) {
  try {
    const parasolid = await onshapeService.exportPartToParasolid(req.params);
    if (!parasolid) res.status(404).json({ message: `part not found ${req.params}`});

    res.setHeader("Content-Type", "application/x-parasolid");
    return res.status(200).json(parasolid);
  } catch (err) {
    return handleOnshapeError(res, err, 'Failed to export parasolid');
  }
}

export async function exportSolidworks(
  req: Request<OnshapePartParams>,
  res: Response
) {
  try {
    const solidworks = await onshapeService.exportPartToSolidworks(req.params);
    if (!solidworks) res.status(404).json({ message: `part not found ${req.params}`});

    res.setHeader("Content-Type", "application/sldprt");
    return res.status(200).json(solidworks);
  } catch (err) {
    return handleOnshapeError(res, err, 'Failed to export solidworks');
  }
}
