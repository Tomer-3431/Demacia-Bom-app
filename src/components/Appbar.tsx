import { SidebarIcon } from "lucide-react"

export const Appbar: React.FC<{ onOpenDrawer: () => void, title?: string }> = ({ onOpenDrawer, title = "Bom App" }) => {
    return (
        <header className="h-12 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
            <div className="w-10 flex items-center">
                <button
                    onClick={onOpenDrawer}
                    aria-label="Open Sidebar"
                    className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-gray-800 transition-colors focus:outline-none">
                    <SidebarIcon className="w-5 h-5" />
                </button>
            </div>

            <h1 className="text-base font-bold text-gray-100 tracking-wider flex items-center gap-2">{title}</h1>

            <div className="w-10" />
        </header>
    )
}
