/**
 * Onshape API client, using real calls to the Onshape REST API
 * (Glassworks: https://cad.onshape.com/glassworks/explorer/).
 *
 * Authenticated with HTTP Basic Auth using ONSHAPE_ACCESS_KEY /
 * ONSHAPE_SECRET_KEY (base64 of "accessKey:secretKey"). This is the
 * "Basic Authorization" scheme documented at
 * https://onshape-public.github.io/docs/auth/apikeys/ — sufficient for
 * server-to-server/personal use. Onshape requires OAuth2 instead for
 * anything distributed via the App Store.
 *
 * Docs use "wvm" to mean workspace/version/microversion — wvmType is
 * one of 'w' | 'v' | 'm', and wvmID is the corresponding ID.
 *
 * IMPORTANT — mapping notes vs. a generic CRUD service:
 * Onshape parts and BOMs are not freestanding editable records the way
 * DB rows are:
 *   - A "part" is geometry derived from a Part Studio's features. There
 *     is no generic "update a part" or "delete a part" endpoint. What
 *     Onshape does expose is PART METADATA (name, description, part
 *     number, custom properties) via the Metadata endpoints, so
 *     updatePart() below updates metadata, not geometry. There is no
 *     delete-a-part endpoint at all; deletePart() throws rather than
 *     pretending to succeed.
 *   - A BOM is a read-only, generated export of an assembly's structure
 *     (getBillOfMaterials). There's no endpoint to "update" or "delete"
 *     a BOM as a resource — the BOM changes when the assembly does.
 *     updateBom()/deleteBom() throw for the same reason.
 *
 * VERSION NUMBER CAVEAT: Onshape versions each endpoint independently
 * (v9, v10, v12, v14, etc., bumped only when that specific endpoint
 * changes) rather than versioning the whole API together. The version
 * numbers below are accurate as of the current published docs for each
 * endpoint (metadata: v10, assemblies/BOM: v9) — reconfirm against the
 * API Explorer (https://cad.onshape.com/glassworks/explorer/) if a call
 * starts returning 404s, since Onshape does bump these over time.
 */
import "dotenv/config";

const ONSHAPE_BASE_URL =
  process.env.ONSHAPE_BASE_URL || "https://cad.onshape.com/api";

export interface OnshapePartRef {
  documentID: string;
  wvmType: string; // 'w' | 'v' | 'm'
  wvmID: string;
  elementID: string;
  partID: string;
}

export interface OnshapeBomRef {
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
}

/**
 * Onshape metadata `valueType` enum. Confirmed against the Onshape Java
 * client's field docs (com.onshape.api.responses — Metadata* classes):
 * 0:STRING, 1:BOOL, 2:INT, 3:DOUBLE, 4:DATE, 5:ENUM, 6:OBJECT, 7:BLOB, 8:USER.
 * The GET metadata endpoints return this as the string name (e.g. "STRING"),
 * matching the worked example in the Onshape metadata docs
 * (https://onshape-public.github.io/docs/api-adv/metadata/); the numeric
 * form appears in some schema-management endpoints instead.
 */
export type OnshapeValueType =
  | "STRING"
  | "BOOL"
  | "INT"
  | "DOUBLE"
  | "DATE"
  | "ENUM"
  | "OBJECT"
  | "BLOB"
  | "USER";

/**
 * Onshape metadata object type enum (what kind of thing a property
 * applies to). Confirmed against the Java client docs:
 * 0:GLOBAL, 1:DOCUMENT, 2:PART, 3:ASSEMBLY, 4:DRAWING, 5:PART_STUDIO,
 * 6:BLOB_ELEMENT, 7:APP_ELEMENT, 8:VERSION, 9:WORKSPACE.
 */
export type OnshapeMetadataObjectType =
  | 0 // GLOBAL
  | 1 // DOCUMENT
  | 2 // PART
  | 3 // ASSEMBLY
  | 4 // DRAWING
  | 5 // PART_STUDIO
  | 6 // BLOB_ELEMENT
  | 7 // APP_ELEMENT
  | 8 // VERSION
  | 9; // WORKSPACE

