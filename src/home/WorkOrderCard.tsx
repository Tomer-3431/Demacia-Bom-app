import { useNavigate } from "react-router-dom";
import { AuthenticatedImage } from "../util/ApiService";
import type { WorkorderSummary } from "./HomePage";

export const WorkOrderCard: React.FC<{ workOrder: WorkorderSummary }> = ({ workOrder }) => {
    const navigate = useNavigate();

    return (
        <div
            key={workOrder.id}
            onClick={() => navigate(`/workOrder/${workOrder.id}`)}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-all shadow-md flex flex-col justify-between">
            <div>
                <div className="w-full h-40 bg-zinc-950 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-zinc-800">
                    {workOrder.avatarID ? (
                        <AuthenticatedImage
                            src={`/drive/file/id/${workOrder.avatarID}`}
                            alt={workOrder.name || "WO"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-zinc-600 text-sm">No Image</span>
                    )}
                </div>
                <h2 className="text-lg font-bold text-zinc-100">{workOrder.name || "Unnamed Work Order"}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p className="text-sm text-zinc-400 mt-1">
                        <span className="text-zinc-200">{workOrder.catalogNumber || "N/A"}</span>
                    </p>
                    <p className="text-sm text-zinc-400 mt-1">
                        <span className="text-zinc-200">{workOrder.bomName || "N/A"}</span>
                    </p>
                </div>
                <p className="text-sm text-zinc-400">
                    <span className="text-zinc-200">{workOrder.workOrderOwner || "N/A"}</span>
                </p>
            </div>
        </div>
    );
}

export default WorkOrderCard;
