import { type RowData, PART_STATUS_OPTIONS, MFG_METHOD_OPTIONS, GROUP_OPTIONS } from './bomRows';

export type ColumnKey = keyof Omit<RowData, 'id' | 'type' | 'parentId' | 'isExpanded'>;

export interface ColumnConfig {
    key: ColumnKey;
    label: string;
    type: 'string' | 'number' | 'select';
    options?: string[];
}

export const INITIAL_COLUMNS: ColumnConfig[] = [
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
];