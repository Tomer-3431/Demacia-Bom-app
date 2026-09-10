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

async function callOnshape(endpoint: string) {
    const url = endpoint.startsWith('http') ? endpoint : `${ONSHAPE_API_BASE}${endpoint}`;
    console.log(`[Onshape API Request] Fetching: ${url}`);
    const res = await fetch(url, {
        headers: {
            Authorization: getOnshapeAuthHeader(),
            Accept: 'application/json, application/vnd.onshape.v2+json',
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Onshape API Error] ${res.status} for ${url}: ${text}`);
        throw new Error(`Onshape API error ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
}

/**
 * Recursively builds the assembly BOM tree and accurately calculates part and subassembly quantities
 * by counting unique instance occurrences within the assembly hierarchy.
 */
async function buildRecursiveAssemblyBom(
    did: string,
    wvm: string,
    wvmid: string,
    eid: string,
    depth = 0
): Promise<any[]> {
    if (depth > 15) return [];

    try {
        const assemblyDef = await callOnshape(`/assemblies/d/${did}/${wvm}/${wvmid}/e/${eid}`);
        const root = assemblyDef?.rootAssembly;
        if (!root) return [];

        let partMetas: any[] = [];
        try {
            const metaRes = await callOnshape(`/parts/d/${did}/${wvm}/${wvmid}/e/${eid}`);
            partMetas = Array.isArray(metaRes) ? metaRes : [metaRes];
        } catch {}

        const instances = root.instances || [];
        const subassembliesList = root.subassemblies || [];

        // Count instance frequencies to determine accurate quantities
        const instanceCountMap = new Map<string, number>();
        instances.forEach((inst: any) => {
            const key = inst.partId || inst.elementId || inst.id;
            if (key) {
                instanceCountMap.set(key, (instanceCountMap.get(key) || 0) + 1);
            }
        });

        const items: any[] = [];
        const processedKeys = new Set<string>();

        const subMap = new Map();
        subassembliesList.forEach((sub: any) => {
            subMap.set(sub.id, sub);
            subMap.set(sub.elementId, sub);
        });

        for (const inst of instances) {
            const uniqueKey = inst.partId || inst.elementId || inst.id;
            if (processedKeys.has(uniqueKey)) continue;
            processedKeys.add(uniqueKey);

            const calculatedQuantity = instanceCountMap.get(uniqueKey) || 1;

            if (inst.type === 'Part') {
                const metadata = partMetas.find((p: any) => p.partId === inst.partId) || partMetas[0] || {};
                const customProps = metadata.customProperties || metadata.properties || [];
                const getProp = (name: string) => customProps.find((cp: any) => cp.name.toLowerCase() === name.toLowerCase())?.value || '';

                items.push({
                    id: inst.id,
                    type: 'part',
                    name: inst.name || metadata.name || 'Part',
                    partNumber: metadata.partNumber || getProp('Part Number') || inst.partId || '',
                    description: metadata.description || getProp('Description') || '',
                    revision: metadata.revision || 1,
                    quantity: calculatedQuantity,
                    material: metadata.material?.displayName || getProp('Material') || '',
                    mass: metadata.mass || 0,
                    manufacturingStatus: 'Not Started',
                    comments: getProp('Comments') || '',
                    children: []
                });
            } else if (inst.type === 'Assembly' || subMap.has(inst.id) || subMap.has(inst.elementId)) {
                const subRef = subMap.get(inst.id) || subMap.get(inst.elementId) || inst;
                const subDid = subRef.documentId || did;
                const subEid = subRef.elementId || inst.elementId;
                const subWvm = subRef.documentType === 'version' ? 'v' : subRef.documentType === 'microversion' ? 'm' : 'w';
                const subWvmid = subRef.documentVersion || subRef.documentMicroversion || wvmid;

                let childrenItems: any[] = [];
                try {
                    childrenItems = await buildRecursiveAssemblyBom(subDid, subWvm, subWvmid, subEid, depth + 1);
                } catch (err) {
                    console.warn(`[Assembly Tree] Failed to resolve subassembly children for ${inst.id}:`, err);
                }

                items.push({
                    id: inst.id,
                    type: 'subassembly',
                    name: inst.name || subRef.name || 'Subassembly',
                    partNumber: subRef.partId || '',
                    revision: 1,
                    quantity: calculatedQuantity,
                    manufacturingStatus: 'Not Started',
                    comments: '',
                    children: childrenItems
                });
            }
        }

        // Include any remaining subassemblies from subassembliesList not caught in instances
        for (const sub of subassembliesList) {
            const subKey = sub.elementId || sub.id;
            if (processedKeys.has(subKey)) continue;
            processedKeys.add(subKey);

            const subDid = sub.documentId || did;
            const subEid = sub.elementId;
            const subWvm = sub.documentType === 'version' ? 'v' : sub.documentType === 'microversion' ? 'm' : 'w';
            const subWvmid = sub.documentVersion || sub.documentMicroversion || wvmid;

            let childrenItems: any[] = [];
            try {
                childrenItems = await buildRecursiveAssemblyBom(subDid, subWvm, subWvmid, subEid, depth + 1);
            } catch (err) {
                console.warn(`[Assembly Tree] Failed to resolve subassembly children for ${sub.id}:`, err);
            }

            items.push({
                id: sub.id || subEid,
                type: 'subassembly',
                name: sub.name || 'Subassembly',
                partNumber: sub.partId || '',
                revision: 1,
                quantity: instanceCountMap.get(subKey) || 1,
                manufacturingStatus: 'Not Started',
                comments: '',
                children: childrenItems
            });
        }

        return items;
    } catch (err) {
        console.error(`[Assembly Tree Error] Failed at d/${did}/e/${eid}:`, err);
        return [];
    }
}

app.get('/api/onshape/bom/d/:did/wvmT/:wvmType/wvmI/:wvmid/e/:eid', async (req: Request, res: Response) => {
    const did = String(req.params.did || '');
    const wvmType = String(req.params.wvmType || '');
    const wvmid = String(req.params.wvmid || '');
    const eid = String(req.params.eid || '');

    try {
        console.log(`[Server BOM] Building recursive assembly BOM with accurate instance counts for Doc: ${did}, Element: ${eid}`);

        // Try Onshape's native indented BOM endpoint first
        try {
            const nativeRes = await callOnshape(`/assemblies/d/${did}/${wvmType}/${wvmid}/e/${eid}/bom?indented=true`);
            if (nativeRes) {
                const rawItems = nativeRes.items || nativeRes.bomTable?.items || (Array.isArray(nativeRes) ? nativeRes : []);
                if (rawItems.length > 0) {
                    console.log(`[Server BOM] Successfully retrieved native indented BOM with ${rawItems.length} root entries.`);
                    return res.json(nativeRes);
                }
            }
        } catch (nativeErr) {
            console.warn("[Server BOM] Native indented BOM query failed. Using recursive instance-counting builder.", nativeErr);
        }

        const items = await buildRecursiveAssemblyBom(did, wvmType, wvmid, eid);
        return res.json({
            bomTable: {
                items
            }
        });
    } catch (error: any) {
        console.error("[Server BOM Error]:", error);
        res.status(500).json({ error: error.message || 'Internal server error while building assembly BOM' });
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