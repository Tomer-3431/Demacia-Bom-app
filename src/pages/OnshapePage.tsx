import type { FC } from "react";
import { useSearchParams } from "react-router-dom";
import '../css/Table.css';

export const OnshapePage: FC = () => {
    const [searchParams] = useSearchParams();

    const worksapceOrVersion = searchParams.get('wv');
    const workspaceOrVersionId = searchParams.get('wvid');
    const microversionId = searchParams.get('mid');

    let wvmType: 'w' | 'v' | 'm' = 'w';
    let wvmId: string | null;

    if (worksapceOrVersion === "w") {
        wvmType = 'w';
        wvmId = workspaceOrVersionId;
    } else if (worksapceOrVersion === "v") {
        wvmType = 'v';
        wvmId = workspaceOrVersionId;
    } else if (microversionId) {
        wvmType = 'm';
        wvmId = microversionId;
    }

    return (
        <>
            <div>
                <h2>Onshape Page</h2>
            </div>
            <div>
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>test col 1</th>
                            <th>test col 2</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>test subj 1</td>
                            <td>test subj 2</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