/**
 * Property publish state, confirmed against the Java client docs:
 * 0:PENDING, 1:ACTIVE, 2:INACTIVE.
 */
export type OnshapePublishState = 0 | 1 | 2;

/** One option in an ENUM-typed property's allowed values. */
export interface OnshapeEnumValue {
  value: string;
  label?: string;
  [key: string]: unknown;
}

/**
 * Validation constraints on a property's value, confirmed against the
 * Java client's MetadataGetPropertyInfoResponsePropertyConfigInfoList
 * field docs and the worked example in the metadata guide.
 */
export interface OnshapePropertyValidator {
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  pattern?: string | null;
}

/** UI display hints for a property, seen in the forum-confirmed request body example. */
export interface OnshapePropertyUiHints {
  multiline?: boolean;
  [key: string]: unknown;
}

/**
 * A single metadata property on a part, element, or document, as
 * returned by GET .../metadata/... and sent (a subset of these fields)
 * to POST .../metadata/....
 *
 * Field list cross-confirmed from three sources: the worked example on
 * https://onshape-public.github.io/docs/api-adv/metadata/, a real
 * request-body dump posted on the Onshape forum
 * (forum.onshape.com/discussion/11468), and the Java client's per-field
 * docs (onshape-public.github.io/java-client).
 *
 * `value` and `defaultValue` are intentionally left as `unknown` rather
 * than narrowed to `OnshapeValueType`, because their concrete shape
 * depends on this same property's `valueType` at runtime (e.g. a STRING
 * property's value is a string, an OBJECT property's — such as
 * Material — is itself a nested object per the forum thread on setting
 * a part's material). TypeScript can't express that correlation without
 * a discriminated union keyed on a value that only exists at runtime.
 */
export interface OnshapeMetadataProperty {
  propertyId: string;
  name?: string;
  description?: string;
  schemaId?: string;
  namespace?: string;
  value: unknown;
  defaultValue?: unknown;
  valueType?: OnshapeValueType;
  enumValues?: OnshapeEnumValue[] | null;
  validator?: OnshapePropertyValidator;
  uiHints?: OnshapePropertyUiHints;
  required?: boolean;
  editable?: boolean;
  editableInUi?: boolean;
  multivalued?: boolean;
  dateFormat?: string | null;
  /**
   * Origin of the property's current value. Onshape's docs don't
   * publish a name-to-number mapping for this field (unlike valueType/
   * objectType/publishState, which the Java client docs do spell out),
   * so it's kept as a raw number rather than a guessed enum.
   */
  propertySource?: number;
  computedProperty?: boolean;
  computedAssemblyProperty?: boolean;
  computedPropertyError?: string | null;
  propertyOverrideStatus?: number;
  [key: string]: unknown;
}

export interface OnshapePartMetadata {
  jsonType?: string;
  partId?: string;
  elementId?: string;
  properties: OnshapeMetadataProperty[];
  [key: string]: unknown;
}

/**
 * One row of a bill of materials, confirmed against the Java client's
 * AssembliesGetBillOfMaterialsResponseBomTableItems docs. Onshape's BOM
 * rows are column-driven (the actual displayed columns depend on the
 * document's BOM template), so most per-row data lives in
 * `headerIdToValue` keyed by column/header ID rather than as fixed
 * named fields — hence the index signature there rather than a flat
 * field list.
 */
