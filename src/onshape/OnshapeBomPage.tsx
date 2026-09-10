import { useState } from "react";
import Table, { type RowData } from "../components/Table";
import type { BomModel } from "../util/Models";

const BomPage: React.FC = () => {
    const [rows, setRows] = useState<RowData[]>([]);

    const columnsData = [
        { key: "id", label: "ID", type: "string" as const },
        { key: "name", label: "Name", type: "string" as const },
        { key: "catalogNumber", label: "Catalog Number", type: "string" as const },
        { key: "description", label: "Description", type: "string" as const },
        { key: "engineer", label: "Engineer", type: "string" as const },
        { key: "comments", label: "Comments", type: "string" as const },
        { key: "onshapeURL", label: "Onshape URL", type: "string" as const },
    ];

    return (
        <div className="table-page-container">
            <style>{`
                .th-content-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    width: 100% !important;
                    gap: 8px !important;
                }
                .th-sort-btn {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    gap: 6px !important;
                    flex: 1 1 auto !important;
                    min-width: 0 !important;
                }
                .th-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .sort-indicator {
                    flex-shrink: 0;
                }
                .grid-drag-handle {
                    margin-left: auto;
                    flex-shrink: 0;
                    cursor: grab;
                }
            `}</style>
            <div className="table-header-section">
                <h2>BOM Table</h2>
            </div>
            <div className="table-wrapper">
                <Table
                    data={rows}
                    columnsData={columnsData}
                    newRowFunction={undefined}
                    setData={(data) => setRows(data)}
                />
            </div>
        </div>
    );
};

export default BomPage;