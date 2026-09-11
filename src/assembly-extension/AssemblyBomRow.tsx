import type BomTableRow from "../Bom/BomTableRow";

/**
 * Where a row's data actually came from:
 *  - "db"           : this Bom/Part exists in our database. Fully editable,
 *                      edits are saved back to both the DB and (best-effort)
 *                      Onshape's own metadata.
 *  - "onshape-only"  : this Bom/Part only exists in Onshape's assembly tree -
 *                      it has never been published. Read-only row; the user
 *                      is prompted to add it (either by publishing the whole
 *                      top-level assembly, or - for a sub-assembly nested
 *                      under an already-published parent - via its own
 *                      "Add to DB" action).
 */
export type BomRowSource = "db" | "onshape-only";

export default interface AssemblyBomRow extends BomTableRow {
  source: BomRowSource;
  /** True for rows that represent a sub-assembly (bom) rather than a part. */
  isAssembly: boolean;
  /**
   * Synthetic field powering the "Add to DB" button column: Table.tsx
   * enables type:'button' columns purely off truthiness of row[col.key], so
   * this is set to a truthy sentinel exactly when source is "onshape-only"
   * and left empty when the row is already saved in the DB.
   */
  dbAction: string;
}