export interface OnshapeBomTableItem {
  id?: string;
  itemSource?: {
    documentId?: string;
    elementId?: string;
    partId?: string;
    [key: string]: unknown;
  };
  headerIdToValue?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Identifies the document/element/version a BOM was generated from. */
export interface OnshapeBomSource {
  documentId?: string;
  elementId?: string;
  version?: {
    versionId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OnshapeBomTable {
  bomSource?: OnshapeBomSource;
  items?: OnshapeBomTableItem[];
  [key: string]: unknown;
}

export interface OnshapeBillOfMaterials {
  bomTable?: OnshapeBomTable;
  [key: string]: unknown;
}

export interface OnshapeElementMetadata {
  jsonType?: string;
  elementId?: string;
  elementType?: number;
  mimeType?: string;
  properties: OnshapeMetadataProperty[];
  [key: string]: unknown;
}

/** Thrown when the caller asks for an Onshape operation that has no REST equivalent. */
export class UnsupportedOnshapeOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedOnshapeOperationError";
  }
}

/** Thrown when Onshape returns a non-2xx response. Carries the status for the caller to map to an HTTP response. */
export class OnshapeApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "OnshapeApiError";
    this.status = status;
    this.body = body;
  }
}

function getCredentials(): { accessKey: string; secretKey: string } {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY must be set. Copy .env.example to .env and fill them in.",
    );
  }
  return { accessKey, secretKey };
}

