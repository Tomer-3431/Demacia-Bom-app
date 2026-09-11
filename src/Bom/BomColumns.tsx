import type { ColumnConfig } from "../components/Table";
import { downloadFile } from "../util/ApiService";
import type BomTableRow from "./BomTableRow";

const BomColumns: ColumnConfig[] = [
  { key: "avatar", label: "Avatar", type: "image", isDisabled: (row) => row.vendor !== "" },
  { key: "name", label: "Name", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "description", label: "Description", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "catalogNumber", label: "Catalog No.", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "revision", label: "Revision", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "engineer", label: "Engineer", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "quantity", label: "Quantity", type: "number", isDisabled: () => true },
  { key: "material", label: "Material", type: "string", isDisabled: (row) => row.vendor !== "" },
  { key: "mass", label: "Mass", type: "number", isDisabled: (row) => row.vendor !== "" },
  { key: "price", label: "Price", type: "number", isDisabled: (row) => row.vendor !== "" },
  { key: "comments", label: "Comments", type: "string", isDisabled: (row) => row.vendor !== "" },
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
    buttonText: "Open Onshape",
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
        const downloadUrl = `http://localhost:5050/api/drive/file/id/${row.exportSTL}`;
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
        const downloadUrl = `http://localhost:5050/api/drive/file/id/${row.exportParasolid}`;
        downloadFile(downloadUrl, `${row.name || "part"}.parasolid`);
      }
    },
  },
];

export default BomColumns;
