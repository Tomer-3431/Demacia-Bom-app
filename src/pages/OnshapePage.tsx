import type { FC } from "react";
import { useSearchParams } from "react-router-dom";

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
                <table>
                    <tbody>
                        <tr>
                            <th>test title 1</th>
                            <th>test title 2</th>
                            <th>test title 3</th>
                        </tr>
                        <tr>
                            <td>test name 1</td>
                            <td>test subject 1</td>
                            <td>test subject 2</td>
                        </tr>
                        <tr>
                            <td>test name 2</td>
                            <td>test subject 3</td>
                            <td>test subject 4</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
}