function authHeader(): string {
  const { accessKey, secretKey } = getCredentials();
  const token = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
  return `Basic ${token}`;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${ONSHAPE_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Low-level request helper shared by every call in this service.
 * Throws OnshapeApiError on any non-2xx response so controllers can
 * translate it to an appropriate HTTP status (see onshapeController.ts).
 */
async function onshapeRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = options;
  const url = buildUrl(path, query);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json;charset=UTF-8; qs=0.09",
      "Content-Type": "application/json;charset=UTF-8; qs=0.09",
      Authorization: authHeader(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new OnshapeApiError(
      `Onshape API request failed: ${method} ${path} -> ${response.status}`,
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

/**
 * GET /api/onshape/ — lightweight connectivity check.
 * Hits the current user's session info, a cheap authenticated endpoint,
 * to confirm the configured credentials are valid and Onshape is reachable.
 */
async function checkConnection(): Promise<boolean> {
  try {
    await onshapeRequest("/users/sessioninfo");
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps this app's PartModel field names to the Onshape metadata propertyId
 * that field is sourced from/written to. These ids are specific to this
 * document's BOM template/schema (Onshape propertyIds are per-document, not
 * global) - confirmed against a real part metadata response.
 *
 * Fields intentionally NOT in this map are not backed by a writable Onshape
 * metadata property, or aren't something a user edit should ever send:
 *   - mass: COMPUTED by Onshape from geometry + material (computedProperty:
 *     true in the real response) - not user-settable, so callers should
 *     disable editing it entirely rather than including it in an update.
 *   - id, quantity, onshapeURL, onshapeID, stlLink, parasolidLink, avatarID:
 *     not Onshape metadata properties at all (ids/links/exports/Drive file
 *     references), so there's nothing to map them to here.
 */
export const PART_PROPERTY_ID_MAP: Record<string, string> = {
  name: "57f3fb8efa3416c06701d60d",
  catalogNumber: "57f3fb8efa3416c06701d60f",
  revision: "57f3fb8efa3416c06701d610",
  description: "57f3fb8efa3416c06701d60e",
  engineer: "57f3fb8efa3416c06701d619",
  material: "57f3fb8efa3416c06701d615",
  price: "6617a03ef812b159a51a8786",
  comments: "66154a7f56997c7041994212",
  vendor: "57f3fb8efa3416c06701d612",
};

/**
 * Reads a raw Onshape metadata property's `value` into the plain type this
 * app's PartModel field expects. Most properties are already the right
 * shape (STRING valueType -> value is already a string), but a few have
 * Onshape-specific nested object shapes that need to be flattened:
 *   - material: value is an object ({ id, displayName, libraryName, ... })
 *     mirroring Onshape's own Material Library schema - PartModel only
 *     wants the display name (e.g. "ABS"), not the whole object.
 */
function readPropertyValue(fieldName: string, rawValue: unknown): unknown {
  if (fieldName === "material") {
    if (rawValue && typeof rawValue === "object") {
      return (
        (rawValue as { displayName?: string; id?: string }).displayName ?? ""
      );
    }
    return typeof rawValue === "string" ? rawValue : "";
  }
  return rawValue ?? "";
}

/**
 * Maps this app's PartModel field names to the values Onshape currently has
 * for that part, reading through PART_PROPERTY_ID_MAP. Only returns the
 * fields that exist in the map (name, catalogNumber, revision, description,
 * engineer, material, price, comments) - callers merge this with whatever
 * else PartModel needs (id, quantity, links, Drive file ids) themselves.
 */
function mapPartMetadataToModel(
  metadata: OnshapePartMetadata,
): Record<string, unknown> {
  const byPropertyId = new Map(
    metadata.properties.map((p) => [p.propertyId, p]),
  );
  const result: Record<string, unknown> = {};

  for (const [fieldName, propertyId] of Object.entries(PART_PROPERTY_ID_MAP)) {
    const property = byPropertyId.get(propertyId);
    result[fieldName] = readPropertyValue(fieldName, property?.value);
  }

  return result;
}

/**
 * Gets a part's metadata (name, description, part number, custom
 * properties) — this is the closest REST equivalent to "get a part".
 * Endpoint: GET v10/metadata/d/{did}/{wvmType}/{wvmID}/e/{eid}/p/{pid}
 */
async function getPart(ref: OnshapePartRef): Promise<OnshapePartMetadata> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;
  return onshapeRequest<OnshapePartMetadata>(
    `/metadata/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/p/${partID}`,
  );
}

/**
 * Gets a part's metadata already mapped into this app's PartModel field
 * names (name, catalogNumber, revision, description, engineer, material,
 * price, comments), using PART_PROPERTY_ID_MAP rather than the raw Onshape
 * properties array. This is the function to use when syncing a part INTO
 * the database - getPart() above is the raw passthrough for anything that
 * needs the full Onshape response instead (e.g. resolving other
 * propertyIds not in the map, or reading validator/enum metadata).
 */
async function getPartForDb(
  ref: OnshapePartRef,
): Promise<Record<string, unknown>> {
  const metadata = await getPart(ref);
  return mapPartMetadataToModel(metadata);
}

/**
 * Updates a part's metadata properties. Accepts either the raw Onshape
 * request shape ({ properties: [{ propertyId, value }] }) or a flat
 * { [propertyName]: value } map resolved against the part's current
 * metadata (so callers don't have to know propertyIds up front).
 * Endpoint: POST v10/metadata/d/{did}/{wvmType}/{wvmID}/e/{eid}/p/{pid}
 */
async function updatePart(
  ref: OnshapePartRef,
  data:
    | { properties: Array<{ propertyId: string; value: unknown }> }
    | Record<string, unknown>,
): Promise<OnshapePartMetadata> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;
  const path = `/metadata/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/p/${partID}`;

  let properties: Array<{ propertyId: string; value: unknown }>;

  if (
    "properties" in data &&
    Array.isArray((data as { properties: unknown }).properties)
  ) {
    properties = (
      data as { properties: Array<{ propertyId: string; value: unknown }> }
    ).properties;
  } else {
    properties = Object.entries(data as Record<string, unknown>)
      .map(([fieldName, value]) => {
        const propertyId = PART_PROPERTY_ID_MAP[fieldName];
        if (!propertyId) return null;
        // material is read from an object but Onshape material assignment
        // isn't writable through the plain-value update path (see the
        // forum-confirmed caveat in the file header) - skip it rather than
        // send a string where Onshape expects its own material schema.
        if (fieldName === 'material') return null;
        return { propertyId, value };
      })
      .filter((p): p is { propertyId: string; value: unknown } => p !== null);

    if (properties.length === 0) {
      throw new Error(
        `None of the provided fields have a known Onshape propertyId mapping: ${Object.keys(
          data as Record<string, unknown>,
        ).join(", ")}. See PART_PROPERTY_ID_MAPחל`,
      );
    }
  }

  return onshapeRequest<OnshapePartMetadata>(path, {
    method: "POST",
    body: { jsonType: "metadata-part", partId: partID, properties },
  });
}

/**
 * Gets an assembly's own element metadata (name, description, and any
 * other custom properties configured on the element itself). An assembly
 * is just an element in Onshape's model, so this is the same Metadata
 * endpoint used for any element/tab — there is no assembly- or
 * BOM-specific metadata endpoint.
 * Endpoint: GET v10/metadata/d/{did}/{wvmType}/{wvmID}/e/{eid}
 */
async function getAssembly(
  ref: OnshapeBomRef,
): Promise<OnshapeElementMetadata> {
  const { documentID, wvmType, wvmID, elementID } = ref;
  return onshapeRequest<OnshapeElementMetadata>(
    `/metadata/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}`,
  );
}

/**
 * Updates an assembly's own element metadata properties (e.g. its tab
 * name, description). Accepts either the raw Onshape request shape
 * ({ properties: [{ propertyId, value }] }) or a flat
 * { [propertyName]: value } map resolved against the element's current
 * metadata (so callers don't have to know propertyIds up front) — same
 * two-shape convention as updatePart().
 *
 * IMPORTANT — this updates the ASSEMBLY ELEMENT, not the BOM: Onshape has
 * no endpoint to write BOM table data directly (see the file header). A
 * BOM's displayed "Name"/"Description" columns for a sub-assembly row are
 * generally sourced from that sub-assembly's own element metadata, so
 * updating it here is the correct way to change what the BOM shows for it
 * — but true BOM-table-only columns (ones with no backing element
 * property) can't be written this way and will simply not match any
 * property name below.
 * Endpoint: POST v10/metadata/d/{did}/{wvmType}/{wvmID}/e/{eid}
 */
async function updateAssembly(
  ref: OnshapeBomRef,
  data:
    | { properties: Array<{ propertyId: string; value: unknown }> }
    | Record<string, unknown>,
): Promise<OnshapeElementMetadata> {
  const { documentID, wvmType, wvmID, elementID } = ref;
  const path = `/metadata/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}`;

  let properties: Array<{ propertyId: string; value: unknown }>;

  if (
    "properties" in data &&
    Array.isArray((data as { properties: unknown }).properties)
  ) {
    properties = (
      data as { properties: Array<{ propertyId: string; value: unknown }> }
    ).properties;
  } else {
    // Resolve friendly property names (e.g. "Name", "Description") to
    // propertyIds by reading current metadata first, matching the workflow
    // documented at https://onshape-public.github.io/docs/api-adv/metadata/
    const current = await getAssembly(ref);
    properties = Object.entries(data as Record<string, unknown>)
      .map(([name, value]) => {
        const match = current.properties.find(
          (p) => p.name?.toLowerCase() === name.toLowerCase(),
        );
        return match ? { propertyId: match.propertyId, value } : null;
      })
      .filter((p): p is { propertyId: string; value: unknown } => p !== null);

    if (properties.length === 0) {
      throw new Error(
        `None of the provided property names matched this assembly's metadata properties: ${Object.keys(
          data as Record<string, unknown>,
        ).join(", ")}`,
      );
    }
  }

  return onshapeRequest<OnshapeElementMetadata>(path, {
    method: "POST",
    body: { properties },
  });
}

/**
 * Gets the bill of materials for an assembly.
 * Endpoint: GET v9/assemblies/d/{did}/{wvmType}/{wvmID}/e/{eid}/bom
 * multiLevel=true returns the full nested BOM (recommended over calling
 * per-subassembly); indented=false returns a flat parts list instead of
 * an indented hierarchy.
 */
async function getBom(
  ref: OnshapeBomRef,
  options: { multiLevel?: boolean; indented?: boolean } = {},
): Promise<OnshapeBillOfMaterials> {
  const { documentID, wvmType, wvmID, elementID } = ref;

  return onshapeRequest<OnshapeBillOfMaterials>(
    `/assemblies/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/bom`,
    { query: { multiLevel: true, indented: true } },
  );
}

/**
 * Helper function for binary HTTP requests to Onshape API.
 * Returns raw file data or image payload directly in its Buffer (blob) form.
 *
 * IMPORTANT: A few endpoints (STL/Parasolid part export in particular)
 * respond with a 307 redirect to a separate Onshape "modeling server"
 * host rather than the file itself — see the Java client docs for
 * exportStl ("returns a 307 redirect") and
 * https://forum.onshape.com/discussion/12415/. Fetch's default
 * `redirect: 'follow'` behavior strips the Authorization header when
 * following a cross-origin redirect (per the Fetch spec), so the
 * modeling server then correctly rejects the now-unauthenticated
 * request with 401. We work around this by following redirects
 * manually and re-attaching the Authorization header ourselves.
 */
async function onshapeRequestBuffer(
  path: string,
  options: RequestOptions = {},
): Promise<Buffer> {
  const { method = "GET", body, query } = options;
  let url = buildUrl(path, query);

  // Cap redirect hops as a safety net against loops.
  for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "*/*",
        ...(body !== undefined
          ? { "Content-Type": "application/json;charset=UTF-8" }
          : {}),
        Authorization: authHeader(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });

    // Manually follow redirects (307/302/etc.) so we can re-send the
    // Authorization header, which fetch would otherwise drop.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new OnshapeApiError(
          `Onshape API binary request redirected without a Location header: ${method} ${path} -> ${response.status}`,
          response.status,
          undefined,
        );
      }
      url = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {}
      throw new OnshapeApiError(
        `Onshape API binary request failed: ${method} ${path} -> ${response.status}`,
        response.status,
        parsed,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new OnshapeApiError(
    `Onshape API binary request exceeded max redirects: ${method} ${path}`,
    310,
    undefined,
  );
}

/**
 * Automatically inspects PNG or JPEG header bytes to determine image width and height.
 */
function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  // Check PNG magic bytes: 0x89 0x50 0x4E 0x47
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // Check JPEG magic bytes: 0xFF 0xD8
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      const blockLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + blockLength;
    }
  }

  return { width: 300, height: 300 };
}

