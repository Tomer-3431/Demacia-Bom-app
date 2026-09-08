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
    quantity: number | string;
    documentUrl: string;
    material: string;
    mass: number | string;
    price: number | string;
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

interface RawBomNode {
    id: string | number;
    type: 'part' | 'subassembly';
    projectName?: string;
    manufacturingStatus?: string;
    partId?: string;
    revision?: number;
    partName?: string;
    name?: string;
    whereUsed?: string;
    quantity?: number | string;
    documentUrl?: string;
    material?: string;
    mass?: number | string;
    price?: number | string;
    manufacturingMethod?: string;
    producer?: string;
    comments?: string;
    group?: string;
    children?: RawBomNode[];
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

const MIN_LAST_COL_WIDTH = 120;
const DEFAULT_COL_WIDTH = 120;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5050';

const parseOnshapeBomResponse = (json: any): RawBomNode[] => {
    console.log("[Onshape REST] Parsing raw Onshape BOM payload:", json);
    const bomTable = json.bomTable || json;
    const items = bomTable.items || json.items || [];

    const parseItems = (itemList: any[]): RawBomNode[] => {
        return itemList.map((item, idx) => {
            const values = item.headerIdToValue || item.propertyValues || {};
            const name = values.name || values.Name || item.name || `Part ${idx + 1}`;
            const hasChildren = Boolean(item.children && item.children.length > 0);

            return {
                id: item.id || `onshape_item_${idx}_${Math.random()}`,
                type: hasChildren ? 'subassembly' : 'part',
                partName: String(name),
                partId: String(values.partNumber || values.PartNumber || values.itemCode || ''),
                revision: Number(values.revision || values.Revision || 1),
                quantity: values.quantity || values.Quantity || 1,
                material: typeof values.material === 'object' ? (values.material?.displayName || '') : String(values.material || ''),
                mass: values.mass || values.Mass || 0,
                manufacturingStatus: String(values.state || values.status || 'In Design'),
                manufacturingMethod: String(values.vendor || values.mfgMethod || ''),
                comments: String(values.description || values.note || ''),
                children: item.children ? parseItems(item.children) : []
            };
        });
    };

    return parseItems(items);
};

const flattenBomTree = (
    nodes: RawBomNode[],
    parentId: number | null,
    counterRef: { current: number }
): RowData[] => {
    console.log(`[BOM Flatten] Processing ${nodes.length} nodes at parentId: ${parentId}`);
    const result: RowData[] = [];
    for (const node of nodes) {
        const id = counterRef.current++;
        result.push({
            id,
            type: node.type,
            parentId,
            isExpanded: true,
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
        if (node.children && node.children.length > 0) {
            result.push(...flattenBomTree(node.children, id, counterRef));
        }
    }
    return result;
};

const exchangeCodeForAccessToken = async (
    code: string,
    clientId: string,
    clientSecret: string
): Promise<string | null> => {
    try {
        const tokenEndpoint = `https://corsproxy.io/?${encodeURIComponent('https://oauth.onshape.com/oauth/token')}`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: 'https://localhost:5173'
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Token exchange failed (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (err) {
        console.error("[OAuth Error]", err);
        return null;
    }
};

export const OnshapePage: FC = () => {
    const [searchParams] = useSearchParams();

    const context = useOnshapeContext();
    const client = useOnshapeClient({ context });

    useOnshapeKeepAlive(client);

    useOnshapeMessage(client, (message) => {
        if (isSaveChangesMessage(message)) {
            client.finishedSaving(message.messageId);
        }
    });

    const docId = context.documentId;
    const wvmType = context.workspaceId ? 'w' : context.versionId ? 'v' : 'w';
    const wvmId = context.workspaceId || context.versionId;
    const workspaceOrVersion = wvmType;
    const workspaceOrVersionId = wvmId;
    const microversionId = context.microversionId || searchParams.get('mid') || '';
    const elementId = context.elementId;

    const [data, setData] = useState<RowData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [apiToken, setApiToken] = useState<string>(localStorage.getItem('ONSHAPE_API_TOKEN') || '');
    const [showSettings, setShowSettings] = useState<boolean>(false);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'partName', label: 'Part Name', type: 'string' },
        { key: 'partId', label: 'Part ID', type: 'string' },
        { key: 'quantity', label: 'Qty', type: 'number' },
        { key: 'manufacturingStatus', label: 'Manufacturing status', type: 'select', options: PART_STATUS_OPTIONS },
        { key: 'revision', label: 'Revision', type: 'number' },
        { key: 'projectName', label: 'Project Name', type: 'string' },
        { key: 'whereUsed', label: 'Where Used', type: 'string' },
        { key: 'material', label: 'Material', type: 'string' },
        { key: 'mass', label: 'Mass', type: 'number' },
        { key: 'price', label: 'Price ($)', type: 'number' },
        { key: 'manufacturingMethod', label: 'Manufacturing method', type: 'select', options: MFG_METHOD_OPTIONS },
        { key: 'producer', label: 'Producer', type: 'string' },
        { key: 'comments', label: 'Comments', type: 'string' },
        { key: 'group', label: 'Group', type: 'select', options: GROUP_OPTIONS },
        { key: 'documentUrl', label: 'Document URL', type: 'string' },
    ]);

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

        if (!docId || !wvmId || !elementId) {
            setError("Missing active Onshape Assembly parameters (Document, Workspace/Version, or Element ID).");
            setLoading(false);
            return;
        }

        try {
            let res: Response | null = null;

            try {
                const proxyUrl = `${API_BASE}/api/onshape/bom/d/${docId}/wvmT/${wvmType}/wvmI/${wvmId}/e/${elementId}`;
                res = await fetch(proxyUrl, { signal });
            } catch (proxyErr) {
                console.warn("[API Proxy] Backend server unreachable. Retrying via direct Onshape REST API.");
            }

            if (!res || !res.ok) {
                const targetOnshapeApi = `https://cad.onshape.com/api/v2/assemblies/d/${docId}/${wvmType}/${wvmId}/e/${elementId}/bom?indented=true`;
                const directOnshapeUrl = `https://corsproxy.io/?${encodeURIComponent(targetOnshapeApi)}`;

                const headers: Record<string, string> = {
                    'Accept': 'application/vnd.onshape.v2+json'
                };

                if (apiToken) {
                    let authToken = apiToken.trim();
                    if (authToken.includes(':') && !authToken.startsWith('Basic ')) {
                        authToken = `Basic ${btoa(authToken)}`;
                    } else if (!authToken.startsWith('Basic ') && !authToken.startsWith('Bearer ')) {
                        authToken = `Bearer ${authToken}`;
                    }
                    headers['Authorization'] = authToken;
                }

                res = await fetch(directOnshapeUrl, { signal, headers });
            }

            if (!res.ok) {
                throw new Error(`Onshape API returned status ${res.status} (${res.statusText}). Verify active document permissions or API token.`);
            }

            const json = await res.json();
            const rawNodes = parseOnshapeBomResponse(json);

            const counterRef = { current: 1 };
            const flattened = flattenBomTree(rawNodes, null, counterRef);
            setData(flattened);
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error("[API Error] Failed to fetch real assembly parts:", err.message);
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [docId, wvmType, wvmId, elementId, apiToken]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        const controller = new AbortController();
        fetchParts(controller.signal);
        return () => controller.abort();
    }, [fetchParts]);

    const handleSaveToken = (newToken: string) => {
        setApiToken(newToken);
        localStorage.setItem('ONSHAPE_API_TOKEN', newToken);
        hasFetchedRef.current = false;
        fetchParts();
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

    const hasPurchasedParts = data.some(row => row.manufacturingMethod === 'Purchased externally');
    const visibleColumns = columns.filter(col => col.key !== 'producer' || hasPurchasedParts);

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

    const focusNextAvailableCell = (rIdx: number, cIdx: number, dRow: number, dCol: number) => {
        let targetRow = rIdx;
        let targetCol = cIdx;

        while (true) {
            targetRow += dRow;
            targetCol += dCol;

            if (targetRow < 0 || targetRow >= visibleData.length || targetCol < 0 || targetCol >= visibleColumns.length) break;

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
            focusNextAvailableCell(rowIndex, colIndex, isUp ? -1 : 1, 0);
        } else if (isLeft && (isCtrl || (isInput && input.selectionStart === 0 && input.selectionEnd === 0))) {
            e.preventDefault();
            focusNextAvailableCell(rowIndex, colIndex, 0, -1);
        } else if (isRight && (isCtrl || (isInput && input.selectionStart === input.value.length && input.selectionEnd === input.value.length))) {
            e.preventDefault();
            focusNextAvailableCell(rowIndex, colIndex, 0, 1);
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

        const onPointerMove = (moveEvent: PointerEvent) => { latestClientX = moveEvent.clientX; };

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
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(70, Math.ceil((maxChars * 7.5) + 32)) }));
    };

