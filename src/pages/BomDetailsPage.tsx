import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Table, type ColumnConfig, type RowData } from "../components/Table";
import { AuthenticatedImage, downloadFile, fetchFromApi, type ApiError } from "../services/api";

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
  description?: string;
  catalogNumber?: string;
  engineer?: string;
  comments?: string;
  onshapeURL?: string;
  avatarID?: string;
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
  avatarID?: string;
  stlLink?: string;
  parasolidLink?: string;
  onshapeID?: OnshapeID;
}

interface TableRow extends RowData {
  avatar: string;
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
  exportSTL: string;
  exportParasolid: string;
}

export default function BomDetailsPage() {
  const { bomId } = useParams<{ bomId: string }>();
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [mainBomData, setMainBomData] = useState<BomModel | null>(null);

  useEffect(() => {
    if (!bomId) return;

    fetchFromApi<BomModel>(`/db/bom/id/${bomId}`).then((bom) => {
      setMainBomData(bom);
    });
  }, [bomId]);

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
        avatar: `/drive/file/id/${bom.avatarID}` || "",
        name: bom.name || targetBomId,
        catalogNumber: bom.catalogNumber || "",
        revision: "-",
        description: bom.description || "",
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
        exportSTL: "",
        exportParasolid: "",
      };

      const collectedRows: TableRow[] = targetBomId === bomId ? [] : [assemblyRow];

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
          avatar: `/drive/file/id/${part.avatarID}` || "",
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
          exportSTL: part.stlLink || "",
          exportParasolid: part.parasolidLink || "",
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
      onButtonClick: (row: TableRow) => {
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
      onButtonClick: (row: TableRow) => {
        if (row.exportParasolid) {
          const downloadUrl = `http://localhost:5050/api/drive/file/${row.exportParasolid}`;
          downloadFile(downloadUrl, `${row.name || "part"}.parasolid`);
        }
      },
    },
  ];

  return (
    <div className="p-8">
      {mainBomData && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-100 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center w-full lg:w-auto">
            <div className="w-28 h-28 shrink-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
              {mainBomData.avatarID ? (
                <AuthenticatedImage
                  src={`http://localhost:5050/api/drive/file/${mainBomData.avatarID}`}
                  alt={mainBomData.name || "BOM Thumbnail"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-zinc-600 text-xs font-mono">NO IMAGE</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {mainBomData.name || "Unnamed Assembly"}
                </h1>
                {mainBomData.description && (
                  <p className="text-s text-zinc-400 italic">
                    {mainBomData.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                <p>
                  Catalog No:{" "}
                  <span className="text-zinc-200 font-medium">
                    {mainBomData.catalogNumber || "N/A"}
                  </span>
                </p>
                <span>•</span>
                <p>
                  Engineer:{" "}
                  <span className="text-zinc-200 font-medium">
                    {mainBomData.engineer || "N/A"}
                  </span>
                </p>
                <span>•</span>
                <p>
                  Sub-Assemblies:{" "}
                  <span className="text-zinc-200 font-medium">
                    {mainBomData.subAssemblies?.length || 0}
                  </span>
                </p>
                <span>•</span>
                <p>
                  Direct Parts:{" "}
                  <span className="text-zinc-200 font-medium">
                    {mainBomData.parts?.length || 0}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Right side: Onshape link & Comments */}
          <div className="flex flex-col items-start lg:items-end gap-3 self-stretch lg:self-auto shrink-0 border-t lg:border-t-0 border-zinc-800 pt-4 lg:pt-0">
            {mainBomData.onshapeURL && (
              <a
                href={mainBomData.onshapeURL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md w-full lg:w-auto text-center"
              >
                Open Onshape CAD
              </a>
            )}

            {mainBomData.comments && (
              <p className="text-xs text-zinc-400 italic max-w-xs text-left lg:text-right">
                {mainBomData.comments}
              </p>
            )}
          </div>
        </div>
      )}
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
          initialSort={{ key: "catalogNumber", direction: "asc" }}
        />
      )}
    </div>
  );
}
