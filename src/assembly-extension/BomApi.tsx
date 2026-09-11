/**
 * BomApi.tsx
 * =============================================================================
 * Small extension on top of ../util/ApiService for this page's needs:
 *  - postToApi: the POST counterpart to fetchFromApi (used for "create/modify"
 *    endpoints, which are all POST per the API doc).
 *  - Route builders for the Onshape-key-based endpoints, so the
 *    documentID/wvmType/wvmID/elementID/partID-or-bomID path segments are
 *    only assembled in one place.
 *
 * All routes below come straight from the server's API doc (v2.0.1):
 * https://github.com/Tomer-3431/Demacia-Bom-app/wiki/Api-Doc-v2.0.1
 */

import { fetchFileBytes, fetchFromApi, type ApiError } from "../util/ApiService";
import type { BomModel, PartModel } from "../util/Models";
import type { OnshapeBomTable } from "./OnshapeBom";

const BASE_URL = "http://localhost:5050/api";

export async function postToApi<T>(endpoint: string, body: unknown): Promise<T> {
  const secret = import.meta.env.VITE_CLIENT_SECRET;

  if (!secret) {
    throw { message: "VITE_CLIENT_SECRET is missing from environment variables." } as ApiError;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-secret": secret,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw {
        message: `Failed request to ${endpoint}: ${response.statusText}`,
        statusCode: response.status,
      } as ApiError;
    }

    // Some "modify" endpoints may reply 200/204 with no body.
    const text = await response.text();
    return (text ? JSON.parse(text) : (undefined as unknown)) as T;
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw { message: err.message || "Network error occurred." } as ApiError;
  }
}

export interface OnshapeKey {
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
}

const onshapeKeySegment = (k: OnshapeKey) =>
  `/d/${k.documentID}/wvmT/${k.wvmType}/wvmI/${k.wvmID}/e/${k.elementID}`;

/* ---------------------------------------------------------------------- */
/* Database, keyed by Onshape identity                                     */
/* ---------------------------------------------------------------------- */

export function dbBomByOnshapeKeyEndpoint(key: OnshapeKey, bomID: string): string {
  return `/db/bom${onshapeKeySegment(key)}/b/${bomID}`;
}

export function dbPartByOnshapeKeyEndpoint(key: OnshapeKey, partID: string): string {
  return `/db/part${onshapeKeySegment(key)}/p/${partID}`;
}

export function getBomByOnshapeKey(key: OnshapeKey, bomID: string): Promise<BomModel> {
  return fetchFromApi<BomModel>(dbBomByOnshapeKeyEndpoint(key, bomID));
}

export function getPartByOnshapeKey(key: OnshapeKey, partID: string): Promise<PartModel> {
  return fetchFromApi<PartModel>(dbPartByOnshapeKeyEndpoint(key, partID));
}

export function upsertBomByOnshapeKey(key: OnshapeKey, bomID: string, data: Partial<BomModel>): Promise<BomModel> {
  return postToApi<BomModel>(dbBomByOnshapeKeyEndpoint(key, bomID), data);
}

export function upsertPartByOnshapeKey(key: OnshapeKey, partID: string, data: Partial<PartModel>): Promise<PartModel> {
  return postToApi<PartModel>(dbPartByOnshapeKeyEndpoint(key, partID), data);
}

export function upsertBomById(id: string, data: Partial<BomModel>): Promise<BomModel> {
  return postToApi<BomModel>(`/db/bom/id/${id}`, data);
}

export function upsertPartById(id: string, data: Partial<PartModel>): Promise<PartModel> {
  return postToApi<PartModel>(`/db/part/id/${id}`, data);
}

/* ---------------------------------------------------------------------- */
/* Live Onshape data (fallback source when not yet in the DB)              */
/* ---------------------------------------------------------------------- */

/**
 * Fetches the live Onshape BOM for one assembly. REQUIRES the server route
 * (GET /api/onshape/bom/d/.../e/{elementID}) to call Onshape's
 * getBillOfMaterials with indented=true&multiLevel=true - without those,
 * Onshape returns a flat parts-only list with no sub-assembly rows at all,
 * and AssemblyBomPage will never find anything to recurse into.
 */