    const handleAddRow = (type: 'part' | 'subassembly', parentId: number | null = null) => {
        const newId = data.length > 0 ? Math.max(...data.map(row => row.id)) + 1 : 1;
        const newRow: RowData = {
            id: newId, type, parentId, isExpanded: true, projectName: '', manufacturingStatus: 'Not Started',
            partId: '', revision: 1, partName: '', whereUsed: parentId ? 'Subassembly' : 'Main Assembly', quantity: type === 'part' ? 0 : 1,
            documentUrl: '', material: '', mass: 0, price: 0, manufacturingMethod: '', producer: '',
            comments: '', group: type === 'subassembly' ? 'Subassembly' : 'Unique part'
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
        if (draggedIdx !== null && dropTargetIdx !== index) setDropTargetIdx(index);
    };

    const handleDrop = (targetIdx: number) => {
        if (draggedIdx === null || draggedIdx === targetIdx) { resetDragState(); return; }
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

    const handleCellChange = (rowId: number, col: ColumnConfig, rawValue: string) => {
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updatedRow = { ...row, [col.key]: rawValue };

            if (col.key === 'manufacturingMethod') {
                if (rawValue === 'Purchased externally') {
                    updatedRow.group = 'Purchased part';
                } else if (row.manufacturingMethod === 'Purchased externally') {
                    updatedRow.group = 'Unique part';
                    updatedRow.producer = '';
                }
            }
            return updatedRow;
        }));
    };

    const handleNumberBlur = (rowId: number, col: ColumnConfig, rawValue: string | number) => {
        const strVal = String(rawValue).trim();
        if (strVal === '' || strVal === '.') { handleCellChange(rowId, col, '0'); return; }

        let processed = strVal;
        if (col.key === 'quantity' || col.key === 'revision') {
            const intVal = parseInt(processed, 10);
            handleCellChange(rowId, col, String(isNaN(intVal) ? 0 : Math.max(0, intVal)));
            return;
        }

        if (processed.startsWith('.')) processed = '0' + processed;
        if (processed.endsWith('.')) processed = processed.slice(0, -1);
        const num = Number(processed);
        handleCellChange(rowId, col, String(isNaN(num) ? 0 : num));
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
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: columns.findIndex(c => c.key === key) });
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
            const idsToDelete = new Set<number>();
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

    const getStatusClass = (status: string) => {
        switch (status) {
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

    const shortId = (v?: string) => (v ? `${v.slice(0, 8)}…` : '—');

    return (
        <div className="table-page-container" onClick={closeContextMenu} style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden', background: '#f8fafc' }}>

            {/* Header */}
            <div style={{
                padding: '14px 20px',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                            Bill of Materials
                        </h2>
                        <span style={{
                            fontSize: '12px', fontWeight: 600, color: '#2563eb', background: '#eff6ff',
                            border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '999px'
                        }}>
                            {data.length} {data.length === 1 ? 'item' : 'items'}
                        </span>
                        {!error && !loading && (
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>● Live</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            onClick={() => handleAddRow('part')}
                            style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', transition: 'background 0.15s' }}
                        >
                            + Part
                        </button>
                        <button
                            onClick={() => handleAddRow('subassembly')}
                            style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            + Subassembly
                        </button>
                        <button
                            onClick={() => { hasFetchedRef.current = false; fetchParts(); }}
                            title="Refresh"
                            style={{ padding: '6px 10px', fontSize: '13px', cursor: 'pointer', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            ↻
                        </button>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            title="Settings"
                            style={{ padding: '6px 10px', fontSize: '13px', cursor: 'pointer', background: showSettings ? '#e2e8f0' : '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        >
                            ⚙
                        </button>
                    </div>
                </div>

                {/* Metadata strip */}
                <div style={{
                    marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '11px',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#64748b'
                }}>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>doc: {shortId(docId ?? undefined)}</span>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>{workspaceOrVersion}: {shortId(workspaceOrVersionId ?? undefined)}</span>
                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>elem: {shortId(elementId ?? undefined)}</span>
                    {microversionId && (
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>mid: {shortId(microversionId)}</span>
                    )}
                </div>

                {/* Settings panel */}
                {showSettings && (
                    <div style={{
                        marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1',
                        display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'
                    }}>
                        <input
                            type="password"
                            placeholder="API Key (ACCESS_KEY:SECRET_KEY)"
                            value={apiToken}
                            onChange={(e) => handleSaveToken(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', flex: '1 1 240px', maxWidth: '100%' }}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Used as a fallback when the backend proxy is unreachable.</span>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: '10px 20px', color: '#991b1b', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: '13px', flexShrink: 0 }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', flexShrink: 0 }}>
                    Fetching live assembly components…
                </div>
            )}

            {/* Grid */}
            <div className="table-wrapper" ref={wrapperRef} style={{ flex: 1, overflow: 'auto', width: '100%' }}>
                <table className="custom-table" style={{ minWidth: '100%' }}>
                    <colgroup>
                        {visibleColumns.map((col, idx) => {
                            const isLast = idx === visibleColumns.length - 1;
                            const width = columnWidths[col.key] ?? (isLast && autoLastColWidth !== null ? autoLastColWidth : DEFAULT_COL_WIDTH);
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
                            const isPurchased = row.manufacturingMethod === 'Purchased externally';

                            return (
                                <tr key={row.id} className="table-tr" onContextMenu={(e) => handleRowContextMenu(e, row.id)}>
                                    {visibleColumns.map((col, colIndex) => {
                                        let isCellDisabled = false;
                                        let displayValue: string | number = row[col.key] as string | number;

                                        if (isSubassembly) {
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
                                            <td key={col.key} className={`table-td ${getDropIndicatorClass(colIndex)} ${isCellDisabled ? 'cell-disabled' : ''}`}>
                                                <div className="td-content-wrapper" style={colIndex === 0 ? { paddingLeft: `${row.level * 16}px` } : {}}>
                                                    {colIndex === 0 && isSubassembly && (
                                                        <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginRight: '4px' }}>
                                                            {row.isExpanded ? '▼' : '▶'}
                                                        </button>
                                                    )}

                                                    {col.type === 'select' ? (
                                                        <select
                                                            data-row={rowIndex}
                                                            data-col={colIndex}
                                                            value={displayValue}
                                                            onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                                                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
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
                                                        </select>
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
                                                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
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
                        {!loading && visibleData.length === 0 && (
                            <tr>
                                <td colSpan={visibleColumns.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                    No components found in this assembly.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Context menus */}
            {contextMenu.visible && (
                <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x, position: 'fixed', zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { if (contextMenu.columnIndex > 0) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex - 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === 0}>Move Left</button>
                    <button onClick={() => { if (contextMenu.columnIndex < columns.length - 1) moveColumn(contextMenu.columnIndex, contextMenu.columnIndex + 1); closeContextMenu(); }} disabled={contextMenu.columnIndex === columns.length - 1}>Move Right</button>
                </div>
            )}
            {rowContextMenu.visible && activeContextMenuRow && (
                <div className="context-menu" style={{ top: rowContextMenu.y, left: rowContextMenu.x, position: 'fixed', zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
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

export default OnshapePage;