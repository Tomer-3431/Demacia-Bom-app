import { useState, type FormEvent, type ChangeEvent } from "react";

export interface WorkOrderFormData {
    name: string;
    workOrderOwner: string;
    description: string;
    comments: string;
}

interface WorkOrderFormProps {
    onCancel?: () => void;
    onSubmit?: (data: WorkOrderFormData) => void;
    initialData?: Partial<WorkOrderFormData>;
}

export function WorkOrderForm({ onCancel, onSubmit, initialData }: WorkOrderFormProps) {
    const [formData, setFormData] = useState<WorkOrderFormData>({
        name: initialData?.name || "",
        workOrderOwner: initialData?.workOrderOwner || "",
        description: initialData?.description || "",
        comments: initialData?.comments || "",
    });

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit(formData);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5 text-zinc-100"
        >
            <h2 className="text-xl font-bold tracking-tight text-white mb-4">
                Work Order Details
            </h2>

            {/* Name and Work Order Owner in a single row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label
                        htmlFor="name"
                        className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                    >
                        Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter work order name"
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="workOrderOwner"
                        className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                    >
                        Work Order Owner
                    </label>
                    <input
                        type="text"
                        id="workOrderOwner"
                        name="workOrderOwner"
                        value={formData.workOrderOwner}
                        onChange={handleChange}
                        placeholder="Enter owner name"
                        required
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                </div>
            </div>

            {/* Description (switched to 2 rows) */}
            <div className="space-y-1.5">
                <label
                    htmlFor="description"
                    className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                >
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows={2}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide a detailed description"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                />
            </div>

            {/* Comments (switched to 3 rows) */}
            <div className="space-y-1.5">
                <label
                    htmlFor="comments"
                    className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                >
                    Comments
                </label>
                <textarea
                    id="comments"
                    name="comments"
                    rows={3}
                    value={formData.comments}
                    onChange={handleChange}
                    placeholder="Add any extra notes or comments"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                />
            </div>

            {/* Submit Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full bg-zinc-600 hover:bg-zinc-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs tracking-wide transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    >
                        Cancel
                    </button>
                </div>
                <div className="pt-2">
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs tracking-wide transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        Submit Work Order
                    </button>
                </div>
            </div>
        </form>
    );
}
