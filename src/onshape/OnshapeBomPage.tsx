import type { FC } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
    useOnshapeContext,
    useOnshapeClient,
    useOnshapeKeepAlive,
    useOnshapeMessage,
    isSaveChangesMessage
} from '../util/OnshapeExtension';
import { type RowData, type RenderRow, type RawBomNode, PART_STATUS_OPTIONS, ASSEMBLY_STATUS_OPTIONS } from "./TableDefs/bomRows";
import { type ColumnConfig, INITIAL_COLUMNS } from "./TableDefs/bomColumns";
import '../css/Table.css';

interface ContextMenuState { visible: boolean; x: number; y: number; columnIndex: number; }
interface RowContextMenuState { visible: boolean; x: number; y: number; rowId: number | null; }

const MIN_LAST_COL_WIDTH = 120;
const DEFAULT_COL_WIDTH = 120;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5050';

const parseOnshapeBomResponse = (json: any): RawBomNode[] => {
    const bomTable = json.bomTable || json;
    const items = bomTable.items || json.items || (Array.isArray(json) ? json : []);

    const parseItems = (itemList: any[]): RawBomNode[] => {
        return itemList.map((item, idx) => {
            const values = item.headerIdToValue || item.propertyValues || {};
            const name = values.name || values.Name || item.name || item.partName || `Part ${idx + 1}`;
            
            let materialVal = '';
            const rawMaterial = values.material || values.Material || values.MATERIAL || item.material;
            if (rawMaterial) {
                materialVal = typeof rawMaterial === 'object' && rawMaterial !== null 
                    ? (rawMaterial.displayName || rawMaterial.name || rawMaterial.title || '') 
                    : String(rawMaterial);
            }

            const hasChildren = Boolean(item.children && item.children.length > 0);

            return {
                id: item.id || `onshape_item_${idx}_${Math.random()}`,
                type: item.type || (hasChildren ? 'subassembly' : 'part'),
                partName: String(name),
                partId: String(values.partNumber || values.PartNumber || values.itemCode || item.partId || ''),
                revision: Number(values.revision || values.Revision || item.revision || 1),
                quantity: values.quantity || values.Quantity || item.quantity || 1,
                material: materialVal,
                mass: values.mass || values.Mass || item.mass || 0,
                manufacturingStatus: String(values.state || values.status || item.manufacturingStatus || 'In Design'),
                manufacturingMethod: String(values.vendor || values.mfgMethod || item.manufacturingMethod || ''),
                comments: String(values.description || values.note || item.comments || ''),
                children: item.children ? parseItems(item.children) : []
            };
        });
    };
    return parseItems(items);
};

const flattenBomTree = (nodes: RawBomNode[], parentId: number | null, counterRef: { current: number }): RowData[] => {
    const result: RowData[] = [];
    for (const node of nodes) {
        const id = counterRef.current++;
        result.push({
            id, type: node.type, parentId, isExpanded: true,
            projectName: node.projectName ?? '',
            manufacturingStatus: node.manufacturingStatus ?? 'Not Started',
            partId: node.partId ?? '',
            revision: node.revision ?? 1,
            partName: node.partName ?? node.name ?? '',
            whereUsed: node.whereUsed ?? '',
            quantity: node.quantity ?? (node.type === 'part' ? 0 : 1),
            documentUrl: node.documentUrl ?? '',
            material: node.material ?? '',
            mass: node.mass ?? 0,
            price: node.price ?? 0,
            manufacturingMethod: node.manufacturingMethod ?? '',
            producer: node.producer ?? '',
            comments: node.comments ?? '',
            group: node.group ?? (node.type === 'subassembly' ? 'Subassembly' : 'Unique part'),
        });
        if (node.children?.length) {
            result.push(...flattenBomTree(node.children, id, counterRef));
        }
    }
    return result;
};