/**
 * Gets a thumbnail image for an element as a binary Buffer.
 * Endpoint: GET v10/thumbnails/d/{did}/{wvmType}/{wvmID}/e/{eid}/s/{size}
 * Default size: '300x300' (supported sizes include '70x70', '300x300', '600x600').
 */
async function getElementThumbnail(
  ref: OnshapeBomRef,
  size: string = "300x300",
): Promise<Buffer> {
  const { documentID, wvmType, wvmID, elementID } = ref;
  return onshapeRequestBuffer(
    `/thumbnails/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/s/${size}`,
  );
}

/**
 * Gets a thumbnail image for a specific part as a binary Buffer.
 * Endpoint: GET v10/thumbnails/d/{did}/{wvmType}/{wvmID}/e/{eid}/p/{pid}/s/{size}
 * Default size: '300x300'.
 */
async function getPartThumbnail(
  ref: OnshapePartRef,
  size: string = "300x300",
): Promise<Buffer> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;
  return onshapeRequestBuffer(
    `/thumbnails/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/p/${partID}/s/${size}`,
  );
}

/**
 * Sets a custom thumbnail for an element.
 * Automatically extracts image dimensions from the provided image buffer.
 * Endpoint: POST v10/thumbnails/d/{did}/w/{wid}/e/{eid}
 */
