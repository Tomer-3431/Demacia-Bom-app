/**
 * OnshapeBom.tsx
 * =============================================================================
 * Types + a parser for this server's /api/onshape/bom proxy, which passes
 * through Onshape's raw getBillOfMaterials response untouched (server calls
 * it with indented=true&multiLevel=true).
 *
 * CONFIRMED SHAPE (from a real multiLevel response):
 *   {
 *     formatVersion, id, name, type: "multiLevel", createdAt, templateId,
 *     bomSource: { document, workspace, element, href, viewHref, configuration },
 *     headers: [ { name, propertyName, visible, propertyId }, ... ],
 *     items: [ ... ]
 *   }
 * - NOT wrapped in a `bomTable` key - the response IS the table.
 * - `headers` exists, but items do NOT use a headerIdToValue map - each
 *   item stores its column values as plain top-level properties, keyed by
 *   the header's `propertyName` (e.g. item.name, item.quantity,
 *   item.partNumber). `headers` is really just display metadata (label +
 *   visibility + ordering), not required to read a value.
 * - Sub-assemblies are NOT flagged with any boolean field. The reliable
 *   signal is `item.item`, the indented item number Onshape assigns:
 *     "1"    -> a top-level sub-assembly
 *     "1.1"  -> a part nested one level inside item "1"
 *     "1.2"  -> another part nested inside item "1"
 *     "2"    -> a top-level part (no children follow with "2.x")
 *   A row is a sub-assembly if and only if some other row's `item` starts
 *   with "<thisItem>.". This requires looking at the whole items array
 *   together, not one row in isolation - see `parseOnshapeBomTable` below.
 * - `material` is an object ({ id, displayName, libraryName, ... }) rather
 *   than a plain string.
 */

export interface OnshapeBomItemSource {
  documentId: string;
  elementId: string;
  wvmId: string;
  wvmType: string;
  /** Present (non-empty) for a Part row; empty/absent for a sub-assembly row. */
  partId?: string;
  configuration?: string;
  fullConfiguration?: string;
  indentLevel?: number;
  rowId?: string;
  viewHref?: string;
}

export interface OnshapeBomMaterial {
  id?: string;
  displayName?: string;
  libraryName?: string;
}

/** One raw item as this server's /onshape/bom proxy actually returns it.
 *  Loosely typed on purpose - the table has user-configured columns (some
 *  keyed by raw property ids, some by non-English display names) that this
 *  app doesn't need individually. */
export interface OnshapeBomItem {
  itemSource: OnshapeBomItemSource;
  /** Indented item number, e.g. "1", "1.1", "1.2", "2" - this is what tells
   *  us which rows are sub-assemblies and which rows are nested under them. */
  item: string;
  name?: string;
  description?: string;
  partNumber?: string;
  revision?: string;
  quantity?: number | string;
  comments?: string;
  material?: OnshapeBomMaterial | string;
  vendor?: string;
  [otherProperty: string]: unknown;
}

export interface OnshapeBomHeader {
  name: string;
  propertyName: string;
  visible: boolean;
  propertyId: string;
}

/** The response shape as the server actually returns it - no `bomTable` wrapper. */
export interface OnshapeBomTable {
  id: string;
  name: string;
  type?: string;
  description?: string;
  partNumber?: string;
  headers: OnshapeBomHeader[];
  items: OnshapeBomItem[];
  bomSource?: {
    element?: {
      vendor?: string
    }
  }
}

/** Normalized, easy-to-consume row pulled out of one raw Onshape BOM item. */
export interface ParsedOnshapeBomRow {
  itemSource: OnshapeBomItemSource;
  /** The raw indented item number, e.g. "1", "1.1", "2". Kept around so
   *  nested children can be matched back to their parent row. */
  itemNumber: string;
  isSubassembly: boolean;
  name: string;
  description: string;
  partNumber: string;
  revision: string;
  quantity: number;
  material: string;
  vendor: string;
}

function materialToString(material: OnshapeBomItem["material"]): string {
  if (!material) return "";
  if (typeof material === "string") return material;
  return material.displayName || material.id || "";
}

function toParsedRow(item: OnshapeBomItem, isSubassembly: boolean): ParsedOnshapeBomRow {
  const quantityRaw = item.quantity;
  const quantity =
    typeof quantityRaw === "number" ? quantityRaw : quantityRaw ? Number(quantityRaw) || 1 : 1;

  return {
    itemSource: item.itemSource,
    itemNumber: item.item || "",
    isSubassembly,
    name: item.name || "",
    description: item.description || "",
    partNumber: item.partNumber || "",
    revision: item.revision || "",
    quantity,
    material: materialToString(item.material),
    vendor: item.vendor || "",
  };
}

/**
 * Returns the DIRECT top-level rows of one BOM table - i.e. rows whose
 * `item` number has no dot (like "1" or "2"), not anything nested under a
 * sub-assembly (like "1.1"). A top-level row is a sub-assembly if some
 * OTHER row's item number is "<thisNumber>.something" - Onshape doesn't
 * mark this with a boolean field, so it has to be inferred from the
 * indented numbering across the whole items array.
 *
 * This deliberately ignores rows nested more than one level deep in the
 * SAME response (e.g. "1.1.2"): AssemblyBomPage re-fetches a fresh,
 * node-scoped BOM for every sub-assembly it recurses into, so each call to
 * this function only ever needs to describe the immediate children of
 * whichever assembly was queried - Onshape returns that assembly's own
 * contents at the top level ("1", "2", ...) with any further nesting
 * belonging to a sub-assembly's own separate fetch.
 */
export function parseOnshapeBomTable(table: OnshapeBomTable): ParsedOnshapeBomRow[] {
  const items = Array.isArray(table?.items) ? table.items : [];

  const topLevel = items.filter((it) => !!it.item && !it.item.includes("."));
  const hasChildren = (itemNumber: string) =>
    items.some((it) => it.item && it.item.startsWith(`${itemNumber}.`));

  return topLevel.map((item) => toParsedRow(item, hasChildren(item.item)));
}
