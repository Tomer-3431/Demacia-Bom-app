import type { FC } from "react";
import { useState, useEffect, useRef } from "react";
import "../css/Table.css";

interface RowData {
    id: string;
    type: 'part' | 'subassembly';
    parentId: string | null;
    isExpanded: boolean;
    name: string;
    catalogNumber: string;
    description: string;
    engineer: string;
    comments: string;
    onshapeURL: string;
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
    rowId: string | null;
}

const MIN_LAST_COL_WIDTH = 120;
const DEFAULT_COL_WIDTH = 120;

const INITIAL_DATA: RowData[] = [
    {
        id: '1',
        type: 'subassembly',
        parentId: null,
        isExpanded: true,
        name: 'Main Chassis Assembly',
        catalogNumber: 'ASM-001',
        description: 'Primary load-bearing framework',
        engineer: 'John Doe',
        comments: 'Ready for review',
        onshapeURL: '',
    },
    {
        id: '2',
        type: 'part',
        parentId: '1',
        isExpanded: true,
        name: 'Side Bracket',
        catalogNumber: 'PRT-101',
        description: 'Aluminum mounting bracket',
        engineer: 'Jane Smith',
        comments: 'Tight tolerance holes',
        onshapeURL: '',
    }
];

export const BomPage: FC = () => {
    const [data, setData] = useState<RowData[]>(INITIAL_DATA);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'name', label: 'Name', type: 'string' },
        { key: 'catalogNumber', label: 'Catalog Number', type: 'string' },
        { key: 'description', label: 'Description', type: 'string' },
        { key: 'engineer', label: 'Engineer', type: 'string' },
        { key: 'comments', label: 'Comments', type: 'string' },
        { key: 'onshapeURL', label: 'Onshape URL', type: 'string' },
    ]);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, columnIndex: -1 });
    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState>({ visible: false, x: 0, y: 0, rowId: null });

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [autoLastColWidth, setAutoLastColWidth] = useState<number | null>(null);

    const visibleColumns = columns;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeContextMenu();
            }
        };
        const handleScroll = () => {
            closeContextMenu();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (!lastCol) {
            setAutoLastColWidth(null);
            return;
        }

        const recompute = () => {
            if (Object.prototype.hasOwnProperty.call(columnWidths, lastCol.key)) {
                setAutoLastColWidth(null);
                return;
            }

            const othersWidth = visibleColumns
                .slice(0, -1)
                .reduce((sum, c) => sum + (columnWidths[c.key] || DEFAULT_COL_WIDTH), 0);

            const available = wrapper.clientWidth - othersWidth;
            const computedWidth = Math.max(MIN_LAST_COL_WIDTH, available);
            setAutoLastColWidth(computedWidth);
        };

        recompute();

        const ro = new ResizeObserver(recompute);
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, [visibleColumns, columnWidths]);

    const getVisibleData = (): RenderRow[] => {
        const result: RenderRow[] = [];
        const addChildren = (parentId: string | null, level: number) => {
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

    const focusNextAvailableCell = (rIdx: number, cIdx: number, dRow: number, dCol: number) => {
        let targetRow = rIdx;
        let targetCol = cIdx;

        while (true) {
            targetRow += dRow;
            targetCol += dCol;

            if (targetRow < 0 || targetRow >= visibleData.length) break;
            if (targetCol < 0 || targetCol >= visibleColumns.length) break;

            const cellElement = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`) as HTMLInputElement | HTMLSelectElement;
            if (cellElement && !cellElement.disabled) {
                cellElement.focus();
                if (cellElement instanceof HTMLInputElement) {
                    if (dCol === 1) cellElement.setSelectionRange(0, 0);
                    else if (dCol === -1) cellElement.setSelectionRange(cellElement.value.length, cellElement.value.length);
                    else cellElement.select();
                }
                break;
            }
        }
    };

    const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
        const target = e.currentTarget as HTMLInputElement | HTMLSelectElement;
        const isInput = target.tagName === 'INPUT';
        const input = target as HTMLInputElement;

        const isCtrl = e.ctrlKey;
        const isUp = e.key === 'ArrowUp';
        const isDown = e.key === 'ArrowDown';
        const isLeft = e.key === 'ArrowLeft';
        const isRight = e.key === 'ArrowRight';

        if (isUp || isDown) {
            e.preventDefault();
            const dRow = isUp ? -1 : 1;
            focusNextAvailableCell(rowIndex, colIndex, dRow, 0);
        } else if (isLeft) {
            if (isCtrl || (isInput && input.selectionStart === 0 && input.selectionEnd === 0)) {
                e.preventDefault();
                focusNextAvailableCell(rowIndex, colIndex, 0, -1);
            }
        } else if (isRight) {
            if (isCtrl || (isInput && input.selectionStart === input.value.length && input.selectionEnd === input.value.length)) {
                e.preventDefault();
                focusNextAvailableCell(rowIndex, colIndex, 0, 1);
            }
        } else if (e.key === 'Enter') {
            target.blur();
        }
    };

    const handleResizeStart = (e: React.PointerEvent, key: string) => {
        e.stopPropagation();
        e.preventDefault();

        const th = (e.target as HTMLElement).closest('th');
        if (!th) return;

        const table = th.closest('table');
        const colIndex = Array.from(th.parentNode?.children || []).indexOf(th);
        const colElement = table?.querySelector('colgroup')?.children[colIndex] as HTMLElement;

        const initialWidth = colElement ? colElement.getBoundingClientRect().width : th.getBoundingClientRect().width;
        const startX = e.clientX;
        const wrapper = th.closest('.table-wrapper') as HTMLElement;

        let currentWidth = initialWidth;
        let latestClientX = startX;
        let isActive = true;
        let rafId: number | null = null;

        const EDGE_ZONE = 40;
        const MAX_EDGE_SPEED = 40;

        const targetElement = e.target as HTMLElement;
        targetElement.setPointerCapture(e.pointerId);

        const applyWidth = (w: number) => {
            currentWidth = Math.max(60, w);
            if (colElement) colElement.style.width = `${currentWidth}px`;
            if (table) table.style.width = 'max-content';
        };

        const tick = () => {
            if (!isActive) return;

            const rawDelta = latestClientX - startX;
            const absDelta = Math.abs(rawDelta);
            const isShrinking = rawDelta < 0;

            const speedMultiplier = 1 + (absDelta * 0.015);
            const scaledDelta = rawDelta * speedMultiplier;

            applyWidth(initialWidth + scaledDelta);

            const distanceIntoRightEdge = latestClientX - (window.innerWidth - EDGE_ZONE);
            if (distanceIntoRightEdge > 0) {
                const growth = Math.min(MAX_EDGE_SPEED, (distanceIntoRightEdge / EDGE_ZONE) * MAX_EDGE_SPEED);
                applyWidth(currentWidth + growth);
                if (wrapper) wrapper.scrollLeft += growth * 1.5;
            } else if (latestClientX <= EDGE_ZONE) {
                const distanceIntoLeftEdge = EDGE_ZONE - latestClientX;
                const shrink = Math.min(MAX_EDGE_SPEED, (distanceIntoLeftEdge / EDGE_ZONE) * MAX_EDGE_SPEED);
                applyWidth(currentWidth - shrink);
            }

            if (wrapper && !isShrinking) {
                const wrapperRect = wrapper.getBoundingClientRect();
                if (latestClientX > wrapperRect.right - 100) {
                    const scrollPush = Math.max(5, (latestClientX - (wrapperRect.right - 100)) * 0.8);
                    wrapper.scrollLeft += scrollPush;
                }
            }

            rafId = requestAnimationFrame(tick);
        };

        const onPointerMove = (moveEvent: PointerEvent) => {
            latestClientX = moveEvent.clientX;
        };

        const onPointerUp = (upEvent: PointerEvent) => {
            isActive = false;
            if (rafId !== null) cancelAnimationFrame(rafId);
            targetElement.releasePointerCapture(upEvent.pointerId);
            targetElement.removeEventListener('pointermove', onPointerMove);
            targetElement.removeEventListener('pointerup', onPointerUp);

            setColumnWidths(prev => ({ ...prev, [key]: currentWidth }));
        };

        targetElement.addEventListener('pointermove', onPointerMove);
        targetElement.addEventListener('pointerup', onPointerUp);
        rafId = requestAnimationFrame(tick);
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

    const handleAddRow = (type: 'part' | 'subassembly', parentId: string | null = null) => {
        const newId = String(data.length > 0 ? Math.max(...data.map(row => Number(row.id) || data.length)) + 1 : 1);
        const newRow: RowData = {
            id: newId,
            type,
            parentId,
            isExpanded: true,
            name: type === 'subassembly' ? 'New Subassembly' : 'New Part',
            catalogNumber: '',
            description: '',
            engineer: '',
            comments: '',
            onshapeURL: '',
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

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(prev => {
            const target = prev.find(r => r.id === id);
            const newState = target ? !target.isExpanded : true;
            return prev.map(row => row.id === id ? { ...row, isExpanded: newState } : row);
        });
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
        if (dropTargetIdx !== index) {
            setDropTargetIdx(index);
        }
    };

    const handleDrop = (targetIdx: number) => {
        if (draggedIdx === null || draggedIdx === targetIdx) {
            resetDragState();
            return;
        }
        const originalFromIdx = columns.findIndex(c => c.key === visibleColumns[draggedIdx].key);
        const originalToIdx = columns.findIndex(c => c.key === visibleColumns[targetIdx].key);
        moveColumn(originalFromIdx, originalToIdx);
        resetDragState();
    };

    const resetDragState = () => {
        setDraggedIdx(null);
        setDropTargetIdx(null);
        setIsHandleDragging(false);
    };

    const getDropIndicatorClass = (index: number) => (draggedIdx !== null && dropTargetIdx !== null && index === dropTargetIdx && draggedIdx !== dropTargetIdx) ? 'drop-indicator-both' : '';

    const handleCellChange = (rowId: string, col: ColumnConfig, rawValue: string) => {
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updatedRow = { ...row };
            (updatedRow as any)[col.key] = rawValue;
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

    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setRowContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleRowContextMenu = (e: React.MouseEvent, rowId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId });
    };

    const handleDeleteRowClick = () => {
        if (rowContextMenu.rowId !== null) {
            const idsToDelete = new Set<string>();
            const queue = [rowContextMenu.rowId];
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                idsToDelete.add(currentId);
                data.forEach(row => { if (row.parentId === currentId) queue.push(row.id); });
            }
            setData(prev => prev.filter(row => !idsToDelete.has(row.id)));
        }
        closeContextMenu();
    };

    return (
        <div className="table-page-container" onClick={closeContextMenu}>
            <div className="table-header-section">
                <h2>BOM Table</h2>
            </div>

            <div className="table-controls">
                <button type="button" onClick={() => handleAddRow('part')}>+ Add Part</button>
                <button type="button" onClick={() => handleAddRow('subassembly')} className="btn-secondary">+ Add Subassembly</button>
            </div>

            <div className="table-wrapper" ref={wrapperRef}>
                <table className="custom-table">
                    <colgroup>
                        {visibleColumns.map((col, idx) => {
                            const isLast = idx === visibleColumns.length - 1;
                            const width =
                                columnWidths[col.key] ??
                                (isLast && autoLastColWidth !== null ? autoLastColWidth : DEFAULT_COL_WIDTH);
                            return <col key={col.key} style={{ width }} />;
                        })}
                    </colgroup>
                    <thead>
                        <tr>
                            {visibleColumns.map((col, index) => (
                                <th
                                    key={col.key}
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
                                        onPointerDown={(e) => handleResizeStart(e, col.key)}
                                        onDoubleClick={(e) => handleResizeDoubleClick(e, col.key, col.label)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleData.map((row, rowIndex) => {
                            const isSubassembly = row.type === 'subassembly';

                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => handleRowContextMenu(e, row.id)}>
                                    {visibleColumns.map((col, colIndex) => {
                                        const displayValue: string = row[col.key as keyof RowData] as string || '';

                                        return (
                                            <td key={col.key} className={`table-td ${getDropIndicatorClass(colIndex)}`}>
                                                <div className="td-content-wrapper" style={colIndex === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    {colIndex === 0 && isSubassembly && (
                                                        <button type="button" className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>{row.isExpanded ? '▼' : '▶'}</button>
                                                    )}
                                                    {colIndex === 0 && !isSubassembly && <span className="expand-placeholder"></span>}

                                                    <input
                                                        data-row={rowIndex}
                                                        data-col={colIndex}
                                                        type="text"
                                                        value={displayValue}
                                                        onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="cell-input"
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
                                <td colSpan={visibleColumns.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                    No items in BOM. Add a part or subassembly to begin.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {contextMenu.visible && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { if (contextMenu.columnIndex > 0) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex - 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === 0}>Move Left</button>
                    <button type="button" onClick={() => { if (contextMenu.columnIndex < columns.length - 1) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex + 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === columns.length - 1}>Move Right</button>
                </div>
            )}
            {rowContextMenu.visible && activeContextMenuRow && (
                <div className="context-menu" style={{ top: rowContextMenu.y, left: rowContextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    {activeContextMenuRow.type === 'subassembly' && (
                        <>
                            <button type="button" onClick={() => handleAddRow('part', activeContextMenuRow.id)}>Add Part Inside</button>
                            <button type="button" onClick={() => handleAddRow('subassembly', activeContextMenuRow.id)}>Add Subassembly Inside</button>
                            <div className="context-divider"></div>
                        </>
                    )}
                    <button type="button" className="delete-btn" onClick={handleDeleteRowClick}>Delete Row</button>
                </div>
            )}
        </div>
    );
};

export default BomPage;