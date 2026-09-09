import { useEffect, useRef, useState } from "react";

export interface RowData {
    id: string;
    parentId: string | null;
    isExpanded: boolean;
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

export interface ColumnConfig {
    key: any;
    label: string;
    type: 'string' | 'number' | 'select' | 'boolean' | 'button';
    buttonText?: string;
    onButtonClick?: (row: RowData & any) => void;
    options?: string[];
    isDisabled?: (row: RowData & any) => boolean;
}

interface TableParam {
    data: (RowData & any)[],
    columnsData: ColumnConfig[],
    newRowFunction: ((id: string, parentId: string | null) => RowData) | undefined,
    setData: (newData: RowData[]) => void,
    minLastColWidth?: number;
    defaultColWidth?: number;
    removeTopRow?: boolean;
}

export const Table: React.FC<TableParam> = ({ data, columnsData, newRowFunction, setData, minLastColWidth = 120, defaultColWidth = 120, removeTopRow = false }) => {
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, columnIndex: -1 });
    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState>({ visible: false, x: 0, y: 0, rowId: null });

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [autoLastColWidth, setAutoLastColWidth] = useState<number | null>(null);

    const [columns, setColumns] = useState<ColumnConfig[]>(columnsData);

    const closeContextMenu = () => { setContextMenu(prev => ({ ...prev, visible: false })); setRowContextMenu(prev => ({ ...prev, visible: false })); };

    const handleRowContextMenu = (e: React.MouseEvent, rowId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeContextMenu();
        };
        const handleScroll = () => closeContextMenu();

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    const activeContextMenuRow = data.find(r => r.id === rowContextMenu.rowId);

    // Recompute the auto-fill width for the last column whenever the
    // wrapper resizes, the visible column set changes, or any column
    // width (manual or otherwise) changes.
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const lastCol = columns[-1];
        if (!lastCol) {
            setAutoLastColWidth(null);
            return;
        }

        const recompute = () => {
            // If the user has manually resized this specific column
            // (it has an explicit entry in columnWidths), respect that
            // and stop auto-filling it.
            if (Object.prototype.hasOwnProperty.call(columnWidths, lastCol.key)) {
                setAutoLastColWidth(null);
                return;
            }

            const othersWidth = columns
                .slice(0, -1)
                .reduce((sum, c) => sum + (columnWidths[c.key] || defaultColWidth), 0);

            const available = wrapper.clientWidth - othersWidth;
            setAutoLastColWidth(Math.max(minLastColWidth, available));
        };

        recompute();

        const ro = new ResizeObserver(recompute);
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, [columns, columnWidths]);

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

        const EDGE_ZONE = 40; // px from screen edge that triggers auto-growth
        const MAX_EDGE_SPEED = 40; // px of column growth per frame at the very edge

        const targetElement = e.target as HTMLElement;
        targetElement.setPointerCapture(e.pointerId);

        const applyWidth = (w: number) => {
            currentWidth = Math.max(60, w);
            if (colElement) colElement.style.width = `${currentWidth}px`;
            if (table) table.style.width = 'max-content';
        };

        // Persistent per-frame loop: runs continuously from pointerdown to
        // pointerup regardless of whether new pointermove events arrive.
        // This lets holding the cursor at the screen edge keep growing the
        // column indefinitely, since the loop doesn't depend on the cursor
        // actually moving any further.
        const tick = () => {
            if (!isActive) return;

            const rawDelta = latestClientX - startX;
            const absDelta = Math.abs(rawDelta);
            const isShrinking = rawDelta < 0;

            const speedMultiplier = 1 + (absDelta * 0.015);
            const scaledDelta = rawDelta * speedMultiplier;

            applyWidth(initialWidth + scaledDelta);

            // Infinite expansion while the cursor rests near/at the right
            // edge of the screen: grow proportionally to how deep into the
            // edge zone the cursor is, every frame, with no upper bound.
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

            // Keep the wrapper scrolled to follow growth even away from the
            // hard screen edge, once the cursor nears the wrapper's own edge.
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
            const val = row[key as keyof typeof data[0]];
            const str = val !== null && val !== undefined ? String(val) : '';
            const indentChars = (columns[0].key === key ? row.level * 3 : 0);
            maxChars = Math.max(maxChars, str.length + indentChars);
        });

        const tightFitWidth = Math.ceil((maxChars * 7.5) + 32);
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(70, tightFitWidth) }));
    };

    type RenderRow = typeof data[0] & { level: number };

    const getVisibleData = (): RenderRow[] => {
        const result: RenderRow[] = [];
        const addChildren = (parentId: string | null, level: number) => {
            const children = data.filter(row => row.parentId === parentId);
            for (const child of children) {
                result.push({ ...child, level })
                if (isParent(child.id) && child.isExpanded) {
                    addChildren(child.id, level + 1);
                }
            }
        };
        addChildren(null, 0);
        return result;
    };

    const isParent = (id: string) => {
        return data.find((row) => row.parentId === id);
    }

    const visibleData = getVisibleData();

    const handleDeleteRowClick = () => {
        if (rowContextMenu.rowId !== null) {
            const idsToDelete = new Set<string>();
            const queue = [rowContextMenu.rowId];
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                idsToDelete.add(currentId);
                data.forEach(row => { if (row.parentId === currentId) queue.push(row.id); });
            }
            setData(data.filter(row => !idsToDelete.has(row.id)));
        }
        closeContextMenu();
    };

    const handleAddRow = (parentId: string | null = null) => {
        const newId = Date.now().toString();
        if (!newRowFunction) return;
        const newRow = newRowFunction(newId, parentId);

        let newData = [...data, newRow];
        if (parentId !== null) newData = newData.map(row => row.id === parentId ? { ...row, isExpanded: true } : row);
        setData(newData);
        closeContextMenu();
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(data.map(row => row.id === id ? { ...row, isExpanded: !row.isExpanded } : row));
    };

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
        const originalFromIdx = columns.findIndex(c => c.key === columns[draggedIdx].key);
        const originalToIdx = columns.findIndex(c => c.key === columns[targetIdx].key);
        moveColumn(originalFromIdx, originalToIdx);
        resetDragState();
    };

    const resetDragState = () => { setDraggedIdx(null); setDropTargetIdx(null); setIsHandleDragging(false); };
    const getDropIndicatorClass = (index: number) => (draggedIdx !== null && dropTargetIdx !== null && index === dropTargetIdx && draggedIdx !== dropTargetIdx) ? 'drop-indicator-both' : '';

    const handleCellChange = (rowId: string, col: ColumnConfig, rawValue: any) => {
        setData(
            data.map(row => {
                if (row.id !== rowId) return row;
                const updatedRow = { ...row };

                if (col.type === 'number') {
                    (updatedRow as any)[col.key] = rawValue;
                } else {
                    (updatedRow as any)[col.key] = rawValue;
                }
                return updatedRow;
            }));
    };

    const handleNumberBlur = (rowId: string, col: ColumnConfig, rawValue: string | number) => {
        const strVal = String(rawValue).trim();
        if (strVal === '' || strVal === '.') {
            handleCellChange(rowId, col, '0');
            return;
        }

        let processed = strVal;
        if (col.key === 'quantity' || col.key === 'revision') {
            const intVal = parseInt(processed, 10);
            const finalVal = isNaN(intVal) ? 0 : Math.max(0, intVal);
            handleCellChange(rowId, col, String(finalVal));
            return;
        }

        if (processed.startsWith('.')) {
            processed = '0' + processed;
        }
        if (processed.endsWith('.')) {
            processed = processed.slice(0, -1);
        }

        const num = Number(processed);
        const finalVal = isNaN(num) ? 0 : num;
        handleCellChange(rowId, col, String(finalVal));
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

    const focusNextAvailableCell = (rIdx: number, cIdx: number, dRow: number, dCol: number) => {
        let targetRow = rIdx;
        let targetCol = cIdx;

        while (true) {
            targetRow += dRow;
            targetCol += dCol;

            if (targetRow < 0 || targetRow >= visibleData.length) break;
            if (targetCol < 0 || targetCol >= columns.length) break;

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

    return (
        <div className="" onClick={closeContextMenu}>
            {newRowFunction &&
                <div className="table-controls">
                    <button onClick={() => handleAddRow()}>+ Add Item</button>
                </div>
            }

            <div className="table-wrapper" ref={wrapperRef}>
                <table className="custom-table">
                    <colgroup>
                        {columns.map((col, idx) => {
                            const isLast = idx === columns.length - 1;
                            const width =
                                columnWidths[col.key] ??
                                (isLast && autoLastColWidth !== null ? autoLastColWidth : defaultColWidth);
                            return <col key={col.key} style={{ width }} />;
                        })}
                    </colgroup>
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
                        {visibleData.filter((_row, i) => !removeTopRow || (i !== 0)).map((row, rowIndex) => {
                            const isRowParent = isParent(row.id);

                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => handleRowContextMenu(e, row.id)}>
                                    {columns.map((col, colIndex) => {
                                        let isCellDisabled = col.isDisabled ? col.isDisabled(row) : false;
                                        let displayValue: string | number = row[col.key] as string | number;

                                        return (
                                            <td key={col.key} className={`table-td ${getDropIndicatorClass(colIndex)} ${isCellDisabled ? 'cell-disabled' : ''}`}>
                                                <div className="td-content-wrapper" style={colIndex === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    {colIndex === 0 && isRowParent && (
                                                        <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>{row.isExpanded ? '▼' : '▶'}</button>
                                                    )}
                                                    {colIndex === 0 && !isRowParent && <span className="expand-placeholder" />}

                                                    {col.type === 'select' ? (
                                                        <select
                                                            data-row={rowIndex}
                                                            data-col={colIndex}
                                                            value={displayValue}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={`cell-input cell-select`}
                                                            disabled={isCellDisabled}
                                                        >
                                                            <option value="" disabled selected>Select...</option>
                                                            {col.options?.map((option) => (
                                                                <option value={option}>{option}</option>
                                                            ))}
                                                        </select>
                                                    ) : col.type === 'button' ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                col.onButtonClick?.(row);
                                                            }}
                                                            disabled={!row[col.key]}
                                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            {col.buttonText || "Action"}
                                                        </button>
                                                    ) : col.type === 'boolean' ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={row[col.key] as boolean}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.checked)}
                                                            className="bg-zinc-950 border border-zinc-800 rounded px-3 text-white mt-4 cell-input"
                                                            disabled={isCellDisabled}
                                                        />
                                                    ) : col.type === 'number' ? (
                                                        <input
                                                            data-row={rowIndex}
                                                            data-col={colIndex}
                                                            type="text"
                                                            inputMode={col.key === 'quantity' || col.key === 'revision' ? 'numeric' : 'decimal'}
                                                            value={displayValue}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                            onBlur={(e) => handleNumberBlur(row.id, col, e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                } else {
                                                                    handleCellKeyDown(e, rowIndex, colIndex);
                                                                }
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="cell-input"
                                                            disabled={isCellDisabled}
                                                        />
                                                    ) : (
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
                        {visibleData.length === 0 && (
                            <tr>
                                <td colSpan={columns.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                    No items in table
                                </td>
                            </tr>
                        )}
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

                    {
                    newRowFunction && (<div>
                        <button onClick={() => handleAddRow(activeContextMenuRow.id)}>add item inside</button>
                        <div className="context-divider" />
                    </div>)
                    }
                    <button onClick={handleDeleteRowClick} className="delete-btn">Delete Row</button>
                </div>
            )}
        </div>
    );
}
