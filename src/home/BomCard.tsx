import { useNavigate } from "react-router-dom";
import { AuthenticatedImage } from "../util/ApiService";
import type { BomSummary } from "./HomePage";

export const BomCard: React.FC<{ bom: BomSummary }> = ({ bom }) => {
    const navigate = useNavigate();

    return (
        <div
            key={bom.id}
            onClick={() => navigate(`/bom/${bom.id}`)}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-all shadow-md flex flex-col justify-between"
        >
            <div>
                <div className="w-full h-40 bg-zinc-950 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-zinc-800">
                    {bom.avatarID ? (
                        <AuthenticatedImage
                            src={`/drive/file/id/${bom.avatarID}`}
                            alt={bom.name || "BOM"}
                            className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-zinc-600 text-sm">No Image</span>
                    )}
                </div>
                <h2 className="text-lg font-bold text-zinc-100">{bom.name || "Unnamed BOM"}</h2>
                <p className="text-sm text-zinc-400 mt-1">
                    <span className="text-zinc-200">{bom.catalogNumber || "N/A"}</span>
                </p>
                <p className="text-sm text-zinc-400">
                    <span className="text-zinc-200">{bom.engineer || "N/A"}</span>
                </p>
            </div>
        </div>
    )
}

export default BomCard;
