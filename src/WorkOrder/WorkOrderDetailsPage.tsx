import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchFromApi, type ApiError } from "../util/ApiService";
import Table from "../components/Table";
import WorkOrderColumns from "./WorkOrderColumns";
import type WorkOrderTableRow from "./WorkOrderTableRow";
import type { PartModel, WorkorderModel } from "../util/Models";

export default function WorkOrderDetailsPage() {
    const { workOrderID } = useParams<{ workOrderID: string }>();
    const [rows, setRows] = useState<WorkOrderTableRow[]>([])
    const [error, setError] = useState<ApiError | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [workOrderData, setworkOrderData] = useState<WorkorderModel | null>(null);

    useEffect(() => {
        async function getWOData() {
            setworkOrderData(await fetchFromApi<WorkorderModel>(`/db/workOrder/id/${workOrderID}`));
        }

        return () => {
            getWOData();
        }
    }, [workOrderID])

    useEffect(() => {
        if (!workOrderID || !workOrderData) return;

        async function getPartsData(): Promise<WorkOrderTableRow[]> {
            const collectedRows: WorkOrderTableRow[] = [];
            for (const p of workOrderData?.parts || []) {
                const part = await fetchFromApi<PartModel>(`/db/part/id/${p.partID}`);
                const partRow: WorkOrderTableRow = {
                    id: `${workOrderID}-part-${p.partID}`,
                    parentId: null,
                    isExpanded: false,
                    avatar: part.avatarID || "",
                    name: part.name || "",
                    catalogNumber: part.catalogNumber || "",
                    revision: part.revision || "",
                    description: part.description || "",
                    engineer: part.engineer || "",
                    material: part.material || "",
                    mass: part.mass || 0,
                    price: part.price || 0,
                    quantityTotal: p.quantityTotal || 0,
                    quantityMade: p.quantityTotal || 0,
                    statusCode: p.statusCode || 0,
                    productionGCOwner: p.productionGCOwner || "",
                    productionMakingOwner: p.productionMakingOwner || "",
                    lastUpadte: p.lastUpdate || new Date(),
                    firstAdded: p.firstAdded || new Date(),
                    comments: part.comments || "",
                    documentID: part.onshapeID?.documentID || "",
                    wvmType: part.onshapeID?.wvmType || "",
                    wvmID: part.onshapeID?.wvmID || "",
                    elementID: part.onshapeID?.elementID || "",
                    entityID: part.onshapeID?.partID || "",
                    onshapeURL: part.onshapeURL || "",
                    exportSTL: part.stlLink || "",
                    exportParasolid: part.parasolidLink || ""
                };
                collectedRows.push(partRow);
            }
            return collectedRows;
        }

        setLoading(true);
        getPartsData()
            .then((data) => setRows(data))
            .catch((err: ApiError) => setError(err))
            .finally(() => setLoading(false));
    }, [workOrderID, workOrderData])

    return (
        <div className="p-8">
            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                    <p className="font-semibold">Error Loading Work Order Data</p>
                    <p>{error.message}</p>
                    {error.statusCode && <p className="text-sm">HTTP Status Code: {error.statusCode}</p>}
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-zinc-400">Fetching Work Order...</div>
            ) : (
                <Table
                    data={rows}
                    columnsData={WorkOrderColumns}
                    newRowFunction={undefined}
                    setData={(newData) => {return setRows(newData as WorkOrderTableRow[]);}}
                />
            )}
        </div>
    )
}