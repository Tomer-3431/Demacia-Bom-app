import { useCallback, useEffect, useMemo, useState } from "react";
import Table from "../components/Table";
import { fetchFromApi, type ApiError } from "../util/ApiService";
import type { BomModel, PartModel } from "../util/Models";
import { useOnshapeClient, useOnshapeContext } from "../util/OnshapeExtension";
import "../css/AssemblyBomPage.css";
import {
  getBomByOnshapeKey,
  getOnshapeBom,
  getPartByOnshapeKey,
  updateOnshapePartMetadata,
  upsertBomById,
  upsertPartById,
  type OnshapeKey,
  updateOnshapeBomMetadata,
  syncPartFilesToDrive,
  syncBomThumbnailToDrive
} from "./BomApi";
import type AssemblyBomRow from "./AssemblyBomRow";
import { parseOnshapeBomTable, type OnshapeBomTable, type ParsedOnshapeBomRow } from "./OnshapeBom";
import buildAssemblyBomColumns from "./AssemblyBomColumns";
import PublishBomModal, { type PublishBomFormValues } from "./PublishBomModel";

/** Onshape sends "w" or "v" for the workspaceOrVersion flag; our db/onshape
 *  routes want the same single-letter wvmType. */
function resolveWvm(context: ReturnType<typeof useOnshapeContext>): { wvmType: string; wvmID: string } | null {
  if (context.workspaceId) return { wvmType: "w", wvmID: context.workspaceId };
  if (context.versionId) return { wvmType: "v", wvmID: context.versionId };
  return null;
}

function buildOnshapeElementURL(server: string | null, key: OnshapeKey): string {
  const base = server || "https://cad.onshape.com";
  return `${base}/documents/${key.documentID}/${key.wvmType}/${key.wvmID}/e/${key.elementID}`;
}

/** One resolved node in the tree, ready to become a table row (and, for
 *  assemblies, to recurse into). */
interface ResolvedNode {
  row: AssemblyBomRow;
  /** Present only for assembly nodes that still need their children resolved. */
  key?: OnshapeKey;
  bomID?: string;
  /** The already-parsed Onshape BOM for this node, fetched while resolving
   *  it, kept around so we don't have to re-fetch it during publish. */
  onshapeBom?: OnshapeBomTable;
}

