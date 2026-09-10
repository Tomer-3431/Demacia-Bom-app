import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

interface PartItem {
  partID: string;
  quantity: number;
}

interface SubAssemblyItem {
  bomID: string;
  quantity: number;
}

interface OnshapeIDData {
  documentID: string;
  wvmType: string;
  wvmID: string;
  elementID: string;
  bomID: string;
}

interface ApiError {
  message: string;
  statusCode?: number;
}

export default function CreateBomPage() {
  const navigate = useNavigate();

  // Basic BOM Metadata
  const [id, setId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [catalogNumber, setCatalogNumber] = useState<string>("");
  const [projectCatalogNumber, setProjectCatalogNumber] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [engineer, setEngineer] = useState<string>("");
  const [comments, setComments] = useState<string>("");
  const [onshapeURL, setOnshapeURL] = useState<string>("");
  const [avatarID, setAvatarID] = useState<string>("");

  // Onshape ID Object
  const [onshapeID, setOnshapeID] = useState<OnshapeIDData>({
    documentID: "",
    wvmType: "",
    wvmID: "",
    elementID: "",
    bomID: "",
  });

  // Dynamic Item Lists
  const [parts, setParts] = useState<PartItem[]>([]);
  const [subAssemblies, setSubAssemblies] = useState<SubAssemblyItem[]>([]);

  // UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Helper functions for dynamic parts
  const addPart = () => setParts([...parts, { partID: "", quantity: 1 }]);
  const removePart = (index: number) => setParts(parts.filter((_, i) => i !== index));
  const updatePart = (index: number, key: keyof PartItem, value: string | number) => {
    const updated = [...parts];
    updated[index] = { ...updated[index], [key]: value };
    setParts(updated);
  };

  // Helper functions for dynamic sub-assemblies
  const addSubAssembly = () => setSubAssemblies([...subAssemblies, { bomID: "", quantity: 1 }]);
  const removeSubAssembly = (index: number) => setSubAssemblies(subAssemblies.filter((_, i) => i !== index));
  const updateSubAssembly = (index: number, key: keyof SubAssemblyItem, value: string | number) => {
    const updated = [...subAssemblies];
    updated[index] = { ...updated[index], [key]: value };
    setSubAssemblies(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id.trim()) {
      setError({ message: "BOM ID is required." });
      return;
    }

    const secret = import.meta.env.VITE_CLIENT_SECRET;
    if (!secret) {
      setError({ message: "VITE_CLIENT_SECRET is missing from environment variables." });
      return;
    }

    // Build payload including optional Onshape ID object if populated
    const hasOnshapeData = Object.values(onshapeID).some((val) => val.trim() !== "");
    const payload = {
      id: id.trim(),
      name: name.trim(),
      catalogNumber: catalogNumber.trim(),
      projectCatalogNumber: projectCatalogNumber.trim(),
      description: description.trim(),
      engineer: engineer.trim(),
      comments: comments.trim(),
      onshapeURL: onshapeURL.trim(),
      avatarID: avatarID.trim(),
      parts: parts.filter((p) => p.partID.trim() !== ""),
      subAssemblies: subAssemblies.filter((s) => s.bomID.trim() !== ""),
      ...(hasOnshapeData ? { onshapeID } : {}),
    };

    setLoading(true);

    try {
      const response = await fetch(`http://localhost:5050/api/db/bom/id/${id.trim()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-secret": secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw {
          message: `Failed to create BOM: ${response.statusText}`,
          statusCode: response.status,
        } as ApiError;
      }

      navigate(`/bom/${id}`);
    } catch (err: any) {
      if (err.statusCode) {
        setError(err);
      } else {
        setError({ message: err.message || "An unexpected error occurred." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="mb-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-medium text-sm"
      >
        ← Back to Home
      </button>

      <h1 className="text-2xl font-bold mb-6 text-zinc-100">Create New BOM</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          <p className="font-semibold">Error Creating BOM</p>
          <p>{error.message}</p>
          {error.statusCode && <p className="text-sm">HTTP Status Code: {error.statusCode}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Metadata */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-zinc-200">General Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">BOM ID (Required)</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. BOM-1001"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. Main Chassis Assembly"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Catalog Number</label>
              <input
                type="text"
                value={catalogNumber}
                onChange={(e) => setCatalogNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. CAT-001"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Project Catalog Number</label>
              <input
                type="text"
                value={projectCatalogNumber}
                onChange={(e) => setProjectCatalogNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. PRJ-2026"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Engineer</label>
              <input
                type="text"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Avatar File ID (Google Drive)</label>
              <input
                type="text"
                value={avatarID}
                onChange={(e) => setAvatarID(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
                placeholder="e.g. 1a2b3c4d_fileID"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Onshape URL</label>
            <input
              type="text"
              value={onshapeURL}
              onChange={(e) => setOnshapeURL(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              placeholder="https://cad.onshape.com/documents/..."
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Comments</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              rows={2}
            />
          </div>
        </div>

        {/* Onshape ID Fields */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-zinc-200">Onshape ID Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Document ID</label>
              <input
                type="text"
                value={onshapeID.documentID}
                onChange={(e) => setOnshapeID({ ...onshapeID, documentID: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">WVM Type</label>
              <input
                type="text"
                value={onshapeID.wvmType}
                onChange={(e) => setOnshapeID({ ...onshapeID, wvmType: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">WVM ID</label>
              <input
                type="text"
                value={onshapeID.wvmID}
                onChange={(e) => setOnshapeID({ ...onshapeID, wvmID: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Element ID</label>
              <input
                type="text"
                value={onshapeID.elementID}
                onChange={(e) => setOnshapeID({ ...onshapeID, elementID: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">BOM ID</label>
              <input
                type="text"
                value={onshapeID.bomID}
                onChange={(e) => setOnshapeID({ ...onshapeID, bomID: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Sub-Assemblies List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-200">Sub-Assemblies</h2>
            <button
              type="button"
              onClick={addSubAssembly}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
            >
              + Add Sub-Assembly
            </button>
          </div>
          {subAssemblies.map((sub, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Sub-Assembly BOM ID"
                value={sub.bomID}
                onChange={(e) => updateSubAssembly(idx, "bomID", e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={sub.quantity}
                onChange={(e) => updateSubAssembly(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                className="w-24 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm"
              />
              <button
                type="button"
                onClick={() => removeSubAssembly(idx)}
                className="px-3 py-2 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          {subAssemblies.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No sub-assemblies added.</p>
          )}
        </div>

        {/* Parts List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-200">Parts</h2>
            <button
              type="button"
              onClick={addPart}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
            >
              + Add Part
            </button>
          </div>
          {parts.map((p, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Part ID"
                value={p.partID}
                onChange={(e) => updatePart(idx, "partID", e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={p.quantity}
                onChange={(e) => updatePart(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                className="w-24 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 text-sm"
              />
              <button
                type="button"
                onClick={() => removePart(idx)}
                className="px-3 py-2 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          {parts.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No leaf parts added.</p>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            {loading ? "Creating..." : "Create BOM"}
          </button>
        </div>
      </form>
    </div>
  );
}
