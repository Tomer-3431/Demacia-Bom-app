import { useState } from "react";
import { Table, type ColumnConfig, type RowData } from "../components/Table";

interface Row extends RowData {
    name: string;
    number: number;
    select: 'option 1' | 'option 2' | 'option 3';
    boolean: boolean;
}

export default function Home() {
    const [data, setData] = useState<Row[]>([
        {
            id: '0',
            parentId: null,
            name: "row 0",
            number: 0,
            isExpanded: true,
            select: 'option 2',
            boolean: false,
        },
        {
            id: '1',
            parentId: null,
            name: "row 1",
            number: 1,
            isExpanded: true,
            select: 'option 1',
            boolean: true,
        },
        {
            id: '2',
            parentId: null,
            name: "row 2",
            number: 2,
            isExpanded: true,
            select: 'option 2',
            boolean: true
        },
        {
            id: '3',
            parentId: null,
            name: "row 3",
            number: 4,
            isExpanded: true,
            select: 'option 3',
            boolean: false
        },
        {
            id: '4',
            parentId: null,
            name: "row 4",
            number: 8,
            isExpanded: true,
            select: 'option 3',
            boolean: false
        },
    ]);

    const columns: ColumnConfig[] = [
        {
            key: "name",
            label: "Name",
            type: "string"
        },
        {
            key: "number",
            label: "Number",
            type: "number"
        },
        {
            key: "select",
            label: "Select options",
            type: "select",
            options: [
                'option 1', 
                'option 2', 
                'option 3'
            ]
        },
        {
            key: "boolean",
            label: "Bolean",
            type: "boolean",
            isDisabled: (row) => {
                return row['name'] === "row 4";
            }
        }
    ];

    return (
        <div>
            <h2>Home Page</h2>
            <Table
                data={data}
                columnsData={columns}
                newRowFunction={(id, parentId) => {
                    return {
                        id: id,
                        parentId: parentId,
                        name: "New Item",
                        number: -1,
                        isExpanded: true,
                        select: 'option 1'
                    };
                }}
                setData={(newData) => setData(newData as Row[])}
            />
        </div>
    );
}