export default function AssemblyBomPage() {
  const context = useOnshapeContext();
  const client = useOnshapeClient({ context });

  const [rows, setRows] = useState<AssemblyBomRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [rootBomDB, setRootBomDB] = useState<BomModel | null>(null);
  const [rootIsPublished, setRootIsPublished] = useState<boolean>(false);
  const [rootOnshapeBom, setRootOnshapeBom] = useState<OnshapeBomTable | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const wvm = resolveWvm(context);
  const rootKey: OnshapeKey | null =
    context.documentId && wvm && context.elementId
      ? { documentID: context.documentId, wvmType: wvm.wvmType, wvmID: wvm.wvmID, elementID: context.elementId }
      : null;

  /**
   * Resolves one BOM node (root or sub-assembly): fetches its live Onshape
   * BOM (needed regardless, both for the bomID and as a fallback data
   * source), then checks whether that bomID already exists in the database.
   * DB data wins when present; Onshape data fills the gaps otherwise.
   */
  const resolveBomNode = useCallback(
    async (key: OnshapeKey, parentRowId: string | null, rootBom: BomModel | null | 'root'): Promise<{ node: ResolvedNode; dbBom: BomModel | null }> => {
      const onshapeBom = await getOnshapeBom(key);
      const bomID = onshapeBom.id || key.elementID;

      let dbBom: BomModel | null = null;
      try {
        dbBom = await getBomByOnshapeKey(key, bomID);
      } catch {
        dbBom = null;
      }
      const rowId = `${key.documentID}_${key.wvmType}_${key.wvmID}_${key.elementID}_${bomID}`;

      // const isPublished = (Boolean(dbBom) && rootIsPublished && rootBomDB && (
      //   parentRowId
      //     ? await (async () => {
      //       const bom = await fetchFromApi<BomModel>(`/db/bom/id/${parentRowId}`);
      //       return bom.subAssemblies.find((c) => c.bomID === rowId);
      //     })() :
      //     Boolean(rootBomDB.subAssemblies.find((c) => c.bomID === rowId))
      // )) || key === rootKey;
      const isPublished = Boolean(dbBom);
      const isExist = isPublished && rootBom !== 'root' && rootBom !== null && (
        parentRowId
          ? await (async () => {
            const bom = await fetchFromApi<BomModel>(`/db/bom/id/${parentRowId}`);
            return bom.subAssemblies.find((c) => c.bomID === rowId);
          })() :
          Boolean(rootBom.subAssemblies.find((c) => c.bomID === rowId))
      );
      const onshapeUrl = buildOnshapeElementURL(context.server, key);

      const row: AssemblyBomRow = {
        id: rowId,
        parentId: parentRowId,
        isExpanded: true,
        source: isPublished ? "db" : "onshape-only",
        isAssembly: true,
        avatar: dbBom?.avatarID ? `/drive/file/id/${dbBom.avatarID}` : "",
        name: dbBom?.name || onshapeBom.name.slice(6) || key.elementID,
        catalogNumber: dbBom?.catalogNumber || "",
        revision: "-",
        description: dbBom?.description || onshapeBom.description || "",
        engineer: dbBom?.engineer || "",
        material: "-",
        mass: 0,
        price: 0,
        quantity: 1,
        comments: dbBom?.comments || "",
        documentID: key.documentID,
        wvmType: key.wvmType,
        wvmID: key.wvmID,
        elementID: key.elementID,
        entityID: bomID,
        onshapeURL: dbBom?.onshapeURL || onshapeUrl,
        exportSTL: "",
        exportParasolid: "",
        dbAction: isExist ? "" : "add",
        vendor: dbBom?.vendor || onshapeBom.bomSource?.element?.vendor || "",
      };

      return { node: { row, key, bomID, onshapeBom }, dbBom };
    },
    [context.server]
  );

  const resolvePartRow = useCallback(
    async (parsedItem: ParsedOnshapeBomRow, parentRowId: string | null, rootBom: BomModel | null): Promise<AssemblyBomRow> => {
      const key: OnshapeKey = {
        documentID: parsedItem.itemSource.documentId,
        wvmType: parsedItem.itemSource.wvmType,
        wvmID: parsedItem.itemSource.wvmId,
        elementID: parsedItem.itemSource.elementId,
      };
      const partID = parsedItem.itemSource.partId || "";

      let dbPart: PartModel | null = null;
      // Only worth checking the DB if the part could plausibly be there -
      // if the parent assembly itself was never published, its parts can't
      // be either (per the publish-cascades-down model), but we still check
      // in case this exact part was independently published elsewhere.
      try {
        dbPart = await getPartByOnshapeKey(key, partID);
      } catch {
        dbPart = null;
      }
      const rowId = `${key.documentID}_${key.wvmType}_${key.wvmID}_${key.elementID}_${partID}`;

      const isPublished = Boolean(dbPart)
      const isExist = isPublished && rootBom !== null && (
        parentRowId
          ? await (async () => {
            const bom = await fetchFromApi<BomModel>(`/db/bom/id/${parentRowId}`);
            return bom.parts.find((c) => c.partID === rowId);
          })() :
          Boolean(rootBom.parts.find((c) => c.partID === rowId))
      );
      const onshapeUrl = buildOnshapeElementURL(context.server, key);

      return {
        id: rowId,
        parentId: parentRowId,
        isExpanded: false,
        source: isPublished ? "db" : "onshape-only",
        isAssembly: false,
        avatar: dbPart?.avatarID ? `/drive/file/id/${dbPart.avatarID}` : "",
        name: dbPart?.name || parsedItem.name || partID,
        catalogNumber: dbPart?.catalogNumber || parsedItem.partNumber || "",
        revision: dbPart?.revision || parsedItem.revision || "",
        description: dbPart?.description || parsedItem.description || "",
        engineer: dbPart?.engineer || "",
        material: dbPart?.material || parsedItem.material || "",
        mass: dbPart?.mass || 0,
        price: dbPart?.price || 0,
        quantity: parsedItem.quantity || 1,
        comments: dbPart?.comments || "",
        documentID: key.documentID,
        wvmType: key.wvmType,
        wvmID: key.wvmID,
        elementID: key.elementID,
        entityID: partID,
        onshapeURL: dbPart?.onshapeURL || onshapeUrl,
        exportSTL: dbPart?.stlLink || "",
        exportParasolid: dbPart?.parasolidLink || "",
        dbAction: isExist ? "" : "add",
        vendor: dbPart?.vendor || parsedItem.vendor || "",
      };
    },
    [context.server]
  );

  const loadTree = useCallback(async () => {
    if (!rootKey) return;

    setLoading(true);
    setError(null);

    const visitedBomIds = new Set<string>();
    const allRows: AssemblyBomRow[] = [];

    try {
      const { node: rootNode, dbBom } = await resolveBomNode(rootKey, null, 'root');
      setRootBomDB(dbBom);
      setRootIsPublished(Boolean(dbBom));
      setRootOnshapeBom(rootNode.onshapeBom ?? null);
      visitedBomIds.add(rootNode.bomID!);
      // The root assembly itself isn't shown as a row (mirrors BomDetailsPage) -
      // its identity is shown via the page header instead.

      async function expand(node: ResolvedNode, isRoot: boolean) {
        const parsedItems = node.onshapeBom ? parseOnshapeBomTable(node.onshapeBom) : [];
        const childParentId = isRoot ? null : node.row.id;

        for (const item of parsedItems) {
          if (item.isSubassembly) {
            const subKey: OnshapeKey = {
              documentID: item.itemSource.documentId,
              wvmType: item.itemSource.wvmType,
              wvmID: item.itemSource.wvmId,
              elementID: item.itemSource.elementId,
            };
            const subKeyId = `${subKey.documentID}_${subKey.wvmType}_${subKey.wvmID}_${subKey.elementID}`;
            if (visitedBomIds.has(subKeyId)) continue;
            visitedBomIds.add(subKeyId);

            const { node: subNode } = await resolveBomNode(subKey, childParentId, dbBom);
            allRows.push(subNode.row);
            await expand(subNode, false);
          } else {
            const partRow = await resolvePartRow(item, childParentId, dbBom);
            allRows.push(partRow);
          }
        }
      }

      await expand(rootNode, true);
      setRows(allRows);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [rootKey, resolveBomNode, resolvePartRow, rootBomDB]);

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.documentId, context.workspaceId, context.versionId, context.elementId]);

  const columns = useMemo(
    () =>
      buildAssemblyBomColumns({
        rootIsPublished,
        onAddToDb: (row) => {
          if (!rootIsPublished) {
            client.showMessageBubble(
              `Publish the top-level assembly to save "${row.name}" and everything else to the database.`
            );
            return;
          }
          return handlePublishItem(row);
        },
      }),
    [client, rootIsPublished]
  );

  const handlePublishItem = useCallback(
    async (row: AssemblyBomRow) => {
      const key: OnshapeKey = {
        documentID: row.documentID,
        wvmType: row.wvmType,
        wvmID: row.wvmID,
        elementID: row.elementID,
      };

      if (!rootBomDB || !rootKey) return;

      try {
        if (row.isAssembly) {
          const children = rows.filter((r) => r.parentId === row.id);
          const parts = children
            .filter((c) => !c.isAssembly)
            .map((c) => ({ partID: c.id, quantity: c.quantity || 1 }));
          const subAssemblies = children
            .filter((c) => c.isAssembly)
            .map((c) => ({ bomID: c.id, quantity: c.quantity || 1 }));

          const bomAvatarId = await syncBomThumbnailToDrive(key, row.name);

          await upsertBomById(row.id, {
            id: row.id,
            name: row.name,
            description: row.description,
            catalogNumber: row.catalogNumber,
            comments: row.comments,
            engineer: row.vendor === "" ? row.engineer : row.vendor,
            parts: parts,
            subAssemblies: subAssemblies,
            onshapeURL: `https://cad.onshape.com/documents/${key.documentID}/${key.wvmType}/${key.wvmID}/e/${key.elementID}`,
            avatarID: bomAvatarId || "",
            onshapeID: {
              ...key,
              bomID: row.entityID,
            },
            vendor: row.vendor,
          });
        } else {
          const { avatarID, stlLink, parasolidLink } = await syncPartFilesToDrive(
            key,
            row.entityID,
            row.name
          );

          await upsertPartById(row.id, {
            id: row.id,
            name: row.name,
            description: row.description,
            catalogNumber: row.catalogNumber,
            revision: row.revision,
            material: row.material,
            mass: row.mass,
            price: row.price,
            comments: row.comments,
            engineer: row.vendor === "" ? row.engineer : row.vendor,
            ...(avatarID ? { avatarID } : {}),
            ...(stlLink ? { stlLink } : {}),
            ...(parasolidLink ? { parasolidLink } : {}),
            onshapeURL: `https://cad.onshape.com/documents/${key.documentID}/${key.wvmType}/${key.wvmID}/e/${key.elementID}`,
            onshapeID: {
              ...key,
              partID: row.entityID,
            },
            vendor: row.vendor,
          });
        }

        if (row.parentId !== null) {
          if (row.isAssembly) {
            const children = await fetchFromApi<BomModel>(`/db/bom/id/${row.parentId}`);
            if (children.subAssemblies.length === 0) return;
            await upsertBomById(row.parentId, {
              subAssemblies: [...children.subAssemblies, { bomID: row.id, quantity: row.quantity || 1 }]
            });
          } else {
            const children = await fetchFromApi<BomModel>(`/db/bom/id/${row.parentId}`);
            if (children.parts.length === 0) return;
            await upsertBomById(row.parentId, {
              parts: [...children.parts, { partID: row.id, quantity: row.quantity || 1 }]
            });
          }
        } else {
          const rootID = rootBomDB?.id || `${rootKey.documentID}_${rootKey.wvmType}_${rootKey.wvmID}_${rootKey.elementID}_${rootOnshapeBom?.id}` || "wrong id";
          if (row.isAssembly) {
            const children = await fetchFromApi<BomModel>(`/db/bom/id/${rootID}`);
            if (children.subAssemblies.length === 0) return;
            await upsertBomById(rootID, {
              subAssemblies: [...children.subAssemblies, { bomID: row.id, quantity: row.quantity || 1 }]
            });
          } else {
            const children = await fetchFromApi<BomModel>(`/db/bom/id/${rootID}`);
            if (children.parts.length === 0) return;
            await upsertBomById(rootID, {
              parts: [...children.parts, { partID: row.id, quantity: row.quantity || 1 }]
            });
          }
        }

        client.showMessageBubble(`"${row.name}" was published to the database.`);
        await loadTree();
      } catch (err) {
        const apiErr = err as ApiError;
        client.showMessageBubble(`Publish failed: ${apiErr.message}`);
      }
    },
    [rows, client, loadTree]
  );

  const handleTableEdit = useCallback(
    (newData: AssemblyBomRow[]) => {
      // Find which row actually changed so we know what to persist. Table
      // only ever mutates one row per interaction (a single cell commit).
      const previousById = new Map(rows.map((r) => [r.id, r]));
      const changed = newData.find((r) => {
        const prev = previousById.get(r.id);
        if (!prev) return false;
        return (Object.keys(r) as (keyof AssemblyBomRow)[]).some((k) => r[k] !== prev[k]);
      });

      if (!changed) return;
      if (changed.vendor !== "") return;

      setRows(newData);

      if (!rootIsPublished) {

        const key: OnshapeKey = {
          documentID: changed.documentID,
          wvmType: changed.wvmType,
          wvmID: changed.wvmID,
          elementID: changed.elementID,
        };

        const persistToOnshape = async () => {
          try {
            if (changed.isAssembly) {
              await updateOnshapeBomMetadata(key, {
                name: changed.name,
                description: changed.description,
                partNumber: changed.catalogNumber,
              });
            } else {
              await updateOnshapePartMetadata(key, changed.entityID, {
                name: changed.name,
                description: changed.description,
                catalogNumber: changed.catalogNumber,
                revision: changed.revision,
                engineer: changed.engineer,
                price: changed.price,
                comments: changed.comments,
              });
            }
            client.showMessageBubble(`"${changed.name}" was updated in the database.`);
          } catch (err) {
            const apiErr = err as ApiError;
            client.showMessageBubble(`Failed to save "${changed.name}": ${apiErr.message}`);
            setError(apiErr);
          }
        };

        persistToOnshape();
        return;
      }

      if (changed.source !== "db") return;

      const key: OnshapeKey = {
        documentID: changed.documentID,
        wvmType: changed.wvmType,
        wvmID: changed.wvmID,
        elementID: changed.elementID,
      };

      const persist = async () => {
        try {
          if (changed.isAssembly) {
            await upsertBomById(changed.id, {
              name: changed.name,
              description: changed.description,
              catalogNumber: changed.catalogNumber,
              engineer: changed.engineer,
              comments: changed.comments,
            });
          } else {
            await upsertPartById(changed.id, {
              name: changed.name,
              description: changed.description,
              catalogNumber: changed.catalogNumber,
              revision: changed.revision,
              engineer: changed.engineer,
              material: changed.material,
              mass: changed.mass,
              price: changed.price,
              comments: changed.comments,
            });
            // Best-effort mirror of the editable fields back onto Onshape's
            // own part metadata. Never blocks or reverts the DB save.
            try {
              await updateOnshapePartMetadata(key, changed.entityID, {
                name: changed.name,
                description: changed.description,
                catalogNumber: changed.catalogNumber,
                revision: changed.revision,
                engineer: changed.engineer,
                price: changed.price,
                comments: changed.comments
              });
            } catch {
              // Onshape metadata push is best-effort only.
            }
          }
          client.showMessageBubble(`"${changed.name}" was updated in the database.`);
        } catch (err) {
          const apiErr = err as ApiError;
          client.showMessageBubble(`Failed to save "${changed.name}": ${apiErr.message}`);
          setError(apiErr);
        }
      };

      persist();
    },
    [rows, client, rootIsPublished]
  );

  const handlePublish = useCallback(
    async (values: PublishBomFormValues) => {
      if (!rootKey || !rootOnshapeBom) return;
      setPublishing(true);
      setPublishError(null);

      const rootID = rootBomDB?.id || `${rootKey.documentID}_${rootKey.wvmType}_${rootKey.wvmID}_${rootKey.elementID}_${rootOnshapeBom?.id}` || "wrong id";

      const ROOT_SENTINEL = "__root__";
      const rootRowId = ROOT_SENTINEL;

      const childrenByParentRowId = new Map<string, AssemblyBomRow[]>();
      for (const row of rows) {
        const parentKey = row.parentId ?? ROOT_SENTINEL;
        const list = childrenByParentRowId.get(parentKey) ?? [];
        list.push(row);
        childrenByParentRowId.set(parentKey, list);
      }

      const buildLinkArrays = (parentRowId: string) => {
        const children = childrenByParentRowId.get(parentRowId) ?? [];
        const parts = children
          .filter((c) => !c.isAssembly)
          .map((c) => ({ partID: c.id, quantity: c.quantity || 1 }));
        const subAssemblies = children
          .filter((c) => c.isAssembly)
          .map((c) => ({ bomID: c.id, quantity: c.quantity || 1 }));
        return { parts, subAssemblies };
      };

      try {
        const rootLinks = buildLinkArrays(rootRowId);
        const rootBomAvatarID = await syncBomThumbnailToDrive(rootKey, values.name);
        await upsertBomById(rootID, {
          id: rootID,
          name: values.name,
          description: values.description,
          comments: values.comments,
          catalogNumber: values.catalogNumber,
          engineer: rootBomDB?.engineer || values.defaultEngineer,
          parts: rootLinks.parts,
          subAssemblies: rootLinks.subAssemblies,
          avatarID: rootBomAvatarID || "",
          onshapeID: {
            ...rootKey,
            bomID: rootOnshapeBom.id
          },
          onshapeURL: `https://cad.onshape.com/documents/${rootKey.documentID}/${rootKey.wvmType}/${rootKey.wvmID}/e/${rootKey.elementID}`,
        });

        for (const row of rows) {
          if (row.source === "db") continue;

          const key: OnshapeKey = {
            documentID: row.documentID,
            wvmType: row.wvmType,
            wvmID: row.wvmID,
            elementID: row.elementID,
          };
          const engineer = row.engineer || values.defaultEngineer;
          if (row.isAssembly) {
            const links = buildLinkArrays(row.id);
            const bomAvatarId = await syncBomThumbnailToDrive(key, values.name);
            await upsertBomById(row.id, {
              id: row.id,
              name: row.name,
              description: row.description,
              catalogNumber: row.catalogNumber,
              comments: row.comments,
              engineer: row.vendor === "" ? engineer : row.vendor,
              parts: links.parts,
              subAssemblies: links.subAssemblies,
              onshapeURL: `https://cad.onshape.com/documents/${key.documentID}/${key.wvmType}/${key.wvmID}/e/${key.elementID}`,
              avatarID: bomAvatarId || "",
              onshapeID: {
                ...key,
                bomID: row.entityID,
              },
              vendor: row.vendor
            });
          } else {
            const { avatarID, stlLink, parasolidLink } = await syncPartFilesToDrive(
              key,
              row.entityID,
              row.name
            );
            await upsertPartById(row.id, {
              id: row.id,
              name: row.name,
              description: row.description,
              catalogNumber: row.catalogNumber,
              revision: row.revision,
              material: row.material,
              mass: row.mass,
              price: row.price,
              comments: row.comments,
              engineer: row.vendor === "" ? engineer : row.vendor,
              ...(avatarID ? { avatarID } : {}),
              ...(stlLink ? { stlLink } : {}),
              ...(parasolidLink ? { parasolidLink } : {}),
              onshapeURL: `https://cad.onshape.com/documents/${key.documentID}/${key.wvmType}/${key.wvmID}/e/${key.elementID}`,
              onshapeID: {
                ...key,
                partID: row.entityID,
              },
              vendor: row.vendor
            });
          }
        }

        client.showMessageBubble(`"${values.name}" and its contents were published to the database.`);
        setPublishOpen(false);
        await loadTree();
      } catch (err) {
        const apiErr = err as ApiError;
        setPublishError(apiErr.message);
        client.showMessageBubble(`Publish failed: ${apiErr.message}`);
      } finally {
        setPublishing(false);
      }
    },
    [rootKey, rootOnshapeBom, rootBomDB, rows, client, loadTree]
  );

  if (!rootKey) {
    return (
      <div className="p-8 text-center text-zinc-400">
        Waiting for Onshape to provide document context...
      </div>
    );
  }

  const displayName = rootBomDB?.name || rootOnshapeBom?.name.slice(6) || "Assembly";

  return (
    <div className="p-8">
      <div className="assembly-bom-header">
        <div>
          <h1 className="assembly-bom-title">{displayName}</h1>
          {rootBomDB?.description && <p className="assembly-bom-subtitle">{rootBomDB.description}</p>}
          {!rootIsPublished && (
            <p className="assembly-bom-unpublished-hint">
              This assembly isn't in the database yet - it's showing live Onshape data.
            </p>
          )}
        </div>
        {!rootIsPublished && (
          <button
            type="button"
            className="publish-btn-primary"
            onClick={() => setPublishOpen(true)}
            disabled={loading}
          >
            {rootIsPublished ? "Update published BOM" : "Publish to database"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          <p className="font-semibold">Error Loading BOM Data</p>
          <p>{error.message}</p>
          {error.statusCode && <p className="text-sm">HTTP Status Code: {error.statusCode}</p>}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-zinc-400">Resolving assembly tree...</div>
      ) : (
        <Table
          data={rows}
          columnsData={columns}
          setData={(newData) => handleTableEdit(newData as AssemblyBomRow[])}
          newRowFunction={undefined}
          initialSort={{ key: "catalogNumber", direction: "asc" }}
        />
      )}

      <PublishBomModal
        open={publishOpen}
        initialName={rootBomDB?.name || rootOnshapeBom?.name || ""}
        onCancel={() => (publishing ? undefined : setPublishOpen(false))}
        onSubmit={handlePublish}
        submitting={publishing}
      />

      {publishError && !publishOpen && (
        <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          {publishError}
        </div>
      )}
    </div>
  );
}
