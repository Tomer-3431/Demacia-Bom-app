import type { WorkorderModel } from "../util/Models";
import { AuthenticatedImage } from "../util/ApiService";

const WorkOrderDataUI: React.FC<{ workOrder: WorkorderModel }> = ({ workOrder }) => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-100 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center w-full lg:w-auto">
          <div className="w-28 h-28 shrink-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
            {workOrder.avatarID ? (
              <AuthenticatedImage
                src={`/drive/file/id/${workOrder.avatarID}`}
                alt={workOrder.name || "Work Order Thumbnail"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-zinc-600 text-xs font-mono">NO IMAGE</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {workOrder.name || "Unnamed Assembly"}
              </h1>
              {workOrder.description && (
                <p className="text-s text-zinc-400 italic">
                  {workOrder.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
              <p>
                Catalog No:{" "}
                <span className="text-zinc-200 font-medium">
                  {workOrder.catalogNumber || "N/A"}
                </span>
              </p>
              <span>•</span>
              <p>
                Owner:{" "}
                <span className="text-zinc-200 font-medium">
                  {workOrder.workOrderOwner || "N/A"}
                </span>
              </p>
              <span>•</span>
              <p>
                Parts:{" "}
                <span className="text-zinc-200 font-medium">
                  {workOrder.parts?.length || 0}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right side: Onshape link & Comments */}
        <div className="flex flex-col items-start lg:items-end gap-3 self-stretch lg:self-auto shrink-0 border-t lg:border-t-0 border-zinc-800 pt-4 lg:pt-0">
          {workOrder.comments && (
            <p className="text-xs text-zinc-400 italic max-w-xs text-left lg:text-right">
              {workOrder.comments}
            </p>
          )}
        </div>
      </div>
    )
}

export default WorkOrderDataUI;
