import type { ColumnConfig } from "../components/Table";
import { downloadFile } from "../util/ApiService";
import type WorkOrderTableRow from "./WorkOrderTableRow";

const WorkOrderColumns: ColumnConfig[] = [
    { key: "avatar", label: "Avatar", type: "image" },
    { key: "name", label: "Name", type: "string" },
    { key: "catalogNumber", label: "Catalog Number", type: "string" },
    { key: "revision", label: "Revision", type: "string" },
    { key: "description", label: "Description", type: "string" },
    { key: "engineer", label: "Engineer", type: "string" },
    { key: "material", label: "Material", type: "string" },
    { key: "mass", label: "Mass", type: "number" },
    { key: "price", label: "Price", type: "number" },
    { key: "quantityTotal", label: "Quantity Total", type: "number" },
    { key: "quantityMade", label: "Quantity Made", type: "number" },
    { key: "statusCode", label: "Status Code", type: "select", options: ['0', '1', '2'] },
    { key: "productionGCOwner", label: "Production G-Code Owner", type: "string" },
    { key: "productionMakingOwner", label: "Production Making Owner", type: "string" },
    { key: "lastUpadate", label: "Last Update", type: "string", isDisabled: () => true },
    { key: "firstAdded", label: "First Added", type: "string", isDisabled: () => true },
    { key: "comments", label: "Comments", type: "string" },
    // { key: "documentID", label: "Onshape Doc ID", type: "string", isDisabled: () => true },
    // { key: "wvmType", label: "WVM Type", type: "string", isDisabled: () => true },
    // { key: "wvmID", label: "WVM ID", type: "string", isDisabled: () => true },
    // { key: "elementID", label: "Element ID", type: "string", isDisabled: () => true },
    // { key: "entityID", label: "Part ID", type: "string", isDisabled: () => true },
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
        onButtonClick: (row: WorkOrderTableRow) => {
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
        onButtonClick: (row: WorkOrderTableRow) => {
            if (row.exportParasolid) {
                const downloadUrl = `http://localhost:5050/api/drive/file/${row.exportParasolid}`;
                downloadFile(downloadUrl, `${row.name || "part"}.parasolid`);
            }
        },
    },
];

export default WorkOrderColumns;
