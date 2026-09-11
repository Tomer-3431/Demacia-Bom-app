import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Appbar } from "./Appbar";
import { Sidebar } from "./Sidebar";
import '../css/Table.css';

export default function MainLayout() {
    const [isDrawerOpen, setDrawerOpen] = useState<boolean>(false);

    const location = useLocation();
    const isSidebar = location.pathname !== "/onshape";

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
            <Appbar onOpenDrawer={() => setDrawerOpen(true)} isSidebar={isSidebar} />
            {isSidebar && (
                <Sidebar isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} />
            )}
            <main className="flex-1 p-6 items-center justify-center w-full">
                <Outlet />
            </main>
        </div>
    );
}
