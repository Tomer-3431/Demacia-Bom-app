import dotenv from 'dotenv';
import dns from 'node:dns';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { connect } from './db/connection';

dotenv.config();
dns.setDefaultResultOrder("ipv4first");

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const ONSHAPE_API_BASE = 'https://cad.onshape.com/api/v9';

function getOnshapeAuthHeader(): string {
    const access = process.env.REACT_APP_ONSHAPE_ACCESS_KEY || process.env.ONSHAPE_ACCESS_KEY || '';
    const secret = process.env.REACT_APP_ONSHAPE_SECRET_KEY || process.env.ONSHAPE_SECRET_KEY || '';
    return 'Basic ' + Buffer.from(`${access}:${secret}`).toString('base64');
}

async function fetchFromOnshape(endpoint: string) {
    const url = endpoint.startsWith('http') ? endpoint : `${ONSHAPE_API_BASE}${endpoint}`;
    const res = await fetch(url, {
        headers: {
            Authorization: getOnshapeAuthHeader(),
            Accept: 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Onshape API error ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
}

/**
 * Recursive function to fetch an assembly definition and all nested subassemblies,
 * flattening/structuring them into a complete multi-level BOM item list.
 */
async function resolveRecursiveBomItems(
    did: string,
    wvm: string,
    wvmid: string,
    eid: string,
    depth = 0
): Promise<any[]> {
    if (depth > 15) return [];

    try {
        // Fetch assembly definition for the current level
        const assemblyDef = await fetchFromOnshape(`/assemblies/d/${did}/${wvm}/${wvmid}/e/${eid}`);
        const root = assemblyDef?.rootAssembly;
        if (!root) return [];

        let items: any[] = [];

        // 1. Process regular parts in this assembly
        const instances = root.instances || [];
        for (const inst of instances) {
            if (inst.type === 'Part') {
                let metadata: any = {};
                try {
                    const metaList = await fetchFromOnshape(`/parts/d/${did}/${wvm}/${wvmid}/e/${eid}`);
                    const list = Array.isArray(metaList) ? metaList : [metaList];
                    metadata = list.find((p: any) => p.partId === inst.partId) || list[0] || {};
                } catch {}

                items.push({
                    id: inst.id,
                    type: 'part',
                    name: inst.name || metadata.name || 'Part',
                    partId: metadata.partNumber || metadata.partId || inst.partId || '',
                    revision: metadata.revision || 1,
                    quantity: 1,
                    material: metadata.material?.displayName || '',
                    mass: metadata.mass || 0,
                    manufacturingStatus: 'Not Started',
                    comments: metadata.description || '',
                    itemSource: { documentId: did, elementId: inst.elementId, wvmId: wvmid, wvmType: wvm, partId: inst.partId }
                });
            }
        }

        // 2. Process subassemblies recursively
        const subassemblies = root.subassemblies || [];
        for (const sub of subassemblies) {
            const subWvm = sub.documentType === 'version' ? 'v' : sub.documentType === 'microversion' ? 'm' : 'w';
            const subWvmid = sub.documentVersion || sub.documentMicroversion || wvmid;

            // Recursively resolve children inside this subassembly
            let childrenItems: any[] = [];
            try {
                childrenItems = await resolveRecursiveBomItems(sub.documentId, subWvm, subWvmid, sub.elementId, depth + 1);
            } catch (err) {
                console.warn(`Failed to resolve subassembly children for ${sub.id}:`, err);
            }

            items.push({
                id: sub.id,
                type: 'subassembly',
                name: sub.name || 'Subassembly',
                partId: sub.partId || '',
                revision: 1,
                quantity: 1,
                manufacturingStatus: 'Not Started',
                comments: '',
                children: childrenItems,
                itemSource: { documentId: sub.documentId, elementId: sub.elementId, wvmId: subWvmid, wvmType: subWvm }
            });
        }

        return items;
    } catch (err) {
        console.error(`Error resolving BOM tree at d/${did}/e/${eid}:`, err);
        return [];
    }
}

// Recursive BOM Endpoint requested by frontend
// Recursive BOM Endpoint requested by frontend
app.get('/api/onshape/bom/d/:did/wvmT/:wvmType/wvmI/:wvmid/e/:eid', async (req: Request, res: Response) => {
    const did = String(req.params.did || '');
    const wvmType = String(req.params.wvmType || '');
    const wvmid = String(req.params.wvmid || '');
    const eid = String(req.params.eid || '');

    try {
        console.log(`[Server BOM] Fetching recursive BOM for Doc: ${did}, Element: ${eid}`);
        const items = await resolveRecursiveBomItems(did, wvmType, wvmid, eid);
        res.json({
            bomTable: {
                items
            }
        });
    } catch (error: any) {
        console.error("[Server BOM Error]:", error);
        res.status(500).json({ error: error.message || 'Internal server error during recursive BOM resolution' });
    }
});

async function startServer(): Promise<void> {
    try {
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });
        await connect();
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

startServer();