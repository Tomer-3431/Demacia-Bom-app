import type { FC } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import '../css/Table.css';

interface RowData {
    id: number;
    type: 'part' | 'subassembly';
    parentId: number | null;
    isExpanded: boolean;
    partId: string;
    description: string;
    manufacturingMethod: string;
    material: string;
    status: string;
    quantity: number;
}

interface RenderRow extends RowData {
    level: number;
}

type ColumnKey = keyof Omit<RowData, 'id' | 'type' | 'parentId' | 'isExpanded'>;

interface ColumnConfig {
    key: ColumnKey;
    label: string;
    type: 'string' | 'number';
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    columnIndex: number;
}

interface RowContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    rowId: number | null;
}

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

    const [data, setData] = useState<RowData[]>([
        { id: 1, type: 'subassembly', parentId: null, isExpanded: true, partId: 'ASM-5001', description: 'Drive System Assembly', manufacturingMethod: '', material: '', status: '', quantity: 1 },
        { id: 2, type: 'part', parentId: 1, isExpanded: false, partId: 'PN-10024', description: 'Housing, Motor', manufacturingMethod: 'Injection Molded', material: 'ABS', status: 'In Review', quantity: 1 },
        { id: 3, type: 'part', parentId: 1, isExpanded: false, partId: 'PN-10025', description: 'Shaft, Drive', manufacturingMethod: 'Turned', material: 'Stainless Steel 304', status: 'Released', quantity: 1 },
        { id: 4, type: 'part', parentId: null, isExpanded: false, partId: 'PN-10023', description: 'Bracket, Mounting', manufacturingMethod: 'CNC Milled', material: 'Aluminum 6061-T6', status: 'Released', quantity: 2 },
    ]);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'partId', label: 'Part ID', type: 'string' },
        { key: 'description', label: 'Description', type: 'string' },
        { key: 'manufacturingMethod', label: 'Manufacturing Method', type: 'string' },
        { key: 'material', label: 'Material', type: 'string' },
        { key: 'status', label: 'Status', type: 'string' },
        { key: 'quantity', label: 'Qty', type: 'number' },
    ]);

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false, x: 0, y: 0, columnIndex: -1
    });

    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState>({
        visible: false, x: 0, y: 0, rowId: null
    });

    // Helper to calculate nested rendering array
    const getVisibleData = (): RenderRow[] => {
        const result: RenderRow[] = [];
        const addChildren = (parentId: number | null, level: number) => {
            const children = data.filter(row => row.parentId === parentId);
            for (const child of children) {
                result.push({ ...child, level });
                if (child.type === 'subassembly' && child.isExpanded) {
                    addChildren(child.id, level + 1);
                }
            }
        };
        addChildren(null, 0);
        return result;
    };

    const visibleData = getVisibleData();
    const activeContextMenuRow = data.find(r => r.id === rowContextMenu.rowId);

    const handleAddRow = (type: 'part' | 'subassembly', parentId: number | null = null) => {
        const newId = data.length > 0 ? Math.max(...data.map(row => row.id)) + 1 : 1;
        const newRow: RowData = {
            id: newId,
            type,
            parentId,
            isExpanded: true,
            partId: '',
            description: '',
            manufacturingMethod: '',
            material: '',
            status: '',
            quantity: type === 'part' ? 0 : 1
        };
        
        setData(prev => {
            let newData = [...prev, newRow];
            if (parentId !== null) {
                newData = newData.map(row => row.id === parentId ? { ...row, isExpanded: true } : row);
            }
            return newData;
        });
        
        closeContextMenu();
    };

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(prev => prev.map(row => row.id === id ? { ...row, isExpanded: !row.isExpanded } : row));
    };

    // Drag and Drop Handlers
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

    // Context Menu Handlers
    const handleContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: index });
    };

    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setRowContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleRowContextMenu = (e: React.MouseEvent, rowId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId });
    };

    const handleDeleteRowClick = () => {
        if (rowContextMenu.rowId !== null) {
            // Cascade delete children if subassembly
            const idsToDelete = new Set<number>();
            const queue = [rowContextMenu.rowId];
            
            while(queue.length > 0) {
                const currentId = queue.shift()!;
                idsToDelete.add(currentId);
                data.forEach(row => {
                    if (row.parentId === currentId) queue.push(row.id);
                });
            }
            setData(prev => prev.filter(row => !idsToDelete.has(row.id)));
        }
        closeContextMenu();
    };

    const handleCellChange = (rowId: number, col: ColumnConfig, rawValue: string) => {
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            if (col.type === 'number') {
                const num = rawValue === '' ? 0 : Number(rawValue);
                return { ...row, [col.key]: isNaN(num) ? row[col.key] : num };
            }
            return { ...row, [col.key]: rawValue };
        }));
    };

    const moveColumn = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= columns.length) return;
        const updatedColumns = [...columns];
        const [movedItem] = updatedColumns.splice(fromIdx, 1);
        updatedColumns.splice(toIdx, 0, movedItem);
        setColumns(updatedColumns);
    };

    const handleMoveLeftClick = () => {
        if (contextMenu.columnIndex > 0) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex - 1);
        closeContextMenu();
    };

    const handleMoveRightClick = () => {
        if (contextMenu.columnIndex < columns.length - 1) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex + 1);
        closeContextMenu();
    };

    return (
        <div className="table-page-container" onClick={closeContextMenu}>
            <div className="table-header-section">
                <h2>BOM Table</h2>
                <div className="metadata-tag">
                    <div>wv: {worksapceOrVersion || 'None'}</div>
                    <div>wvid: {workspaceOrVersionId || 'None'}</div>
                    <div>mid: {microversionId || 'None'}</div>
                </div>
            </div>

            <div className="table-controls">
                <button onClick={() => handleAddRow('part')}>+ Add Part</button>
                <button onClick={() => handleAddRow('subassembly')} className="btn-secondary">+ Add Subassembly</button>
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
                        {visibleData.map((row) => {
                            const isSubassembly = row.type === 'subassembly';

                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => handleRowContextMenu(e, row.id)}>
                                    {columns.map((col, index) => {
                                        const isAllowedCol = ['partId', 'description', 'quantity'].includes(col.key);
                                        const isDisabled = isSubassembly && !isAllowedCol;

                                        return (
                                            <td key={col.key} className={`table-td ${getDropIndicatorClass(index)} ${isDisabled ? 'cell-disabled' : ''}`}>
                                                <div className="td-content-wrapper" style={index === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    
                                                    {/* Render Expander on first column only */}
                                                    {index === 0 && isSubassembly && (
                                                        <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>
                                                            {row.isExpanded ? '▼' : '▶'}
                                                        </button>
                                                    )}
                                                    {index === 0 && !isSubassembly && (
                                                        <span className="expand-placeholder"></span>
                                                    )}

                                                    <input
                                                        type={col.type === 'number' ? 'number' : 'text'}
                                                        value={row[col.key]}
                                                        onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="cell-input"
                                                        disabled={isDisabled}
                                                    />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {visibleData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                    No items in BOM. Add a part or subassembly to begin.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Column Header Context Menu */}
            {contextMenu.visible && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={handleMoveLeftClick} disabled={contextMenu.columnIndex === 0}>Move Left</button>
                    <button onClick={handleMoveRightClick} disabled={contextMenu.columnIndex === columns.length - 1}>Move Right</button>
                </div>
            )}

            {/* Row Context Menu */}
            {rowContextMenu.visible && activeContextMenuRow && (
                <div className="context-menu" style={{ top: rowContextMenu.y, left: rowContextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    {activeContextMenuRow.type === 'subassembly' && (
                        <>
                            <button onClick={() => handleAddRow('part', activeContextMenuRow.id)}>Add Part Inside</button>
                            <button onClick={() => handleAddRow('subassembly', activeContextMenuRow.id)}>Add Subassembly Inside</button>
                            <div className="context-divider"></div>
                        </>
                    )}
                    <button onClick={handleDeleteRowClick} className="delete-btn">Delete Row</button>
                </div>
            )}
        </div>
    );
};