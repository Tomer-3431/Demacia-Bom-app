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
        console.log(`[BOM Flatten] -> Mapping node raw ID [${node.id}] to internal ID [${id}], type: ${node.type}`);
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
            console.log(`[BOM Flatten] Found ${node.children.length} children for node internal ID [${id}]`);
            result.push(...flattenBomTree(node.children, id, counterRef));
        }
    }
    return result;
};

export const OnshapePage: FC = () => {
    console.log("[Render] OnshapePage component rendering/re-rendering");
    const [searchParams] = useSearchParams();

    const context = useOnshapeContext();
    const client = useOnshapeClient({ context });

    useOnshapeKeepAlive(client);

    useOnshapeMessage(client, (message) => {
        if (isSaveChangesMessage(message)) {
            console.log("[Onshape] Save changes requested by host.");
            client.finishedSaving(message.messageId);
        }
    });

    const docId = context.documentId || searchParams.get('documentId') || searchParams.get('did') || searchParams.get('d');
    const wvmType = context.workspaceId ? 'w' : context.versionId ? 'v' : (searchParams.get('wv') || searchParams.get('wvmT') || 'w');
    const wvmId = context.workspaceId || context.versionId || searchParams.get('wvid') || searchParams.get('wvId');
    const workspaceOrVersion = wvmType;
    const workspaceOrVersionId = wvmId;
    const microversionId = context.microversionId || searchParams.get('mid') || '';
    const elementId = context.elementId || searchParams.get('elementId') || searchParams.get('eid') || searchParams.get('e');

    const [data, setData] = useState<RowData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

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
        { key: 'price', label: 'Price ($)', type: 'number' },
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

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [autoLastColWidth, setAutoLastColWidth] = useState<number | null>(null);

    const hasFetchedRef = useRef(false);

    const fetchParts = useCallback(async (signal?: AbortSignal) => {
        console.log("[API] fetchParts initiated", { docId, wvmType, wvmId, elementId });
        setLoading(true);
        setError(null);

        try {
            let res: Response | null = null;

            // Attempt 1: Fetch through backend proxy server on port 5050
            try {
                let targetUrl = `${API_BASE}/api/db/bom/all`;
                if (docId && wvmType && wvmId && elementId) {
                    targetUrl = `${API_BASE}/api/onshape/bom/d/${docId}/wvmT/${wvmType}/wvmI/${wvmId}/e/${elementId}`;
                }
                console.log(`[API Proxy] Querying backend route: ${targetUrl}`);
                res = await fetch(targetUrl, { signal });
            } catch (proxyErr) {
                console.warn("[API Proxy] Backend server unreachable. Retrying via direct Onshape REST API.");
            }

            // Attempt 2: Direct Onshape REST API Call via CORS proxy wrapper
            if ((!res || !res.ok) && docId && wvmType && wvmId && elementId) {
                const targetOnshapeApi = `https://cad.onshape.com/api/v2/assemblies/d/${docId}/${wvmType}/${wvmId}/e/${elementId}/bom?indented=true`;
                const directOnshapeUrl = `https://corsproxy.io/?${encodeURIComponent(targetOnshapeApi)}`;

                console.log(`[Onshape Direct REST] Fetching assembly components via CORS proxy: ${directOnshapeUrl}`);

                const headers: Record<string, string> = {
                    'Accept': 'application/vnd.onshape.v2+json'
                };

                const storedToken = localStorage.getItem('ONSHAPE_API_TOKEN');
                if (storedToken) {
                    let authToken = storedToken.trim();
                    if (authToken.includes(':') && !authToken.startsWith('Basic ')) {
                        authToken = `Basic ${btoa(authToken)}`;
                    } else if (!authToken.startsWith('Basic ') && !authToken.startsWith('Bearer ')) {
                        authToken = `Bearer ${authToken}`;
                    }
                    headers['Authorization'] = authToken;
                }

                res = await fetch(directOnshapeUrl, {
                    signal,
                    headers
                });
            }

            if (!res || !res.ok) {
                throw new Error(`Server or Onshape API returned status ${res?.status || 'Error'}. Verify active document permissions or API token.`);
            }

            const json = await res.json();
            const rawNodes = parseOnshapeBomResponse(json);

            const counterRef = { current: 1 };
            const flattened = flattenBomTree(rawNodes, null, counterRef);
            setData(flattened);
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error("[API Error] Failed to fetch parts:", err.message);
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [docId, wvmType, wvmId, elementId]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        const controller = new AbortController();
        fetchParts(controller.signal);
        return () => controller.abort();
    }, [fetchParts]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                console.log("[Keyboard] Escape key pressed. Closing all context menus.");
                closeContextMenu();
            }
        };
        const handleScroll = () => {
            console.log("[Scroll] Window scroll detected. Closing context menus.");
            closeContextMenu();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    const hasPurchasedParts = data.some(row => row.manufacturingMethod === 'Purchased externally');
    console.log(`[Columns] hasPurchasedParts evaluated to: ${hasPurchasedParts}`);
    const visibleColumns = columns.filter(col => col.key !== 'producer' || hasPurchasedParts);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) {
            console.log("[ResizeObserver] wrapperRef is currently null.");
            return;
        }

        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (!lastCol) {
            console.log("[ResizeObserver] No visible columns available for auto-width calculation.");
            setAutoLastColWidth(null);
            return;
        }

        const recompute = () => {
            if (Object.prototype.hasOwnProperty.call(columnWidths, lastCol.key)) {
                console.log(`[ResizeObserver] Last column [${lastCol.key}] has a custom user width set. Skipping auto calculation.`);
                setAutoLastColWidth(null);
                return;
            }

            const othersWidth = visibleColumns
                .slice(0, -1)
                .reduce((sum, c) => sum + (columnWidths[c.key] || DEFAULT_COL_WIDTH), 0);

            const available = wrapper.clientWidth - othersWidth;
            const computedWidth = Math.max(MIN_LAST_COL_WIDTH, available);
            console.log(`[ResizeObserver] Recomputed last column width: ${computedWidth}px (Wrapper width: ${wrapper.clientWidth}px, Others: ${othersWidth}px)`);
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
    console.log(`[Render Tree] Render tree generated. Total visible rows: ${visibleData.length} out of ${data.length} total rows.`);

    const activeContextMenuRow = data.find(r => r.id === rowContextMenu.rowId);

    const focusNextAvailableCell = (rIdx: number, cIdx: number, dRow: number, dCol: number) => {
        console.log(`[Navigation] Attempting to move focus from row ${rIdx}, col ${cIdx} by offset [row: ${dRow}, col: ${dCol}]`);
        let targetRow = rIdx;
        let targetCol = cIdx;

        while (true) {
            targetRow += dRow;
            targetCol += dCol;

            if (targetRow < 0 || targetRow >= visibleData.length) {
                console.log(`[Navigation] Target row ${targetRow} is out of bounds (max: ${visibleData.length - 1}). Stopping search.`);
                break;
            }
            if (targetCol < 0 || targetCol >= visibleColumns.length) {
                console.log(`[Navigation] Target column ${targetCol} is out of bounds (max: ${visibleColumns.length - 1}). Stopping search.`);
                break;
            }

            const cellElement = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`) as HTMLInputElement | HTMLSelectElement;
            if (cellElement && !cellElement.disabled) {
                console.log(`[Navigation] Found active target cell at row ${targetRow}, col ${targetCol}. Focusing.`);
                cellElement.focus();
                if (cellElement instanceof HTMLInputElement) {
                    if (dCol === 1) cellElement.setSelectionRange(0, 0);
                    else if (dCol === -1) cellElement.setSelectionRange(cellElement.value.length, cellElement.value.length);
                    else cellElement.select();
                }
                break;
            } else {
                console.log(`[Navigation] Cell at row ${targetRow}, col ${targetCol} is disabled or missing. Continuing search vector.`);
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
            console.log(`[Keydown] Vertical arrow pressed (${e.key}) at row ${rowIndex}, col ${colIndex}`);
            const dRow = isUp ? -1 : 1;
            focusNextAvailableCell(rowIndex, colIndex, dRow, 0);
        } else if (isLeft) {
            if (isCtrl || (isInput && input.selectionStart === 0 && input.selectionEnd === 0)) {
                e.preventDefault();
                console.log(`[Keydown] Left arrow navigation triggered at row ${rowIndex}, col ${colIndex} (Ctrl: ${isCtrl})`);
                focusNextAvailableCell(rowIndex, colIndex, 0, -1);
            }
        } else if (isRight) {
            if (isCtrl || (isInput && input.selectionStart === input.value.length && input.selectionEnd === input.value.length)) {
                e.preventDefault();
                console.log(`[Keydown] Right arrow navigation triggered at row ${rowIndex}, col ${colIndex} (Ctrl: ${isCtrl})`);
                focusNextAvailableCell(rowIndex, colIndex, 0, 1);
            }
        } else if (e.key === 'Enter') {
            console.log(`[Keydown] Enter key pressed at row ${rowIndex}, col ${colIndex}. Blurring element.`);
            target.blur();
        }
    };

    const handleResizeStart = (e: React.PointerEvent, key: string) => {
        console.log(`[Resize] Pointer down on resize handle for column: [${key}]`);
        e.stopPropagation();
        e.preventDefault();

        const th = (e.target as HTMLElement).closest('th');
        if (!th) {
            console.warn("[Resize Warning] Could not locate parent <th> element for resize handle.");
            return;
        }

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
        console.log(`[Resize] Pointer capture successfully acquired for pointer ID ${e.pointerId}`);

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
            console.log(`[Resize] Pointer up received. Final width for [${key}]: ${currentWidth}px`);
            isActive = false;
            if (rafId !== null) cancelAnimationFrame(rafId);
            targetElement.releasePointerCapture(upEvent.pointerId);
            targetElement.removeEventListener('pointermove', onPointerMove);
            targetElement.removeEventListener('pointerup', onPointerUp);

            setColumnWidths(prev => {
                const updated = { ...prev, [key]: currentWidth };
                console.log("[Resize] Updated columnWidths state map:", updated);
                return updated;
            });
        };

        targetElement.addEventListener('pointermove', onPointerMove);
        targetElement.addEventListener('pointerup', onPointerUp);
        rafId = requestAnimationFrame(tick);
    };

    const handleResizeDoubleClick = (e: React.MouseEvent, key: string, label: string) => {
        console.log(`[Resize DoubleClick] Auto-fitting column [${key}] ("${label}")`);
        e.stopPropagation();
        let maxChars = label.length;
        visibleData.forEach(row => {
            const val = row[key as keyof RowData];
            const str = val !== null && val !== undefined ? String(val) : '';
            const indentChars = (visibleColumns[0].key === key ? row.level * 3 : 0);
            maxChars = Math.max(maxChars, str.length + indentChars);
        });

        const tightFitWidth = Math.ceil((maxChars * 7.5) + 32);
        console.log(`[Resize DoubleClick] Calculated tight fit width for [${key}]: ${tightFitWidth}px`);
        setColumnWidths(prev => ({ ...prev, [key]: Math.max(70, tightFitWidth) }));
    };

    const handleAddRow = (type: 'part' | 'subassembly', parentId: number | null = null) => {
        console.log(`[Add Row] Triggered to add new [${type}] with parentId: ${parentId}`);
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
                console.log(`[Add Row] Expanding parent row ID [${parentId}] to show newly added child.`);
                newData = newData.map(row => row.id === parentId ? { ...row, isExpanded: true } : row);
            }
            console.log("[Add Row] New data state length after insertion:", newData.length);
            return newData;
        });
        closeContextMenu();
    };

    const toggleExpand = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setData(prev => {
            const target = prev.find(r => r.id === id);
            const newState = target ? !target.isExpanded : true;
            console.log(`[Toggle Expand] Toggling row ID [${id}]. New isExpanded state: ${newState}`);
            return prev.map(row => row.id === id ? { ...row, isExpanded: newState } : row);
        });
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (!isHandleDragging) {
            console.log("[Column Drag] Drag attempted without handle grip active. Preventing drag.");
            e.preventDefault();
            return;
        }
        console.log(`[Column Drag] Drag started on column index: ${index} (${visibleColumns[index]?.key})`);
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
            console.log(`[Column Drag Over] Dragging over column index: ${index}`);
            setDropTargetIdx(index);
        }
    };

    const handleDrop = (targetIdx: number) => {
        console.log(`[Column Drop] Dropped column draggedIdx: ${draggedIdx} onto targetIdx: ${targetIdx}`);
        if (draggedIdx === null || draggedIdx === targetIdx) {
            console.log("[Column Drop] Invalid or identical drop position. Resetting drag state.");
            resetDragState();
            return;
        }
        const originalFromIdx = columns.findIndex(c => c.key === visibleColumns[draggedIdx].key);
        const originalToIdx = columns.findIndex(c => c.key === visibleColumns[targetIdx].key);
        console.log(`[Column Drop] Mapping visible indices to original columns array indices [from: ${originalFromIdx} -> to: ${originalToIdx}]`);
        moveColumn(originalFromIdx, originalToIdx);
        resetDragState();
    };

    const resetDragState = () => {
        console.log("[Column Drag] Resetting column drag and drop states.");
        setDraggedIdx(null);
        setDropTargetIdx(null);
        setIsHandleDragging(false);
    };

    const getDropIndicatorClass = (index: number) => (draggedIdx !== null && dropTargetIdx !== null && index === dropTargetIdx && draggedIdx !== dropTargetIdx) ? 'drop-indicator-both' : '';

    const handleCellChange = (rowId: number, col: ColumnConfig, rawValue: string) => {
        console.log(`[Cell Change] Row ID [${rowId}], Column [${col.key}] raw value updated to:`, rawValue);
        setData(prev => prev.map(row => {
            if (row.id !== rowId) return row;
            const updatedRow = { ...row };
            
            if (col.type === 'number') {
                (updatedRow as any)[col.key] = rawValue;
            } else {
                (updatedRow as any)[col.key] = rawValue;
            }

            if (col.key === 'manufacturingMethod') {
                console.log(`[Cell Change Logic] manufacturingMethod changed to [${rawValue}] for row [${rowId}]`);
                if (rawValue === 'Purchased externally') {
                    updatedRow.group = 'Purchased part';
                    console.log(`[Cell Change Logic] Auto-updating group to 'Purchased part'`);
                } else if (row.manufacturingMethod === 'Purchased externally' && rawValue !== 'Purchased externally') {
                    updatedRow.group = 'Unique part';
                    updatedRow.producer = '';
                    console.log(`[Cell Change Logic] Resetting group to 'Unique part' and clearing producer.`);
                }
            }
            return updatedRow;
        }));
    };

    const handleNumberBlur = (rowId: number, col: ColumnConfig, rawValue: string | number) => {
        const strVal = String(rawValue).trim();
        console.log(`[Number Blur] Row ID [${rowId}], Column [${col.key}] raw blur value: "${strVal}"`);
        if (strVal === '' || strVal === '.') {
            console.log(`[Number Blur] Value is empty or single dot. Defaulting to '0'`);
            handleCellChange(rowId, col, '0');
            return;
        }

        let processed = strVal;
        if (col.key === 'quantity' || col.key === 'revision') {
            const intVal = parseInt(processed, 10);
            const finalVal = isNaN(intVal) ? 0 : Math.max(0, intVal);
            console.log(`[Number Blur Integer] Parsed integer value: ${finalVal}`);
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
        console.log(`[Number Blur Decimal] Parsed decimal float value: ${finalVal}`);
        handleCellChange(rowId, col, String(finalVal));
    };

    const moveColumn = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= columns.length) {
            console.warn(`[Move Column] Invalid destination index ${toIdx}. Aborting move.`);
            return;
        }
        console.log(`[Move Column] Moving column from index ${fromIdx} to ${toIdx}`);
        const updatedColumns = [...columns];
        const [movedItem] = updatedColumns.splice(fromIdx, 1);
        updatedColumns.splice(toIdx, 0, movedItem);
        setColumns(updatedColumns);
    };

    const handleContextMenu = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        const originalIndex = columns.findIndex(c => c.key === key);
        console.log(`[Header Context Menu] Right-clicked header [${key}] at coordinates [x: ${e.clientX}, y: ${e.clientY}]`);
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, columnIndex: originalIndex });
    };

    const closeContextMenu = () => {
        if (contextMenu.visible || rowContextMenu.visible) {
            console.log("[Context Menu] Closing all active context menus.");
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
        setRowContextMenu(prev => ({ ...prev, visible: false }));
    };

    const handleRowContextMenu = (e: React.MouseEvent, rowId: number) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[Row Context Menu] Right-clicked row ID [${rowId}] at coordinates [x: ${e.clientX}, y: ${e.clientY}]`);
        setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowId });
    };

    const handleDeleteRowClick = () => {
        if (rowContextMenu.rowId !== null) {
            console.log(`[Delete Row] Deleting row ID [${rowContextMenu.rowId}] and all its recursive children.`);
            const idsToDelete = new Set<number>();
            const queue = [rowContextMenu.rowId];
            while(queue.length > 0) {
                const currentId = queue.shift()!;
                idsToDelete.add(currentId);
                data.forEach(row => { if (row.parentId === currentId) queue.push(row.id); });
            }
            console.log(`[Delete Row] Total rows marked for deletion (including sub-tree): ${idsToDelete.size}`, Array.from(idsToDelete));
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
            {error && (
                <div style={{ padding: 12, color: '#b91c1c' }}>
                    Failed to load parts: {error}
                </div>
            )}

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
                                                <div className="td-content-wrapper" style={colIndex === 0 ? { paddingLeft: `${row.level * 24}px` } : {}}>
                                                    {colIndex === 0 && isSubassembly && (
                                                        <button className="expand-toggle" onClick={(e) => toggleExpand(row.id, e)}>{row.isExpanded ? '▼' : '▶'}</button>
                                                    )}
                                                    {colIndex === 0 && !isSubassembly && <span className="expand-placeholder"></span>}

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
                                                            {col.key === 'group' && (isSubassembly || isPurchased) && (
                                                                <option value={displayValue}>{displayValue}</option>
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
                        {!loading && visibleData.length === 0 && (
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