async function setElementThumbnail(
  ref: OnshapeBomRef,
  imageBuffer: Buffer,
  mimeType: string = "image/png",
): Promise<void> {
  const { documentID, wvmID, wvmType, elementID } = ref;
  const { width, height } = getImageDimensions(imageBuffer);
  const base64Image = imageBuffer.toString("base64");

  await onshapeRequest(
    `/thumbnails/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}`,
    {
      method: "POST",
      body: {
        base64EncodedImage: base64Image,
        mimeType,
        size: `${width}x${height}`,
        imageWidth: width,
        imageHeight: height,
      },
    },
  );
}

/**
 * Sets a custom thumbnail for a part.
 * Automatically extracts image dimensions from the provided image buffer.
 * Endpoint: POST v10/thumbnails/d/{did}/w/{wid}/e/{eid}/p/{pid}
 */
async function setPartThumbnail(
  ref: OnshapePartRef,
  imageBuffer: Buffer,
  mimeType: string = "image/png",
): Promise<void> {
  const { documentID, wvmID, wvmType, elementID, partID } = ref;
  const { width, height } = getImageDimensions(imageBuffer);
  const base64Image = imageBuffer.toString("base64");

  await onshapeRequest(
    `/thumbnails/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/p/${partID}`,
    {
      method: "POST",
      body: {
        base64EncodedImage: base64Image,
        mimeType,
        size: `${width}x${height}`,
        imageWidth: width,
        imageHeight: height,
      },
    },
  );
}

