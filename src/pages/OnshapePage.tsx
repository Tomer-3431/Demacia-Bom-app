import type { FC } from "react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import '../css/Table.css';

interface RowData {
    id: number;
    type: 'part' | 'subassembly';
    parentId: number | null;
    isExpanded: boolean;

    projectName: string;
    manufacturingStatus: string;
    partId: string;
    revision: number;
    partName: string;
    whereUsed: string;
    quantity: number;
    documentUrl: string;
    material: string;
    mass: number;
    price: number;
    manufacturingMethod: string;
    producer: string;
    comments: string;
    group: string;
}

interface RenderRow extends RowData {
    level: number;
}

type ColumnKey = keyof Omit<RowData, 'id' | 'type' | 'parentId' | 'isExpanded'>;

interface ColumnConfig {
    key: ColumnKey;
    label: string;
    type: 'string' | 'number' | 'select';
    options?: string[];
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

const PART_STATUS_OPTIONS = [
    'Not Started',
    'In Design',
    'In Review',
    'In Production',
    'Partially Completed',
    'Completed',
    'On Hold',
    'Cancelled'
];

const ASSEMBLY_STATUS_OPTIONS = [
    'Not Started',
    'Parts being made',
    'In construction',
    'On Hold',
    'Completed',
    'Cancelled'
];

const MFG_METHOD_OPTIONS = ['Manually made', 'Printed in 3D', 'CNC', 'Lathe', 'Externally made', 'Milled', 'Purchased externally'];
const GROUP_OPTIONS = ['Unique part', 'Standard part'];

export const OnshapePage: FC = () => {
    const [searchParams] = useSearchParams();

    const worksapceOrVersion = searchParams.get('wv');
    const workspaceOrVersionId = searchParams.get('wvid');
    const microversionId = searchParams.get('mid');

    const [data, setData] = useState<RowData[]>([
        { 
            id: 1, type: 'subassembly', parentId: null, isExpanded: true, 
            projectName: 'Project Alpha', manufacturingStatus: 'In construction', partId: 'ASM-5001', 
            revision: 1, partName: 'Drive System Assembly', whereUsed: 'Main Assembly', quantity: 1, 
            documentUrl: '', material: '', mass: 0, price: 0, 
            manufacturingMethod: '', producer: '', comments: 'Core assembly tracking', group: 'Subassembly' 
        },
        { 
            id: 2, type: 'part', parentId: 1, isExpanded: false, 
            projectName: 'Project Alpha', manufacturingStatus: 'In Production', partId: 'PN-10024', 
            revision: 2, partName: 'Housing, Motor', whereUsed: 'ASM-5001', quantity: 1, 
            documentUrl: 'http://docs/10024', material: 'ABS', mass: 1.2, price: 4.5, 
            manufacturingMethod: 'Printed in 3D', producer: '', comments: '', group: 'Unique part' 
        },
        { 
            id: 3, type: 'part', parentId: 1, isExpanded: false, 
            projectName: 'Project Alpha', manufacturingStatus: 'Completed', partId: 'PN-10025', 
            revision: 1, partName: 'Shaft, Drive', whereUsed: 'ASM-5001', quantity: 1, 
            documentUrl: 'http://docs/10025', material: 'Stainless Steel 304', mass: 2.5, price: 12.0, 
            manufacturingMethod: 'Lathe', producer: '', comments: '', group: 'Standard part' 
        },
        { 
            id: 4, type: 'part', parentId: null, isExpanded: false, 
            projectName: 'Project Alpha', manufacturingStatus: 'On Hold', partId: 'PN-10023', 
            revision: 1, partName: 'Bracket, Mounting', whereUsed: 'Main Assembly', quantity: 2, 
            documentUrl: '', material: 'Aluminum 6061-T6', mass: 0.8, price: 5.0, 
            manufacturingMethod: 'Purchased externally', producer: 'McMaster-Carr', comments: '', group: 'Purchased part' 
        },
    ]);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'projectName', label: 'Project Name', type: 'string' },
        { key: 'manufacturingStatus', label: 'Manufacturing status', type: 'select', options: PART_STATUS_OPTIONS },
        { key: 'partId', label: 'Part ID', type: 'string' },
        { key: 'revision', label: 'Revision', type: 'number' },
        { key: 'partName', label: 'Part Name', type: 'string' },
        { key: 'whereUsed', label: 'Where Used', type: 'string' },
        { key: 'quantity', label: 'Qty', type: 'number' },
        { key: 'documentUrl', label: 'Document URl', type: 'string' },
        { key: 'material', label: 'Material', type: 'string' },
        { key: 'mass', label: 'Mass', type: 'number' },
        { key: 'price', label: 'Price', type: 'number' },
        { key: 'manufacturingMethod', label: 'Manufacturing method', type: 'select', options: MFG_METHOD_OPTIONS },
        { key: 'producer', label: 'Producer', type: 'string' },
        { key: 'comments', label: 'Comments', type: 'string' },
        { key: 'group', label: 'Group', type: 'select', options: GROUP_OPTIONS },
    ]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, columnIndex: -1 });
    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState>({ visible: false, x: 0, y: 0, rowId: null });

    const hasPurchasedParts = data.some(row => row.manufacturingMethod === 'Purchased externally');
    const visibleColumns = columns.filter(col => col.key !== 'producer' || hasPurchasedParts);

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

    // --- Resizing Handlers ---
    const handleResizeStart = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        e.preventDefault();

        const th = (e.target as HTMLElement).closest('th');
        const startWidth = th ? th.getBoundingClientRect().width : 150;
        const startX = e.clientX;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
            setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleResizeDoubleClick = (e: React.MouseEvent, key: string, label: string) => {
        e.stopPropagation();
        
        let maxChars = label.length;
        visibleData.forEach(row => {
            const val = row[key as keyof RowData];
            const str = val !== null && val !== undefined ? String(val) : '';
            const indentChars = (visibleColumns[0].key === key ? row.level * 3 : 0);
            maxChars = Math.max(maxChars, str.length + indentChars);
        });

        const tightFitWidth = Math.ceil((maxChars * 7.5) + 32);
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(70, tightFitWidth) }));
    };

    const handleAddRow = (type: 'part' | 'subassembly', parentId: number | null = null) => {
        const newId = data.length > 0 ? Math.max(...data.map(row => row.id)) + 1 : 1;
        const newRow: RowData = {
            id: newId, type, parentId, isExpanded: true, projectName: '', manufacturingStatus: type === 'subassembly' ? 'Not Started' : 'Not Started',
            partId: '', revision: 1, partName: '', whereUsed: parentId ? 'Subassembly' : 'Main Assembly', quantity: type === 'part' ? 0 : 1,
            documentUrl: '', material: '', mass: 0, price: 0, manufacturingMethod: '', producer: '',
            comments: '', group: type === 'subassembly' ? 'Subassembly' : 'Unique part'
        };
        
        setData(prev => {
            let newData = [...prev, newRow];
            if (parentId !== null) newData = newData.map(row => row.id === parentId ? { ...row, isExpanded: true } : row);
            return newData;
        });
        closeContextMenu();
    };

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(prev => prev.map(row => row.id === id ? { ...row, isExpanded: !row.isExpanded } : row));
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (!isHandleDragging) { e.preventDefault(); return; }
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
        if (draggedIdx === null || draggedIdx === targetIdx) { resetDragState(); return; }
        const originalFromIdx = columns.findIndex(c => c.key === visibleColumns[draggedIdx].key);
        const originalToIdx = columns.findIndex(c => c.key === visibleColumns[targetIdx].key);
        moveColumn(originalFromIdx, originalToIdx);
        resetDragState();
    };

    const resetDragState = () => { setDraggedIdx(null); setDropTargetIdx(null); setIsHandleDragging(false); };
    const getDropIndicatorClass = (index: number) => (draggedIdx !== null && dropTargetIdx !== null && index === dropTargetIdx && draggedIdx !== dropTargetIdx) ? 'drop-indicator-both' : '';

    const handleCellChange = (rowId: number, col: ColumnConfig, rawValue: string) => {
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            
            const updatedRow = { ...row };
            
            if (col.type === 'number') {
                const num = rawValue === '' ? 0 : Number(rawValue);
                (updatedRow as any)[col.key] = isNaN(num) ? Number(row[col.key]) || 0 : num;
            } else {
                (updatedRow as any)[col.key] = rawValue;
            }

            if (col.key === 'manufacturingMethod') {
                if (rawValue === 'Purchased externally') {
                    updatedRow.group = 'Purchased part';
                } else if (row.manufacturingMethod === 'Purchased externally' && rawValue !== 'Purchased externally') {
                    updatedRow.group = 'Unique part';
                    updatedRow.producer = '';
                }
            }
            return updatedRow;
        }));
    };

    const moveColumn = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= columns.length) return;
        const updatedColumns = [...columns];
        const [movedItem] = updatedColumns.splice(fromIdx, 1);
        updatedColumns.splice(toIdx, 0, movedItem);
        setColumns(updatedColumns);
    };

    const handleContextMenu = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        const originalIndex = columns.findIndex(c => c.key === key);
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: originalIndex });
    };

    const closeContextMenu = () => { setContextMenu(prev => ({ ...prev, visible: false })); setRowContextMenu(prev => ({ ...prev, visible: false })); };

    const handleRowContextMenu = (e: React.MouseEvent, rowId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId });
    };

    const handleDeleteRowClick = () => {
        if (rowContextMenu.rowId !== null) {
            const idsToDelete = new Set<number>();
            const queue = [rowContextMenu.rowId];
            while(queue.length > 0) {
                const currentId = queue.shift()!;
                idsToDelete.add(currentId);
                data.forEach(row => { if (row.parentId === currentId) queue.push(row.id); });
            }
            setData(prev => prev.filter(row => !idsToDelete.has(row.id)));
        }
        closeContextMenu();
    };

    const getStatusClass = (status: string) => {
        switch(status) {
            case 'Not Started': return 'status-bg-gray';
            case 'In Design': return 'status-bg-purple';
            case 'In Review': return 'status-bg-blue';
            case 'In Production': return 'status-bg-yellow';
            case 'Parts being made': return 'status-bg-cyan';
            case 'In construction': return 'status-bg-orange';
            case 'Partially Completed': return 'status-bg-light-green';
            case 'Completed': return 'status-bg-green';
            case 'On Hold': return 'status-bg-orange';
            case 'Cancelled': return 'status-bg-red';
            default: return '';
        }
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
                            {visibleColumns.map((col, index) => (
                                <th
                                    key={col.key}
                                    style={{ width: columnWidths[col.key], minWidth: columnWidths[col.key] || 120 }}
                                    draggable={isHandleDragging}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={() => handleDrop(index)}
                                    onDragEnd={resetDragState}
                                    onContextMenu={(e) => handleContextMenu(e, col.key)}
                                    className={`table-th ${draggedIdx === index ? 'dragging-active' : ''} ${getDropIndicatorClass(index)}`}
                                >
                                    <div className="th-content-wrapper">
                                        <span className="th-text">{col.label}</span>
                                        <div className="grid-drag-handle" draggable onMouseDown={() => setIsHandleDragging(true)} onMouseUp={() => setIsHandleDragging(false)}>⋮⋮</div>
                                    </div>
                                    <div 
                                        className="col-resize-handle"
                                        onMouseDown={(e) => handleResizeStart(e, col.key)}
                                        onDoubleClick={(e) => handleResizeDoubleClick(e, col.key, col.label)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleData.map((row) => {
                            const isSubassembly = row.type === 'subassembly';
                            const isPurchased = row.manufacturingMethod === 'Purchased externally';

                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => handleRowContextMenu(e, row.id)}>
                                    {visibleColumns.map((col, index) => {
                                        let isCellDisabled = false;
                                        let displayValue: string | number = row[col.key] as string | number;

                                        if (isSubassembly) {
                                            // Subassemblies can now have comments along with Part ID, Part Name, Quantity, and Group
                                            const allowedSubassemblyCols = ['partId', 'partName', 'quantity', 'group', 'manufacturingStatus', 'comments', 'projectName', 'whereUsed'];
                                            if (!allowedSubassemblyCols.includes(col.key)) isCellDisabled = true;
                                        }

                                        if (col.key === 'producer' && !isPurchased) isCellDisabled = true;
                                        if (col.key === 'group' && (isSubassembly || isPurchased)) {
                                            isCellDisabled = true;
                                            displayValue = isSubassembly ? 'Subassembly' : 'Purchased part';
                                        }

                                        const isStatusCol = col.key === 'manufacturingStatus';
                                        const statusColorClass = isStatusCol ? getStatusClass(displayValue as string) : '';
                                        const activeStatusOptions = isSubassembly ? ASSEMBLY_STATUS_OPTIONS : PART_STATUS_OPTIONS;

                                        return (
                                            <td key={col.key} className={`table-td ${getDropIndicatorClass(index)} ${isCellDisabled ? 'cell-disabled' : ''}`}>
                                                <div className="td-content-wrapper" style={index === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    {index === 0 && isSubassembly && (
                                                        <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>{row.isExpanded ? '▼' : '▶'}</button>
                                                    )}
                                                    {index === 0 && !isSubassembly && <span className="expand-placeholder"></span>}

                                                    {col.type === 'select' ? (
                                                        <select
                                                            value={displayValue}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`cell-input cell-select ${statusColorClass}`}
                                                            disabled={isCellDisabled}
                                                        >
                                                            <option value="" disabled hidden>Select...</option>
                                                            {isStatusCol ? (
                                                                activeStatusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                                                            ) : (
                                                                col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
                                                            )}
                                                            {col.key === 'group' && (isSubassembly || isPurchased) && (
                                                                <option value={displayValue}>{displayValue}</option>
                                                            )}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type={col.type === 'number' ? 'number' : 'text'}
                                                            value={displayValue}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="cell-input"
                                                            disabled={isCellDisabled}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {contextMenu.visible && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { if (contextMenu.columnIndex > 0) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex - 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === 0}>Move Left</button>
                    <button onClick={() => { if (contextMenu.columnIndex < columns.length - 1) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex + 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === columns.length - 1}>Move Right</button>
                </div>
            )}
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