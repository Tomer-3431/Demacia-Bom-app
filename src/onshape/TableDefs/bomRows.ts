export interface RowData {
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

export interface RenderRow extends RowData {
    level: number;
}

export interface RawBomNode {
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

export const PART_STATUS_OPTIONS = [
    'Not Started', 'In Design', 'In Review', 'In Production',
    'Partially Completed', 'Completed', 'On Hold', 'Cancelled'
];

export const ASSEMBLY_STATUS_OPTIONS = [
    'Not Started', 'Parts being made', 'In construction', 'On Hold', 'Completed', 'Cancelled'
];

export const MFG_METHOD_OPTIONS = ['Manually made', 'Printed in 3D', 'CNC', 'Lathe', 'Externally made', 'Milled', 'Purchased externally'];
export const GROUP_OPTIONS = ['Unique part', 'Standard part'];