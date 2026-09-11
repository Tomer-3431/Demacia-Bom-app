import type { ColumnConfig } from "../components/Table";
import { downloadFile } from "../util/ApiService";
import type AssemblyBomRow from "./AssemblyBomRow";

interface BuildColumnsOptions {
  /** Called when the user clicks "Add to DB" on an onshape-only row. */
  onAddToDb: (row: AssemblyBomRow) => void;
  /**
   * Whether the ROOT assembly is already published. Before it is, nothing
   * underneath it can be in the DB either, so every row is edited straight
   * against its live Onshape metadata instead of being locked read-only.
   * Once the root is published, a row is only editable if it's actually in
   * the DB (source === "db") - anything still onshape-only at that point is
   * a genuinely missing child that needs its own "Add to DB" action.
   */
  rootIsPublished: boolean;
}

/**
 * NOTE: for `type: 'button'` columns, Table.tsx enables/disables the button
 * based on the truthiness of `row[col.key]` itself (not `isDisabled`), so
 * button-enabled-ness is controlled by what value we put on the row for
 * that key, not by isDisabled below.
 */
function buildIsReadOnlyRow(rootIsPublished: boolean) {
  return (row: AssemblyBomRow) => (rootIsPublished && row.source === "onshape-only") || row.vendor !== "";
}

export default function buildAssemblyBomColumns({ onAddToDb, rootIsPublished }: BuildColumnsOptions): ColumnConfig[] {
  const isReadOnlyRow = buildIsReadOnlyRow(rootIsPublished);
  return [
    { key: "avatar", label: "Avatar", type: "image", isDisabled: (row) => row.vendor !== ""},
    { key: "name", label: "Name", type: "string", isDisabled: isReadOnlyRow },
    { key: "description", label: "Description", type: "string", isDisabled: isReadOnlyRow },
    { key: "catalogNumber", label: "Catalog No.", type: "string", isDisabled: isReadOnlyRow },
    { key: "revision", label: "Revision", type: "string", isDisabled: isReadOnlyRow },
    { key: "engineer", label: "Engineer", type: "string", isDisabled: isReadOnlyRow },
    { key: "quantity", label: "Quantity", type: "number", isDisabled: () => true },
    { key: "material", label: "Material", type: "string", isDisabled: isReadOnlyRow },
    // Mass is computed by Onshape from geometry + material - never
    // user-settable, so it's always disabled regardless of publish state.
    { key: "mass", label: "Mass", type: "number", isDisabled: () => true },
    { key: "price", label: "Price", type: "number", isDisabled: isReadOnlyRow },
    { key: "comments", label: "Comments", type: "string", isDisabled: isReadOnlyRow },
    {
      key: "onshapeURL",
      label: "Links",
      type: "button",
      buttonText: "Open Onshape",
      isDisabled: (row) => row.vendor !== "",
      onButtonClick: (row: AssemblyBomRow) => {
        if (row.onshapeURL) window.open(row.onshapeURL, "_blank");
      },
    },
    {
      key: "exportSTL",
      label: "Export STL",
      type: "button",
      buttonText: "Download",
      isDisabled: (row) => row.vendor !== "",
      onButtonClick: (row: AssemblyBomRow) => {
        if (row.exportSTL) {
          const downloadUrl = `${import.meta.env.VITE_CLIENT_URL}/api/drive/file/id/${row.exportSTL}`;
          downloadFile(downloadUrl, `${row.name || "part"}.stl`);
        }
      },
    },
    {
      key: "exportParasolid",
      label: "Export Parasolid",
      type: "button",
      buttonText: "Download",
      isDisabled: (row) => row.vendor !== "",
      onButtonClick: (row: AssemblyBomRow) => {
        if (row.exportParasolid) {
          const downloadUrl = `${import.meta.env.VITE_CLIENT_URL}/api/drive/file/id/${row.exportParasolid}`;
          downloadFile(downloadUrl, `${row.name || "part"}.parasolid`);
        }
      },
    },
    {
      // `row.dbAction` is a synthetic field (see AssemblyBomRow) that's only
      // truthy for onshape-only rows, so the button is naturally disabled
      // ("Saved") for rows already in the database. Before the root itself
      // is published, this stays enabled on every row too (nothing can be
      // individually in the DB yet) but clicking it just points the user at
      // publishing the whole assembly instead - see onAddToDb in the page.
      key: "dbAction",
      label: "Database",
      type: "button",
      buttonText: rootIsPublished ? "Add to DB" : "Publish assembly first",
      onButtonClick: (row: AssemblyBomRow) => onAddToDb(row),
    },
    { key: "documentID", label: "Onshape Doc ID", type: "string", isDisabled: () => true },
    { key: "wvmType", label: "WVM Type", type: "string", isDisabled: () => true },
    { key: "wvmID", label: "WVM ID", type: "string", isDisabled: () => true },
    { key: "elementID", label: "Element ID", type: "string", isDisabled: () => true },
    { key: "entityID", label: "BOM/Part ID", type: "string", isDisabled: () => true },
  ];
}
