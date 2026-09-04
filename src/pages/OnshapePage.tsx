import type { FC } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import '../css/Table.css';

interface RowData {
    id: number;
    partId: string;
    description: string;
    manufacturingMethod: string;
    material: string;
    status: string;
    quantity: number;
}

type ColumnKey = keyof Omit<RowData, 'id'>;

interface ColumnConfig {
    key: ColumnKey;
    label: string;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    columnIndex: number;
}

const MASTER_DATA: Omit<RowData, 'id'>[] = [
    { partId: 'PN-10023', description: 'Bracket, Mounting', manufacturingMethod: 'CNC Milled', material: 'Aluminum 6061-T6', status: 'Released', quantity: 2 },
    { partId: 'PN-10024', description: 'Housing, Motor', manufacturingMethod: 'Injection Molded', material: 'ABS', status: 'In Review', quantity: 1 },
    { partId: 'PN-10025', description: 'Shaft, Drive', manufacturingMethod: 'Turned', material: 'Stainless Steel 304', status: 'Released', quantity: 1 },
    { partId: 'PN-10026', description: 'Plate, Base', manufacturingMethod: 'Laser Cut', material: 'Steel A36', status: 'Obsolete', quantity: 1 },
    { partId: 'PN-10027', description: 'Gear, Spur', manufacturingMethod: '3D Printed (SLS)', material: 'Nylon PA12', status: 'Released', quantity: 4 },
    { partId: 'PN-10028', description: 'Enclosure, Cover', manufacturingMethod: 'Sheet Metal Bent', material: 'Aluminum 5052', status: 'In Review', quantity: 1 },
];

export const OnshapePage: FC = () => {
    const [searchParams] = useSearchParams();

    const worksapceOrVersion = searchParams.get('wv');
    const workspaceOrVersionId = searchParams.get('wvid');
    const microversionId = searchParams.get('mid');

    let wvmType: 'w' | 'v' | 'm' = 'w';
    let wvmId: string | null = null;

    if (worksapceOrVersion === "w") {
        wvmType = 'w';
        wvmId = workspaceOrVersionId;
    } else if (worksapceOrVersion === "v") {
        wvmType = 'v';
        wvmId = workspaceOrVersionId;
    } else if (microversionId) {
        wvmType = 'm';
        wvmId = microversionId;
    }

    const [rowCountInput, setRowCountInput] = useState<string>("3");
    const [data, setData] = useState<RowData[]>([
        { id: 1, partId: 'PN-10023', description: 'Bracket, Mounting', manufacturingMethod: 'CNC Milled', material: 'Aluminum 6061-T6', status: 'Released', quantity: 2 },
        { id: 2, partId: 'PN-10024', description: 'Housing, Motor', manufacturingMethod: 'Injection Molded', material: 'ABS', status: 'In Review', quantity: 1 },
        { id: 3, partId: 'PN-10025', description: 'Shaft, Drive', manufacturingMethod: 'Turned', material: 'Stainless Steel 304', status: 'Released', quantity: 1 },
    ]);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'partId', label: 'Part ID' },
        { key: 'description', label: 'Description' },
        { key: 'manufacturingMethod', label: 'Manufacturing Method' },
        { key: 'material', label: 'Material' },
        { key: 'status', label: 'Status' },
        { key: 'quantity', label: 'Qty' },
    ]);

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);
    
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        columnIndex: -1
    });

    const handleRowCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setRowCountInput(val);

        const count = parseInt(val, 10);
        if (isNaN(count) || count < 0) return;

        const updatedRows: RowData[] = [];
        for (let i = 0; i < count; i++) {
            const template = MASTER_DATA[i % MASTER_DATA.length];
            updatedRows.push({
                id: i + 1,
                ...template
            });
        }
        setData(updatedRows);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (!isHandleDragging) {
            e.preventDefault();
            return; 
        }
        setDraggedIdx(index);
        
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
        closeContextMenu();
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIdx === null) return;
        setDropTargetIdx(index);
    };

    const handleDrop = (targetIdx: number) => {
        if (draggedIdx === null || draggedIdx === targetIdx) {
            resetDragState();
            return;
        }
        moveColumn(draggedIdx, targetIdx);
        resetDragState();
    };

    const resetDragState = () => {
        setDraggedIdx(null);
        setDropTargetIdx(null);
        setIsHandleDragging(false);
    };

    const getDropIndicatorClass = (index: number) => {
        if (draggedIdx === null || dropTargetIdx === null || draggedIdx === dropTargetIdx) return '';
        if (index === dropTargetIdx) return 'drop-indicator-both';
        return '';
    };

    const handleContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            columnIndex: index
        });
    };

    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const moveColumn = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= columns.length) return;
        const updatedColumns = [...columns];
        const [movedItem] = updatedColumns.splice(fromIdx, 1);
        updatedColumns.splice(toIdx, 0, movedItem);
        setColumns(updatedColumns);
    };

    const handleMoveLeftClick = () => {
        if (contextMenu.columnIndex > 0) {
            moveColumn(contextMenu.columnIndex, contextMenu.columnIndex - 1);
        }
        closeContextMenu();
    };

    const handleMoveRightClick = () => {
        if (contextMenu.columnIndex < columns.length - 1) {
            moveColumn(contextMenu.columnIndex, contextMenu.columnIndex + 1);
        }
        closeContextMenu();
    };

    return (
        <div className="table-page-container" onClick={closeContextMenu}>
            <div className="table-header-section">
                <h2>BOM Table</h2>
                <span className="metadata-tag">Type: {wvmType} | ID: {wvmId || 'None'}</span>
            </div>
            
            <div className="table-controls">
                <label htmlFor="row-count-input">Rows: </label>
                <input 
                    id="row-count-input"
                    type="number" 
                    min="0"
                    value={rowCountInput}
                    onChange={handleRowCountChange}
                    onClick={(e) => e.stopPropagation()}
                    className="row-count-field"
                />
            </div>

            <div className="table-wrapper">
                <table className="custom-table">
                    <thead>
                        <tr>
                            {columns.map((col, index) => (
                                <th
                                    key={col.key}
                                    draggable={isHandleDragging}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={() => handleDrop(index)}
                                    onDragEnd={resetDragState}
                                    onContextMenu={(e) => handleContextMenu(e, index)}
                                    className={`table-th ${draggedIdx === index ? 'dragging-active' : ''} ${getDropIndicatorClass(index)}`}
                                >
                                    <div className="th-content-wrapper">
                                        <span className="th-text">{col.label}</span>
                                        <div 
                                            className="grid-drag-handle"
                                            draggable
                                            onMouseDown={() => setIsHandleDragging(true)}
                                            onMouseUp={() => setIsHandleDragging(false)}
                                        >
                                            ⋮⋮
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.id} className="table-tr">
                                {columns.map((col, index) => (
                                    <td 
                                        key={col.key} 
                                        className={`table-td ${getDropIndicatorClass(index)}`}
                                    >
                                        {row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {contextMenu.visible && (
                <div 
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        onClick={handleMoveLeftClick}
                        disabled={contextMenu.columnIndex === 0}
                    >
                        Move Left
                    </button>
                    <button 
                        onClick={handleMoveRightClick}
                        disabled={contextMenu.columnIndex === columns.length - 1}
                    >
                        Move Right
                    </button>
                </div>
            )}
        </div>
    );
};