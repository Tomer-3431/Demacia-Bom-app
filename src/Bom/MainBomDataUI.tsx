import { useState } from "react";
import { AuthenticatedImage, fetchFromApi, type ApiError } from "../util/ApiService";
import { type BomModel, type WorkorderModel, type WorkorderPartModel as WorkOrderPartModel } from "../util/Models"
import { createPortal } from "react-dom";
import { WorkOrderForm, type WorkOrderFormData } from "./CreatingWO";
import { useNavigate } from "react-router-dom";

const MainBomDataUI: React.FC<{ bom: BomModel }> = ({ bom }) => {
  const [isCreatingWO, setCreatingWO] = useState(false);
  const navigate = useNavigate();

  const visitedBoms = new Set<string>();

  async function fetchBomPartsRecursively(
    targetBomId: string
  ): Promise<WorkOrderPartModel[]> {
    if (visitedBoms.has(targetBomId)) return [];
    visitedBoms.add(targetBomId);

    const bom = await fetchFromApi<BomModel>(`/db/bom/id/${targetBomId}`);
    const collectedParts: WorkOrderPartModel[] = [];

    for (const sub of bom.subAssemblies || []) {
      const subParts = await fetchBomPartsRecursively(sub.bomID);
      collectedParts.push(...subParts);
    }

    for (const p of bom.parts || []) {
      const workOrderPart: WorkOrderPartModel = {
        partID: p.partID,
        quantityTotal: p.quantity,
        quantityMade: 0,
        statusCode: 0,
        productionGCOwner: "",
        productionMakingOwner: "",
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      collectedParts.push(workOrderPart);
    }
    return collectedParts;
  }

  const handleNewWO = async (data: WorkOrderFormData) => {
    const secret: string = import.meta.env.VITE_CLIENT_SECRET;
    const id = Date.now().toString();
    const parts = await fetchBomPartsRecursively(bom.id);

    const payload: WorkorderModel = {
      id: id,
      name: data.name.trim(),
      bomID: bom.id,
      workOrderOwner: data.workOrderOwner.trim(),
      description: data.description.trim(),
      parts: parts,
      avatarID: bom.avatarID,
      comments: data.comments,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const response = await fetch(`http://localhost:5050/api/db/workOrder/id/${id}`, {
        method: "POST",
        headers: {
          "content-Type": "application/json",
          "x-client-secret": secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw {
          message: `Failed to create Work Order: ${response.statusText}`,
          statusCode: response.status
        } as ApiError
      }

      navigate(`/workOrder/${id}`);
    } catch (err: any) {
      if (err.statusCode) {
        console.error(err)
      } else {
        console.error("An unexpected error");
      }
    }
  }

  return (
    <div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-100 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center w-full lg:w-auto">
          <div className="w-28 h-28 shrink-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
            {bom.avatarID ? (
              <AuthenticatedImage
                src={`http://localhost:5050/api/drive/file/${bom.avatarID}`}
                alt={bom.name || "BOM Thumbnail"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-zinc-600 text-xs font-mono">NO IMAGE</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {bom.name || "Unnamed Assembly"}
              </h1>
              {bom.description && (
                <p className="text-s text-zinc-400 italic">
                  {bom.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
              <p>
                Catalog No:{" "}
                <span className="text-zinc-200 font-medium">
                  {bom.catalogNumber || "N/A"}
                </span>
              </p>
              <span>•</span>
              <p>
                Engineer:{" "}
                <span className="text-zinc-200 font-medium">
                  {bom.engineer || "N/A"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right side: Onshape link & Comments */}
        <div className="flex flex-col items-start lg:items-end gap-3 self-stretch lg:self-auto shrink-0 border-t lg:border-t-0 border-zinc-800 pt-4 lg:pt-0">
          <button
            onClick={() => setCreatingWO(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md w-full lg:w-auto text-center"
          >
            Create Work Order
          </button>
          {bom.onshapeURL && (
            <a
              href={bom.onshapeURL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md w-full lg:w-auto text-center"
            >
              Open Onshape CAD
            </a>
          )}

          {bom.comments && (
            <p className="text-xs text-zinc-400 italic max-w-xs text-left lg:text-right">
              {bom.comments}
            </p>
          )}
        </div>
      </div>
      {isCreatingWO && createPortal(
        <div
          onClick={() => setCreatingWO(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()}>
            <WorkOrderForm
              onSubmit={(data) => handleNewWO(data)}
              onCancel={() => setCreatingWO(false)}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default MainBomDataUI;