export const OnshapePage: FC = () => {
    const [searchParams] = useSearchParams();
    const context = useOnshapeContext();
    const client = useOnshapeClient({ context });
    useOnshapeKeepAlive(client);

    useOnshapeMessage(client, (message) => {
        if (isSaveChangesMessage(message)) client.finishedSaving(message.messageId);
    });

    const workspaceOrVersion = context.workspaceId ? 'w' : context.versionId ? 'v' : (searchParams.get('wv') || 'w');
    const workspaceOrVersionId = context.workspaceId || context.versionId || searchParams.get('wvid');
    const microversionId = context.microversionId || searchParams.get('mid') || '';
    const docId = context.documentId || searchParams.get('documentId') || searchParams.get('did') || searchParams.get('d');
    const elementId = context.elementId || searchParams.get('elementId') || searchParams.get('eid') || searchParams.get('e');

    const [data, setData] = useState<RowData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [columns, setColumns] = useState<ColumnConfig[]>(INITIAL_COLUMNS);
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
    const [isHandleDragging, setIsHandleDragging] = useState<boolean>(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, columnIndex: -1 });
    const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState>({ visible: false, x: 0, y: 0, rowId: null });

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [autoLastColWidth, setAutoLastColWidth] = useState<number | null>(null);
    const hasFetchedRef = useRef(false);

    const fetchParts = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            let res: Response | null = null;
            try {
                let targetUrl = `${API_BASE}/api/db/bom/all`;
                if (docId && workspaceOrVersion && workspaceOrVersionId && elementId) {
                    targetUrl = `${API_BASE}/api/onshape/bom/d/${docId}/wvmT/${workspaceOrVersion}/wvmI/${workspaceOrVersionId}/e/${elementId}`;
                }
                res = await fetch(targetUrl, { signal });
            } catch {}

            if ((!res || !res.ok) && docId && workspaceOrVersion && workspaceOrVersionId && elementId) {
                const targetOnshapeApi = `https://cad.onshape.com/api/v2/assemblies/d/${docId}/${workspaceOrVersion}/${workspaceOrVersionId}/e/${elementId}/bom?indented=true`;
                const headers: Record<string, string> = { 'Accept': 'application/vnd.onshape.v2+json' };
                const storedToken = localStorage.getItem('ONSHAPE_API_TOKEN');
                if (storedToken) {
                    headers['Authorization'] = storedToken.startsWith('Basic ') || storedToken.startsWith('Bearer ') ? storedToken : `Bearer ${storedToken}`;
                }
                res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetOnshapeApi)}`, { signal, headers });
            }

            if (!res || !res.ok) {
                res = await fetch(`${API_BASE}/api/db/bom/all`, { signal });
            }

            if (!res || !res.ok) throw new Error(`Server or Onshape API returned status ${res?.status || 'Error'}.`);

            const json = await res.json();
            const rawNodes = parseOnshapeBomResponse(json);
            setData(flattenBomTree(rawNodes, null, { current: 1 }));
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [docId, workspaceOrVersion, workspaceOrVersionId, elementId]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        const controller = new AbortController();
        fetchParts(controller.signal);
        return () => controller.abort();
    }, [fetchParts]);

    useEffect(() => {
        const close = () => { setContextMenu(p => ({ ...p, visible: false })); setRowContextMenu(p => ({ ...p, visible: false })); };
        window.addEventListener('keydown', (e) => e.key === 'Escape' && close());
        window.addEventListener('scroll', close, true);
        return () => { window.removeEventListener('keydown', (e) => e.key === 'Escape' && close()); window.removeEventListener('scroll', close, true); };
    }, []);

    const hasPurchasedParts = data.some(row => row.manufacturingMethod === 'Purchased externally');
    const visibleColumns = columns.filter(col => col.key !== 'producer' || hasPurchasedParts);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (!lastCol) { setAutoLastColWidth(null); return; }

        const recompute = () => {
            if (Object.prototype.hasOwnProperty.call(columnWidths, lastCol.key)) { setAutoLastColWidth(null); return; }
            const othersWidth = visibleColumns.slice(0, -1).reduce((sum, c) => sum + (columnWidths[c.key] || DEFAULT_COL_WIDTH), 0);
            setAutoLastColWidth(Math.max(MIN_LAST_COL_WIDTH, wrapper.clientWidth - othersWidth));
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, [visibleColumns, columnWidths]);

    const getVisibleData = (): RenderRow[] => {
        const result: RenderRow[] = [];
        const addChildren = (parentId: number | null, level: number) => {
            const children = data.filter(row => row.parentId === parentId);
            for (const child of children) {
                result.push({ ...child, level });
                if (child.type === 'subassembly' && child.isExpanded) addChildren(child.id, level + 1);
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
        e.stopPropagation(); e.preventDefault();
        const th = (e.target as HTMLElement).closest('th');
        if (!th) return;
        const table = th.closest('table');
        const colIdx = Array.from(th.parentNode?.children || []).indexOf(th);
        const colEl = table?.querySelector('colgroup')?.children[colIdx] as HTMLElement;
        const initWidth = colEl ? colEl.getBoundingClientRect().width : th.getBoundingClientRect().width;
        const startX = e.clientX;
        let currWidth = initWidth;

        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const onMove = (mv: PointerEvent) => {
            currWidth = Math.max(60, initWidth + (mv.clientX - startX));
            if (colEl) colEl.style.width = `${currWidth}px`;
            if (table) table.style.width = 'max-content';
        };
        const onUp = (up: PointerEvent) => {
            target.releasePointerCapture(up.pointerId);
            target.removeEventListener('pointermove', onMove);
            target.removeEventListener('pointerup', onUp);
            setColumnWidths(p => ({ ...p, [key]: currWidth }));
        };
        target.addEventListener('pointermove', onMove);
        target.addEventListener('pointerup', onUp);
    };

    const handleAddRow = (type: 'part' | 'subassembly', parentId: number | null = null) => {
        const newId = data.length > 0 ? Math.max(...data.map(r => r.id)) + 1 : 1;
        const newRow: RowData = {
            id: newId, type, parentId, isExpanded: true, projectName: '', manufacturingStatus: 'Not Started',
            partId: '', revision: 1, partName: '', whereUsed: parentId ? 'Subassembly' : 'Main Assembly', quantity: type === 'part' ? 0 : 1,
            documentUrl: '', material: '', mass: 0, price: 0, manufacturingMethod: '', producer: '', comments: '', group: type === 'subassembly' ? 'Subassembly' : 'Unique part'
        };
        setData(prev => parentId !== null ? prev.map(r => r.id === parentId ? { ...r, isExpanded: true } : r).concat(newRow) : [...prev, newRow]);
        setRowContextMenu(p => ({ ...p, visible: false }));
    };

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(prev => prev.map(r => r.id === id ? { ...r, isExpanded: !r.isExpanded } : r));
    };

    const handleCellChange = (rowId: number, col: ColumnConfig, val: string) => {
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updated = { ...row, [col.key]: val };
            if (col.key === 'manufacturingMethod') {
                if (val === 'Purchased externally') {
                    updated.group = 'Purchased part';
                } else if (row.manufacturingMethod === 'Purchased externally') {
                    updated.group = 'Unique part';
                    updated.producer = '';
                }
            }
            return updated;
        }));
    };

    const handleDeleteRow = () => {
        if (rowContextMenu.rowId !== null) {
            const idsToDelete = new Set<number>();
            const queue = [rowContextMenu.rowId];
            while (queue.length > 0) {
                const cur = queue.shift()!;
                idsToDelete.add(cur);
                data.forEach(r => r.parentId === cur && queue.push(r.id));
            }
            setData(prev => prev.filter(r => !idsToDelete.has(r.id)));
        }
        setRowContextMenu(p => ({ ...p, visible: false }));
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Not Started': return 'status-bg-gray';
            case 'In Design': return 'status-bg-purple';
            case 'In Review': return 'status-bg-blue';
            case 'In Production': return 'status-bg-yellow';
            case 'Completed': return 'status-bg-green';
            default: return '';
        }
    };

    return (
        <div className="table-page-container" onClick={() => { setContextMenu(p => ({ ...p, visible: false })); setRowContextMenu(p => ({ ...p, visible: false })); }}>
            <div className="table-header-section">
                <h2>BOM Table</h2>
                <div className="metadata-tag">
                    <div>wv: {workspaceOrVersion || 'None'}</div>
                    <div>wvid: {workspaceOrVersionId || 'None'}</div>
                    <div>mid: {microversionId || 'None'}</div>
                </div>
            </div>

            <div className="table-controls">
                <button onClick={() => handleAddRow('part')}>+ Add Part</button>
                <button onClick={() => handleAddRow('subassembly')} className="btn-secondary">+ Add Subassembly</button>
                <button onClick={() => fetchParts()} className="btn-secondary">↻ Refresh</button>
            </div>

            {loading && <div style={{ padding: 12 }}>Loading BOM…</div>}
            {error && <div style={{ padding: 12, color: '#b91c1c' }}>Failed to load parts: {error}</div>}

            <div className="table-wrapper" ref={wrapperRef}>
                <table className="custom-table">
                    <colgroup>
                        {visibleColumns.map((col, idx) => (
                            <col key={col.key} style={{ width: columnWidths[col.key] ?? (idx === visibleColumns.length - 1 && autoLastColWidth !== null ? autoLastColWidth : DEFAULT_COL_WIDTH) }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {visibleColumns.map((col, index) => (
                                <th key={col.key} draggable={isHandleDragging} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: columns.findIndex(c => c.key === col.key) }); }} className="table-th">
                                    <div className="th-content-wrapper">
                                        <span className="th-text">{col.label}</span>
                                        <div className="grid-drag-handle" draggable onMouseDown={() => setIsHandleDragging(true)} onMouseUp={() => setIsHandleDragging(false)}>⋮⋮</div>
                                    </div>
                                    <div className="col-resize-handle" onPointerDown={(e) => handleResizeStart(e, col.key)} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleData.map((row, rowIndex) => {
                            const isSub = row.type === 'subassembly';
                            const isPurchased = row.manufacturingMethod === 'Purchased externally';
                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId: row.id }); }}>
                                    {visibleColumns.map((col, colIndex) => {
                                        let isDisabled = isSub && !['partId', 'partName', 'quantity', 'group', 'manufacturingStatus', 'comments', 'projectName', 'whereUsed'].includes(col.key);
                                        if (col.key === 'producer' && !isPurchased) isDisabled = true;
                                        if (col.key === 'group' && (isSub || isPurchased)) isDisabled = true;
                                        const val = row[col.key] as string | number;

                                        return (
                                            <td key={col.key} className={`table-td ${isDisabled ? 'cell-disabled' : ''}`}>
                                                <div className="td-content-wrapper" style={colIndex === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    {colIndex === 0 && isSub && <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>{row.isExpanded ? '▼' : '▶'}</button>}
                                                    {colIndex === 0 && !isSub && <span className="expand-placeholder"></span>}

                                                    {col.type === 'select' ? (
                                                        <select data-row={rowIndex} data-col={colIndex} value={val} onChange={(e) => handleCellChange(row.id, col, e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)} onClick={(e) => e.stopPropagation()} className={`cell-input cell-select ${col.key === 'manufacturingStatus' ? getStatusClass(val as string) : ''}`} disabled={isDisabled}>
                                                            <option value="" disabled hidden>Select...</option>
                                                            {(col.key === 'manufacturingStatus' ? (isSub ? ASSEMBLY_STATUS_OPTIONS : PART_STATUS_OPTIONS) : col.options)?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            {col.key === 'group' && (isSub || isPurchased) && <option value={val}>{val}</option>}
                                                        </select>
                                                    ) : (
                                                        <input data-row={rowIndex} data-col={colIndex} type="text" value={val} onChange={(e) => handleCellChange(row.id, col, e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)} onClick={(e) => e.stopPropagation()} className="cell-input" disabled={isDisabled} />
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
                    <button onClick={() => { if (contextMenu.columnIndex > 0) { const u = [...columns]; const [m] = u.splice(contextMenu.columnIndex, 1); u.splice(contextMenu.columnIndex - 1, 0, m); setColumns(u); } setContextMenu(p => ({ ...p, visible: false })); }} disabled={contextMenu.columnIndex === 0}>Move Left</button>
                    <button onClick={() => { if (contextMenu.columnIndex < columns.length - 1) { const u = [...columns]; const [m] = u.splice(contextMenu.columnIndex, 1); u.splice(contextMenu.columnIndex + 1, 0, m); setColumns(u); } setContextMenu(p => ({ ...p, visible: false })); }} disabled={contextMenu.columnIndex === columns.length - 1}>Move Right</button>
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
                    <button onClick={handleDeleteRow} className="delete-btn">Delete Row</button>
                </div>
            )}
        </div>
    );
};

export default OnshapePage;