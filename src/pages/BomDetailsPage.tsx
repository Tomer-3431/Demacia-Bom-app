import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Table, type ColumnConfig, type RowData } from "../components/Table";
import { downloadFile, fetchFromApi, type ApiError } from "../services/api";

interface OnshapeID {
  documentID?: string;
  wvmType?: string;
  wvmID?: string;
  elementID?: string;
  bomID?: string;
  partID?: string;
}

interface BomModel {
  id: string;
  name?: string;
  catalogNumber?: string;
  engineer?: string;
  comments?: string;
  onshapeURL?: string;
  onshapeID?: OnshapeID;
  parts: { partID: string; quantity: number }[];
  subAssemblies: { bomID: string; quantity: number }[];
}

interface PartModel {
  id: string;
  name?: string;
  catalogNumber?: string;
  revision?: string;
  description?: string;
  engineer?: string;
  material?: string;
  mass?: number;
  price?: number;
  comments?: string;
  onshapeURL?: string;
  stlLink?: string;
  parasolidLink?: string;
  onshapeID?: OnshapeID;
}

interface TableRow extends RowData {
  name: string;
  catalogNumber: string;
  revision: string;
  description: string;
  engineer: string;
  material: string;
  mass: number;
  price: number;
  quantity: number;
  comments: string;
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
  entityID: string;
  onshapeURL: string;
  exportFileID: string;
}

export default function BomDetailsPage() {
  const { bomId } = useParams<{ bomId: string }>();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!bomId) return;

    const visitedBoms = new Set<string>();

    async function fetchBomRecursively(
      targetBomId: string,
      parentId: string | null = null
    ): Promise<TableRow[]> {
      if (visitedBoms.has(targetBomId)) return [];
      visitedBoms.add(targetBomId);

      const bom = await fetchFromApi<BomModel>(`/db/bom/id/${targetBomId}`);
      const currentAssemblyRowId = `${parentId ? parentId + "-" : ""}${bom.id}`;

      const assemblyRow: TableRow = {
        id: currentAssemblyRowId,
        parentId: parentId,
        isExpanded: true,
        name: bom.name || targetBomId,
        catalogNumber: bom.catalogNumber || "",
        revision: "-",
        description: "",
        engineer: bom.engineer || "",
        material: "-",
        mass: 0,
        price: 0,
        quantity: 1,
        comments: bom.comments || "",
        documentID: bom.onshapeID?.documentID || "",
        wvmType: bom.onshapeID?.wvmType || "",
        wvmID: bom.onshapeID?.wvmID || "",
        elementID: bom.onshapeID?.elementID || "",
        entityID: bom.onshapeID?.bomID || "",
        onshapeURL: bom.onshapeURL || "",
        exportFileID: "",
      };

      const collectedRows: TableRow[] = [assemblyRow];

      for (const sub of bom.subAssemblies || []) {
        const subRows = await fetchBomRecursively(sub.bomID, currentAssemblyRowId);
        collectedRows.push(...subRows);
      }

      for (const p of bom.parts || []) {
        const part = await fetchFromApi<PartModel>(`/db/part/id/${p.partID}`);
        const partRow: TableRow = {
          id: `${currentAssemblyRowId}-part-${part.id}`,
          parentId: currentAssemblyRowId === bomId ? null : currentAssemblyRowId,
          isExpanded: false,
          name: part.name || p.partID,
          catalogNumber: part.catalogNumber || "",
          revision: part.revision || "",
          description: part.description || "",
          engineer: part.engineer || "",
          material: part.material || "",
          mass: part.mass || 0,
          price: part.price || 0,
          quantity: p.quantity || 1,
          comments: part.comments || "",
          documentID: part.onshapeID?.documentID || "",
          wvmType: part.onshapeID?.wvmType || "",
          wvmID: part.onshapeID?.wvmID || "",
          elementID: part.onshapeID?.elementID || "",
          entityID: part.onshapeID?.partID || "",
          onshapeURL: part.onshapeURL || "",
          exportFileID: part.stlLink || part.parasolidLink || "",
        };
        collectedRows.push(partRow);
      }
      return collectedRows;
    }

    setLoading(true);
    fetchBomRecursively(bomId)
      .then((data) => setRows(data))
      .catch((err: ApiError) => setError(err))
      .finally(() => setLoading(false));
  }, [bomId]);

  const columns: ColumnConfig[] = [
    { key: "name", label: "Name", type: "string" },
    { key: "catalogNumber", label: "Catalog No.", type: "string" },
    { key: "revision", label: "Revision", type: "string" },
    { key: "engineer", label: "Engineer", type: "string" },
    { key: "quantity", label: "Quantity", type: "number", isDisabled: () => true },
    { key: "material", label: "Material", type: "string" },
    { key: "mass", label: "Mass", type: "number" },
    { key: "price", label: "Price", type: "number" },
    { key: "comments", label: "Comments", type: "string" },
    // Onshape ID Columns (Disabled)
    { key: "documentID", label: "Onshape Doc ID", type: "string", isDisabled: () => true },
    { key: "wvmType", label: "WVM Type", type: "string", isDisabled: () => true },
    { key: "wvmID", label: "WVM ID", type: "string", isDisabled: () => true },
    { key: "elementID", label: "Element ID", type: "string", isDisabled: () => true },
    { key: "entityID", label: "BOM/Part ID", type: "string", isDisabled: () => true },
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
      key: "exportFileID",
      label: "Export",
      type: "button",
      buttonText: "Download",
      isDisabled: () => true,
      onButtonClick: (row) => {
        if (row.exportFileID) {
          const downloadUrl = `http://localhost:5050/api/drive/file/${row.exportFileID}`;
          downloadFile(downloadUrl, `${row.name || "part"}.stl`);
        }
      },
    },
  ];

  return (
    <div className="p-8">
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          <p className="font-semibold">Error Loading BOM Data</p>
          <p>{error.message}</p>
          {error.statusCode && <p className="text-sm">HTTP Status Code: {error.statusCode}</p>}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-zinc-400">Recursively fetching BOM tree...</div>
      ) : (
        <Table
          data={rows}
          columnsData={columns}
          setData={(newData) => {
            return setRows(newData as TableRow[]);
          }}
          newRowFunction={undefined}
          removeTopRow={true}
        />
      )}
    </div>
  );
}
