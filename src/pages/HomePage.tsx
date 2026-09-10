import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthenticatedImage, fetchFromApi, type ApiError } from "../services/api";

interface BomSummary {
  id: string;
  name?: string;
  catalogNumber?: string;
  engineer?: string;
  avatarID?: string;
  updatedAt?: string;
}

export default function HomeScreen() {
  const [boms, setBoms] = useState<BomSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFromApi<BomSummary[]>("/db/bom/all")
      .then((data) => {
        const sorted = data.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });
        setBoms(sorted);
      })
      .catch((err: ApiError) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">Loading BOMs...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-zinc-100">Boms</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          <p className="font-semibold">Error Loading BOMs</p>
          <p>{error.message}</p>
          {error.statusCode && <p className="text-sm">HTTP Status Code: {error.statusCode}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boms.map((bom) => (
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
        ))}
      </div>
    </div>
  );
}
