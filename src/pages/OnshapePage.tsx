import { useState } from "react";
import { useSearchParams } from "react-router-dom"

export const OnshapePage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [bomData, setBomData] = useState<any>(undefined);

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

    const handleClick = () => {
        findABom();

        const messege = {
            documentId: documentId,
            workspaceId: wvmId,
            elementId: elementId,
            messageName: 'showMessageBubble',
            message: 'Hello World!'
        };
        parent.postMessage(messege, '*');
    }

    const findABom = async () => {
        if (!documentId || !wvmType || !wvmId || !elementId) return;

        setBomData(undefined);
        try {
            const response = await fetch(`http://localhost:5050/api/bom/getBomDataDB/${documentId}/${wvmType}/${wvmId}/${elementId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed');
            }

            setBomData(result.data)
        } catch (err) {
            console.error('Faiald', err);
        }
    }

    const fetchAndSaveBom = async () => {
        if (!documentId || !wvmId || !elementId) return;

        setBomData(undefined);
        try {
            const response = await fetch('http://localhost:5050/api/bom/uploadBom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId, wvmType, wvmId, elementId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to process BOM');
            }

            setBomData(result.data);
        } catch (err) {
            console.error("Failed to fetch or save BOM:", err);
        }
    };

    return (
        <div>
            <h2>Onshape Page</h2>
            <p>{documentId}</p>
            <p>{wvmType}</p>
            <p>{microversionId}</p>
            <p>{elementId}</p>
            <button
                className="gap-2 p-4 bg-gray-400"
                onClick={handleClick}
            >
                Click Me
            </button>

            <p>{btoa(import.meta.env.VITE_ONSHAPE_API_CREDENTIALS)}</p>

            {bomData && (
                <div>
                    <h3 className="text-green-600 font-bold mb-2">Successfully Stored in MongoDB!</h3>
                    <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
                        {JSON.stringify(bomData, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
}
