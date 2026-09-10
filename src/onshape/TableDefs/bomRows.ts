export interface RowData {
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

export interface RenderRow extends RowData {
    level: number;
}

export const INITIAL_DATA: RowData[] = [
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