export async function getOnshapeBom(key: OnshapeKey): Promise<OnshapeBomTable> {
  // The response IS the table (no bomTable wrapper) - see OnshapeBom.tsx.
  const response = await fetchFromApi<OnshapeBomTable>(`/onshape/bom${onshapeKeySegment(key)}`);
  console.log(response);
  return response;
}

/**
 * Best-effort push of edited fields back onto the live Onshape part metadata.
 * This should never block a DB save - callers should catch/ignore failures
 * (e.g. the part lives in a version, which Onshape won't let you edit).
 */
export function updateOnshapePartMetadata(
  key: OnshapeKey,
  partID: string,
  data: Record<string, unknown>
): Promise<unknown> {
  return postToApi(`/onshape/part${onshapeKeySegment(key)}/p/${partID}`, data);
}

/**
 * Best-effort push of edited fields back onto a sub-assembly's live Onshape
 * ELEMENT metadata (name, description, etc). This is NOT a BOM-specific
 * write - Onshape has no endpoint to write BOM table data directly. An
 * assembly is just an element, so renaming/editing it goes through the same
 * element-metadata mechanism as any tab: GET the element's metadata to find
 * each property's propertyId (an opaque per-document id, e.g.
 * "57f3fb8efa3416c06701d60d" for Name), then POST
 * { properties: [{ propertyId, value }] } back.
 *
 * The frontend doesn't know propertyIds (only the server does, from the
 * BOM's own `headers[].propertyId` it already fetches), so this sends plain
 * field-name -> value pairs and expects the server route to do the
 * name -> propertyId translation and the actual
 * POST /api/v10/metadata/d/{did}/w/{wid}/e/{eid} call.
 *
 * Route: POST /onshape/bom/d/.../wvmT/.../wvmI/.../e/{elementID}/metadata
 */
export function updateOnshapeBomMetadata(
  key: OnshapeKey,
  data: Record<string, unknown>
): Promise<unknown> {
  return postToApi(`/onshape/bom${onshapeKeySegment(key)}`, data);
}

/* ---------------------------------------------------------------------- */
/* Onshape binary files (thumbnail, STL, Parasolid) -> Google Drive        */
/* ---------------------------------------------------------------------- */
/*
 * Publishing pulls each part's thumbnail + STL + Parasolid export straight
 * from Onshape through the browser, then re-uploads those bytes to Google
 * Drive via the server's /drive route - the server itself never talks to
 * Drive on the part's behalf here. The Drive file id that comes back is
 * what gets stored on the part (avatarID / stlLink / parasolidLink).
 *
 * All three GET routes below return the same raw-binary-or-JSON-wrapped-
 * Buffer shape as everything else in this app, so they reuse
 * fetchFileBytes() from ApiService.tsx (the same decoding logic
 * downloadFile() and AuthenticatedImage use) rather than duplicating it.
 */

function driveSecretHeaders(): Record<string, string> {
  const secret = import.meta.env.VITE_CLIENT_SECRET;
  if (!secret) {
    throw { message: "VITE_CLIENT_SECRET is missing from environment variables." } as ApiError;
  }
  return { "x-client-secret": secret };
}

/**
 * Fetches a part's default thumbnail image from Onshape as a Blob.
 * Route: GET /onshape/part/d/.../wvmT/.../wvmI/.../e/{elementID}/p/{partID}/thumbnail
 */
export function getOnshapePartThumbnail(key: OnshapeKey, partID: string): Promise<Blob> {
  const url = `${BASE_URL}/onshape/part${onshapeKeySegment(key)}/p/${partID}/thumbnail`;
  return fetchFileBytes(url, "image/png");
}

/**
 * Fetches a part's STL export from Onshape as a Blob.
 * Route: GET /onshape/part/d/.../wvmT/.../wvmI/.../e/{elementID}/p/{partID}/stl
 */
export function getOnshapePartStl(key: OnshapeKey, partID: string): Promise<Blob> {
  const url = `${BASE_URL}/onshape/part${onshapeKeySegment(key)}/p/${partID}/stl`;
  return fetchFileBytes(url, "model/stl");
}

/**
 * Fetches a part's Parasolid export from Onshape as a Blob.
 * Route: GET /onshape/part/d/.../wvmT/.../wvmI/.../e/{elementID}/p/{partID}/parasolid
 */
