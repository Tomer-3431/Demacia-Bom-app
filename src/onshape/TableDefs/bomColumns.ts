import type { RowData } from "./bomRows";

type ColumnKey = keyof Omit<RowData, 'id' | 'type' | 'parentId' | 'isExpanded'>;

export interface ColumnConfig {
    key: ColumnKey;
    label: string;
    type: 'string' | 'number' | 'select';
    options?: string[];
}

export const INITIAL_COLUMNS: ColumnConfig[] = [
    { key: 'name', label: 'Name', type: 'string' },
    { key: 'catalogNumber', label: 'Catalog Number', type: 'string' },
    { key: 'description', label: 'Description', type: 'string' },
    { key: 'engineer', label: 'Engineer', type: 'string' },
    { key: 'comments', label: 'Comments', type: 'string' },
    { key: 'onshapeURL', label: 'Onshape URL', type: 'string' },
];