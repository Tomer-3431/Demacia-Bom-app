import { useState, useMemo, useEffect } from "react";
import { AuthenticatedImage, fetchFromApi } from "../util/ApiService";
import type { PartModel } from "../util/Models";
import { createPortal } from "react-dom";
import PartPortal from "./partPortal";

export function PartsSearchPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [parts, setParts] = useState<PartModel[]>([]);
    const [isOpen, setOpen] = useState<PartModel | null>(null);

    useEffect(() => {
        if(parts.length !== 0) return;

        async function getParts() {
            const response = await fetchFromApi<PartModel[]>(`/db/part/all`);
            setParts(response);
        }

        getParts();
    });

    const filteredParts = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return parts;

        return parts.filter((part) => {
            const nameMatch = part.name?.toLowerCase().includes(query);
            const catalogMatch = part.catalogNumber?.toLowerCase().includes(query);
            const descriptionMatch = part.description?.toLowerCase().includes(query);

            return nameMatch || catalogMatch || descriptionMatch;
        });
    }, [searchQuery, parts]);

    return (
        <div className="min-h-screen text-zinc-100 p-6 space-y-6">
            {/* Header & Search Bar Bar */}
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Parts Catalog</h1>
                        <p className="text-xs text-zinc-400">Search parts by name, catalog number, or description.</p>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">
                        Results: <span className="text-zinc-200 font-bold">{filteredParts.length}</span>
                    </div>
                </div>

                {/* Search Input Box */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, catalog #, or description..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-md"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 text-xs font-semibold"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Results Grid */}
            <div className="max-w-6xl mx-auto">
                {filteredParts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredParts.map((part) => (
                            <div
                                key={part.id}
                                onClick={() => setOpen(part)}
                                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 shadow-md transition-all cursor-pointer flex gap-4 items-start group"
                            >
                                {/* Thumbnail */}
                                <div className="w-16 h-16 shrink-0 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                                    {part.avatarID ? (
                                        <AuthenticatedImage
                                            src={`http://localhost:5050/api/drive/file/${part.avatarID}`}
                                            alt={part.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <span className="text-zinc-600 text-[10px] font-mono">NO IMAGE</span>
                                    )}
                                </div>

                                {/* Part Metadata */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                                            {part.name}
                                        </h3>
                                    </div>

                                    <p className="text-xs font-mono text-zinc-400">
                                        Cat #: <span className="text-zinc-200">{part.catalogNumber || "N/A"}</span>
                                    </p>

                                    {part.description && (
                                        <p className="text-xs text-zinc-500 line-clamp-2 italic">
                                            {part.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center space-y-2">
                        <p className="text-zinc-400 text-sm font-medium">No parts found matching "{searchQuery}"</p>
                        <p className="text-zinc-600 text-xs">Try searching with a different term or clearing filters.</p>
                    </div>
                )}
            </div>
            {isOpen && createPortal(
                <div
                    onClick={() => setOpen(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backgdrop-blur-sm"
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <PartPortal part={isOpen}/>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default PartsSearchPage;
