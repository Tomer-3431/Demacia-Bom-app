import { useSearchParams } from "react-router-dom"

export const OnshapePage: React.FC = () => {
    const [searchParams] = useSearchParams();

    const documentId = searchParams.get('did');
    const elementId = searchParams.get('eid');

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
        <div>
            <h2>Onshape Page</h2>
        </div>
    )
}
