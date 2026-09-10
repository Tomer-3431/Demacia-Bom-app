import type { ColumnConfig } from "../components/Table";
import { downloadFile } from "../util/ApiService";
import type BomTableRow from "./BomTableRow";

const BomColumns: ColumnConfig[] = [
  { key: "avatar", label: "Avatar", type: "image" },
  { key: "name", label: "Name", type: "string" },
  { key: "description", label: "Description", type: "string" },
  { key: "catalogNumber", label: "Catalog No.", type: "string" },
  { key: "revision", label: "Revision", type: "string" },
  { key: "engineer", label: "Engineer", type: "string" },
  { key: "quantity", label: "Quantity", type: "number", isDisabled: () => true },
  { key: "material", label: "Material", type: "string" },
  { key: "mass", label: "Mass", type: "number" },
  { key: "price", label: "Price", type: "number" },
  { key: "comments", label: "Comments", type: "string" },
  // Onshape ID Columns (Disabled)
  // { key: "documentID", label: "Onshape Doc ID", type: "string", isDisabled: () => true },
  // { key: "wvmType", label: "WVM Type", type: "string", isDisabled: () => true },
  // { key: "wvmID", label: "WVM ID", type: "string", isDisabled: () => true },
  // { key: "elementID", label: "Element ID", type: "string", isDisabled: () => true },
  // { key: "entityID", label: "BOM/Part ID", type: "string", isDisabled: () => true },
  // External Link Action (Disabled Property)
  {
    key: "onshapeURL",
    label: "Links",
    type: "button",
    buttonText: "Open CAD",
    isDisabled: () => true,
    onButtonClick: (row) => {
      if (row.onshapeURL) window.open(row.onshapeURL, "_blank");
    },
  },
  // Export File Action (Disabled Property)
  {
    key: "exportSTL",
    label: "Export STL",
    type: "button",
    buttonText: "Download",
    isDisabled: () => true,
    onButtonClick: (row: BomTableRow) => {
      if (row.exportSTL) {
        const downloadUrl = `http://localhost:5050/api/drive/file/${row.exportSTL}`;
        downloadFile(downloadUrl, `${row.name || "part"}.stl`);
      }
    },
  },
  {
    key: "exportParasolid",
    label: "Export Parasolid",
    type: "button",
    buttonText: "Download",
    isDisabled: () => true,
    onButtonClick: (row: BomTableRow) => {
      if (row.exportParasolid) {
        const downloadUrl = `http://localhost:5050/api/drive/file/${row.exportParasolid}`;
        downloadFile(downloadUrl, `${row.name || "part"}.parasolid`);
      }
    },
  },
];

export default BomColumns;
