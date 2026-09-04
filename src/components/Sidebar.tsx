import { FileBox, HomeIcon, X, type LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { useLocation, useNavigate } from "react-router-dom"

export const Sidebar: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems: { label: string, path: string, icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>> }[] = [
        { label: 'Home', path: '/home', icon: HomeIcon },
        { label: 'Onshape', path: '/onshape', icon: FileBox },
    ];

    const handleNavigation = (path: string) => {
        navigate(path);
        onClose();
    };

    return (
        <div>
            <div onClick={onClose}
                className={`fixed insert-0 bg-black/70 z-40 transition-opacity duration-300 
                            ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`} />
            <aside className={`h-full fixed top-0 left-0 buttom-0 w-64 bg-gray-900 border-r border-gray-800 shadow-2x1 z-50 transform transition-transform duration-300 ease-in-out flex flex-col
                                            ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-12 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900/50">
                    <span className="font-semibold text-sm text-gray-300 uppercase tracking-wider">Sidebar</span>
                    <button
                        onClick={onClose}
                        aria-label="Close Sidebar"
                        className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                        <X className="w-5 g-5" />
                    </button>
                </div>

                <nav className="flex-1 px-2 py-3 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <button
                                key={item.path}
                                onClick={() => handleNavigation(item.path)}
                                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors 
                                        ${isActive ? 'bg-gray-800 text-indigo-400' : 'text-gray-300 hover:bg-gray-800 hover:text-indigo-400'}`}>
                                <Icon className="w-4 h-4 text-indigo-400" />
                                <span>{item.label}</span>
                            </button>
                        )
                    })}
                </nav>
            </aside>
        </div>
    );
}