/**
 * Exports a part to STL format and returns the binary STL payload directly.
 * Endpoint: GET v10/parts/d/{did}/{wvmType}/{wvmID}/e/{eid}/partid/{pid}/stl
 */
async function exportPartToStl(
  ref: OnshapePartRef,
  options: { units?: string; mode?: "ascii" | "binary" } = {},
): Promise<Buffer> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;
  const { units = "meter", mode = "binary" } = options;

  return onshapeRequestBuffer(
    `/parts/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/partid/${partID}/stl`,
    { query: { units, mode } },
  );
}

/**
 * Exports a part to Parasolid format (.x_t / .x_b) and returns the binary file payload directly.
 * Endpoint: GET v10/parts/d/{did}/{wvmType}/{wvmID}/e/{eid}/partid/{pid}/parasolid
 */
async function exportPartToParasolid(
  ref: OnshapePartRef,
  options: { version?: number } = {},
): Promise<Buffer> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;

  return onshapeRequestBuffer(
    `/parts/d/${documentID}/${wvmType}/${wvmID}/e/${elementID}/partid/${partID}/parasolid`,
    { query: options },
  );
}

/**
 * Exports a part to SolidWorks (.sldprt) format via Onshape's Translation API
 * and returns the resulting file payload directly as a Buffer.
 * Endpoint: POST v10/translations/d/{did}/{wvmType}/{wvmID}
 */
async function exportPartToSolidworks(ref: OnshapePartRef): Promise<Buffer> {
  const { documentID, wvmType, wvmID, elementID, partID } = ref;

  const translation = await onshapeRequest<{
    id: string;
    requestState: string;
  }>(`/translations/d/${documentID}/${wvmType}/${wvmID}`, {
    method: "POST",
    body: {
      formatName: "SOLIDWORKS",
      elementId: elementID,
      partIds: partID,
      storeInDocument: false,
    },
  });

  let state = translation.requestState;
  const translationId = translation.id;

  while (state === "ACTIVE" || state === "PENDING") {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await onshapeRequest<{ requestState: string }>(
      `/translations/${translationId}`,
    );
    state = status.requestState;
    if (state === "FAILED") {
      throw new Error(
        `Onshape SolidWorks translation failed for part ${partID}`,
      );
    }
  }

  return onshapeRequestBuffer(`/translations/${translationId}/download`);
}

export default {
  checkConnection,
  getPart,
  getPartForDb,
  updatePart,
  getBom,
  getAssembly,
  updateAssembly,
  getElementThumbnail,
  getPartThumbnail,
  setElementThumbnail,
  setPartThumbnail,
  exportPartToStl,
  exportPartToParasolid,
  exportPartToSolidworks,
};
