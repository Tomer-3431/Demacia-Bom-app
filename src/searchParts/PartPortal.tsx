import React, { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { AuthenticatedImage, downloadFile } from "../util/ApiService";
import type { PartModel } from "../util/Models";

const PartPortal: React.FC<{ part: PartModel }> = ({ part }) => {
    const [formData, setFormData] = useState<PartModel>({ ...part });
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        setFormData({ ...part });
    }, [part]);

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? undefined : Number(value)) : value,
        }));
    };

    const handleUpsert = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveError(null);

        try {
            const response = await fetch(`http://localhost:5050/api/db/part/id/${part.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-secret": import.meta.env.VITE_CLIENT_SECRET,
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error(`Failed to save part data (${response.status})`);
            }

            await response.json().catch(() => formData);
        } catch (err: any) {
            setSaveError(err.message || "An unexpected error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-zinc-100 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
                <div className="flex items-center gap-5 w-full">
                    <div className="w-24 h-24 shrink-0 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
                        {formData.avatarID ? (
                            <AuthenticatedImage
                                src={`http://localhost:5050/api/drive/file/${formData.avatarID}`}
                                alt={formData.name || "Part Avatar"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-zinc-600 text-[10px] font-mono">NO IMAGE</span>
                        )}
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                                Part Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name || ""}
                                onChange={handleChange}
                                placeholder="Enter Part Name"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-lg font-bold text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {saveError && (
                <div className="p-3.5 bg-red-900/40 border border-red-500/50 rounded-xl text-xs text-red-200">
                    {saveError}
                </div>
            )}

            <form onSubmit={handleUpsert} className="space-y-6">
                {/* Row 1: Catalog Number & Revision & Engineer */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Catalog Number
                        </label>
                        <input
                            type="text"
                            name="catalogNumber"
                            value={formData.catalogNumber || ""}
                            onChange={handleChange}
                            placeholder="e.g. PN-1002"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Revision
                        </label>
                        <input
                            type="text"
                            name="revision"
                            value={formData.revision || ""}
                            onChange={handleChange}
                            placeholder="e.g. Rev A"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Engineer
                        </label>
                        <input
                            type="text"
                            name="engineer"
                            value={formData.engineer || ""}
                            onChange={handleChange}
                            placeholder="Engineer name"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                </div>

                {/* Row 2: Material & Mass & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Material
                        </label>
                        <input
                            type="text"
                            name="material"
                            value={formData.material || ""}
                            onChange={handleChange}
                            placeholder="e.g. Aluminum 6061"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Mass (kg)
                        </label>
                        <input
                            type="number"
                            step="any"
                            name="mass"
                            value={formData.mass ?? ""}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Price ($)
                        </label>
                        <input
                            type="number"
                            step="any"
                            name="price"
                            value={formData.price ?? ""}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                </div>

                {/* Row 3: Links & Media Keys */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Onshape CAD URL
                        </label>
                        <button
                            onClick={() => {
                                if (part.onshapeURL) window.open(part.onshapeURL, "_blank");
                            }}
                            disabled
                            className="mx-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Open Onshape
                        </button>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            STL Model Link
                        </label>
                        <button
                            onClick={async () => {
                                const downloadUrl = `http://localhost:5050/api/drive/file/${part.stlLink}`;
                                await downloadFile(downloadUrl, `${part.name || "part"}.stl`);
                            }}
                            disabled
                            className="mx-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Download STL
                        </button>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3.5 space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                            Parasolid Model Link
                        </label>
                        <button
                            onClick={async () => {
                                const downloadUrl = `http://localhost:5050/api/drive/file/${part.parasolidLink}`;
                                await downloadFile(downloadUrl, `${part.name || "part"}.parasolid`);
                            }}
                            disabled
                            className="mx-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Download Parasolid
                        </button>
                    </div>
                </div>

                {/* Expanded Description Section */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                        Description
                    </label>
                    <textarea
                        name="description"
                        rows={3}
                        value={formData.description || ""}
                        onChange={handleChange}
                        placeholder="Detailed description of the part..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                    />
                </div>

                {/* Expanded Comments Section */}
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
                        Comments & Notes
                    </label>
                    <textarea
                        name="comments"
                        rows={4}
                        value={formData.comments || ""}
                        onChange={handleChange}
                        placeholder="Additional manufacturing notes, comments, or issues..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 italic placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                    />
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-3">
                        {formData.onshapeURL && (
                            <a
                                href={formData.onshapeURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all"
                            >
                                Open CAD Link ↗
                            </a>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-md"
                        >
                            {isSaving ? "Saving..." : "Save / Upsert Part"}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default PartPortal;
