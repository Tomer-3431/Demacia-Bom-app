import { AuthenticatedImage } from "../util/ApiService";
import type { BomModel } from "../util/Models"

const MainBomDataUI: React.FC<{ bom: BomModel }> = ({ bom }) => {
  return (
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
            <span>•</span>
            <p>
              Sub-Assemblies:{" "}
              <span className="text-zinc-200 font-medium">
                {bom.subAssemblies?.length || 0}
              </span>
            </p>
            <span>•</span>
            <p>
              Direct Parts:{" "}
              <span className="text-zinc-200 font-medium">
                {bom.parts?.length || 0}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Onshape link & Comments */}
      <div className="flex flex-col items-start lg:items-end gap-3 self-stretch lg:self-auto shrink-0 border-t lg:border-t-0 border-zinc-800 pt-4 lg:pt-0">
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
  );
}

export default MainBomDataUI;
