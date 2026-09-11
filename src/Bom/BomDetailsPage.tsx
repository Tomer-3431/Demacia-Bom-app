import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Table from "../components/Table";
import { fetchFromApi, type ApiError } from "../util/ApiService";
import type { BomModel, PartModel } from "../util/Models";
import type BomTableRow from "./BomTableRow";
import MainBomDataUI from "./MainBomDataUI";
import BomColumns from "./BomColumns";

export default function BomDetailsPage() {
  const { bomId } = useParams<{ bomId: string }>();
  const [rows, setRows] = useState<BomTableRow[]>([]);
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
    ): Promise<BomTableRow[]> {
      if (visitedBoms.has(targetBomId)) return [];
      visitedBoms.add(targetBomId);

      const bom = await fetchFromApi<BomModel>(`/db/bom/id/${targetBomId}`);
      const currentAssemblyRowId = `${parentId ? parentId + "-" : ""}${bom.id}`;

      const assemblyRow: BomTableRow = {
        id: currentAssemblyRowId,
        parentId: parentId === bomId ? null : parentId,
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
        vendor: bom.vendor || "",
      };

      const collectedRows: BomTableRow[] = targetBomId === bomId ? [] : [assemblyRow];

      for (const sub of bom.subAssemblies || []) {
        const subRows = await fetchBomRecursively(sub.bomID, currentAssemblyRowId);
        collectedRows.push(...subRows);
      }

      for (const p of bom.parts || []) {
        const part = await fetchFromApi<PartModel>(`/db/part/id/${p.partID}`);
        const partRow: BomTableRow = {
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
          vendor: part.vendor || ""
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

  return (
    <div className="p-8">
      {mainBomData && (
        <MainBomDataUI bom={mainBomData} />
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
          columnsData={BomColumns}
          setData={(newData) => {
            return setRows(newData as BomTableRow[]);
          }}
          newRowFunction={undefined}
          initialSort={{ key: "catalogNumber", direction: "asc" }}
        />
      )}
    </div>
  );
}