export function getOnshapePartParasolid(key: OnshapeKey, partID: string): Promise<Blob> {
  const url = `${BASE_URL}/onshape/part${onshapeKeySegment(key)}/p/${partID}/parasolid`;
  return fetchFileBytes(url, "application/x-parasolid");
}

/**
 * Fetches a sub-assembly (BOM element)'s default thumbnail from Onshape.
 * Route: GET /onshape/bom/d/.../wvmT/.../wvmI/.../e/{elementID}/thumbnail
 */
export function getOnshapeBomThumbnail(key: OnshapeKey): Promise<Blob> {
  const url = `${BASE_URL}/onshape/bom${onshapeKeySegment(key)}/thumbnail`;
  return fetchFileBytes(url, "image/png");
}

/** What the /drive/file/name/.../mime/.../folder/... upload route returns for one file. */
export interface DriveUploadResult {
  id: string;
  name?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * Uploads raw file bytes to Google Drive through the server, returning the
 * new Drive file's id (and whatever else the server includes).
 * Route: POST /drive/file/name/{fileName}/mime/{mimeType}/folder/{folderID}
 *
 * The folder segment is intentionally omitted - the server falls back to
 * its own configured root Drive folder (GOOGLE_DRIVE_ROOT_FOLDER_ID) when
 * no folder is given, so callers here don't need to know a folder id.
 */
export async function uploadFileToDrive(blob: Blob, fileName: string): Promise<DriveUploadResult> {
  const encodedName = encodeURIComponent(fileName);
  const encodedMime = encodeURIComponent(blob.type || "application/octet-stream");
  const url = `${BASE_URL}/drive/file/name/${encodedName}/mime/${encodedMime}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...driveSecretHeaders(),
      "Content-Type": blob.type || "application/octet-stream",
    },
    body: blob,
  });

  if (!response.ok) {
    throw {
      message: `Drive upload failed for "${fileName}": ${response.statusText}`,
      statusCode: response.status,
    } as ApiError;
  }

  return response.json();
}

/**
 * Fetches an Onshape part's thumbnail + STL + Parasolid, uploads all three
 * to Drive, and returns the resulting Drive file ids ready to store on the
 * part (avatarID / stlLink / parasolidLink). Each upload is attempted
 * independently - a failure on one (e.g. no STL geometry for this part)
 * doesn't block the others; failed ones come back as null.
 */
export async function syncPartFilesToDrive(
  key: OnshapeKey,
  partID: string,
  partName: string
): Promise<{ avatarID: string | null; stlLink: string | null; parasolidLink: string | null }> {
  const safeName = partName.replace(/[\\/:*?"<>|]/g, "_") || partID;

  const [avatarID, stlLink, parasolidLink] = await Promise.all([
    getOnshapePartThumbnail(key, partID)
      .then((blob) => uploadFileToDrive(blob, `${safeName}-thumbnail.png`))
      .then((r) => r.id)
      .catch(() => null),
    getOnshapePartStl(key, partID)
      .then((blob) => uploadFileToDrive(blob, `${safeName}.stl`))
      .then((r) => r.id)
      .catch(() => null),
    getOnshapePartParasolid(key, partID)
      .then((blob) => uploadFileToDrive(blob, `${safeName}.x_t`))
      .then((r) => r.id)
      .catch(() => null),
  ]);

  return { avatarID, stlLink, parasolidLink };
}

/**
 * Fetches a sub-assembly's Onshape thumbnail and uploads it to Drive,
 * returning the Drive file id ready to store as the BOM's avatarID.
 * Returns null if either step fails (e.g. the assembly has no rendered
 * thumbnail yet) rather than throwing, so it never blocks a publish.
 */
export async function syncBomThumbnailToDrive(key: OnshapeKey, bomName: string): Promise<string | null> {
  const safeName = bomName.replace(/[\\/:*?"<>|]/g, "_") || key.elementID;
  try {
    const blob = await getOnshapeBomThumbnail(key);
    const result = await uploadFileToDrive(blob, `${safeName}-thumbnail.png`);
    return result.id;
  } catch {
    return null;
  }
}
