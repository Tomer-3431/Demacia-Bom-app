import { useState } from "react";
import Table, { type RowData } from "../components/Table";

const BomPage: React.FC = () => {
    const [rows, setRows] = useState<RowData[]>([]);

    return (
        <div className="p-8">
            <h2>BOM Table</h2>
            <Table
                data={rows}
                columnsData={[]}
                newRowFunction={undefined}
                setData={(data) => setRows(data)}
            />
        </div>
    );
}

export default BomPage;
