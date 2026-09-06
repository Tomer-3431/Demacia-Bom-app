/**
 * onshapeExtension.tsx
 * =============================================================================
 * Utilities for a React app that runs as an OAuth-registered Onshape
 * "Application Extension" - loaded by Onshape inside an <iframe> (as an
 * Element Tab, an Element Right Panel entry, etc.) and talking to the parent
 * Onshape window over `window.postMessage`.
 *
 * WHAT THIS FILE COVERS
 * ----------------------
 * - Parsing the query-string context Onshape passes into your iframe
 *   (documentId, workspaceId/versionId, elementId, server, ...).
 * - A typed wrapper around every documented message the extension can send to
 *   Onshape (showMessageBubble, requestSelectionHighlight,
 *   requestCameraProperties, openSelectItemDialog, ...) and every message
 *   Onshape can send back (show, hide, SELECTION, cameraProperties,
 *   saveChanges, ...).
 * - React hooks (useOnshapeContext, useOnshapeClient, useOnshapeMessage, ...)
 *   for wiring the above into components.
 * - Small OAuth2 redirect helpers: building the `/oauth/authorize` URL,
 *   handling the `redirectOnshapeUri` re-grant redirect, and stashing state
 *   across the redirect round trip.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT COVER
 * --------------------------------------------
 * The Onshape REST API (documents/parts/assemblies/translations/etc). Onshape
 * does not support calling that API directly from a browser (CORS), so those
 * calls - and the "exchange code for token" step, which needs your client
 * secret - belong on your server. See:
 * https://onshape-public.github.io/docs/auth/oauth/
 *
 * REFERENCE
 * ---------
 * - Extensions & security rules:  https://onshape-public.github.io/docs/app-dev/extensions/
 * - Client messaging overview:    https://onshape-public.github.io/docs/app-dev/messages/
 * - Element Tab messages:         https://onshape-public.github.io/docs/app-dev/messages/element-tab/
 * - Element Right Panel messages: https://onshape-public.github.io/docs/app-dev/messages/element-right-panel/
 * - OAuth2:                       https://onshape-public.github.io/docs/auth/oauth/
 *
 * QUICK START
 * -----------
 *   function App() {
 *     const client = useOnshapeClient();   // parses the URL + sends applicationInit
 *     useOnshapeKeepAlive(client);         // keeps the Onshape session alive
 *
 *     useOnshapeMessage(client, (message) => {
 *       if (isCameraPropertiesMessage(message)) console.log(message.viewMatrix);
 *     });
 *
 *     function highlightTopFace() {
 *       // "select an element on the assembly" -> highlight it in the viewport
 *       client.requestSelectionHighlight([
 *         { selectionType: 'ENTITY', selectionId: 'JHO', entityType: 'FACE' },
 *       ]);
 *     }
 *
 *     return null; // ...your UI
 *   }
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/* =============================================================================
 * 1. Context - the query parameters Onshape injects into your iframe's URL
 * ========================================================================== */

/** 'w' = workspace, 'v' = version. Comes from the `workspaceOrVersion` query
 *  param used by locations other than Element Tab (which instead sends
 *  `workspaceId` / `versionId` directly). */
export type OnshapeWorkspaceOrVersion = 'w' | 'v';

/**
 * Normalized identifiers Onshape can pass into an extension's iframe URL.
 * Not every field is populated for every extension location - see
 * https://onshape-public.github.io/docs/app-dev/extensions/#supported-locations-and-contexts
 * For Element Right Panel (and other Action-URL based) extensions, Onshape
 * only fills these in if your registered Action URL actually references the
 * matching `{$xxx}` placeholder (e.g. `...&elementId={$elementId}`) - only
 * `server`, `companyId`, `userId`, `locale`, and `clientId` are appended
 * automatically regardless of your Action URL.
 */
export interface OnshapeContext {
  documentId: string | null;
  /** Set when the document is open to a workspace. Mutually exclusive with versionId. */
  workspaceId: string | null;
  /** Set when the document is open to a version. Mutually exclusive with workspaceId. */
  versionId: string | null;
  microversionId: string | null;
  elementId: string | null;
  /** For "Selected instance" context menu extensions this is the host tab,
   *  which can differ from `elementId` (the selected/source element).
   *  Falls back to `elementId` when not separately provided. */
  tabElementId: string | null;
  /** Origin of the Onshape client, e.g. "https://cad.onshape.com". REQUIRED to
   *  validate incoming postMessage events - never trust a message whose
   *  `event.origin` doesn't match this. */
  server: string | null;
  companyId: string | null;
  userId: string | null;
  locale: string | null;
  clientId: string | null;
  /** Only populated for context-menu/tree style extensions with a Part context. */
  partId: string | null;
  partNumber: string | null;
  revision: string | null;
  featureId: string | null;
  nodeId: string | null;
  occurrencePath: string | null;
  configuration: string | null;
}

const CONTEXT_KEYS = [
  'documentId',
  'workspaceId',
  'versionId',
  'microversionId',
  'elementId',
  'tabElementId',
  'server',
  'companyId',
  'userId',
  'locale',
  'clientId',
  'partId',
  'partNumber',
  'revision',
  'featureId',
  'nodeId',
  'occurrencePath',
  'configuration',
] as const;

/**
 * Resolves the query string Onshape actually appended, regardless of whether
 * the app uses a plain URL (`?documentId=...`) or a hash router
 * (`#/route?documentId=...`, e.g. React Router's `HashRouter` or a manual
 * `#/Onshape?...` scheme).
 *
 * Browsers only populate `location.search` with what appears *before* the
 * `#`. A hash router puts its own `?query` *inside* `location.hash`, so on
 * a hash-routed app `location.search` is empty even though Onshape's params
 * are sitting right there in the URL - this pulls them out of whichever
 * place they actually are.
 */
function resolveOnshapeSearchString(): string {
  if (typeof window === 'undefined') return '';

  const { search, hash } = window.location;

  // Plain (non-hash-router) case: params are already in the real search string.
  if (search && search !== '?') return search;

  // Hash-router case: hash looks like "#/Onshape?documentId=...&...".
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) return hash.slice(queryIndex);

  return search;
}

/**
 * Parses the Onshape context out of a query string (defaults to whatever
 * `resolveOnshapeSearchString()` finds - handling hash-routed apps
 * automatically). Handles both styles Onshape uses:
 *  - Element Tab style: `workspaceId` / `versionId` passed directly.
 *  - Other locations (Element Right Panel, context menus, ...): a combined
 *    `workspaceOrVersion` ('w' | 'v') + `workspaceOrVersionId` pair.
 */
export function parseOnshapeContext(
  search: string = resolveOnshapeSearchString()
): OnshapeContext {
  const params = new URLSearchParams(search);
  const context = {} as OnshapeContext;

  for (const key of CONTEXT_KEYS) {
    context[key] = params.get(key);
  }

  const workspaceOrVersion = params.get('workspaceOrVersion') as OnshapeWorkspaceOrVersion | null;
  const workspaceOrVersionId = params.get('workspaceOrVersionId');
  if (workspaceOrVersion === 'w' && workspaceOrVersionId) {
    context.workspaceId = context.workspaceId ?? workspaceOrVersionId;
  }
  if (workspaceOrVersion === 'v' && workspaceOrVersionId) {
    context.versionId = context.versionId ?? workspaceOrVersionId;
  }

  context.tabElementId = context.tabElementId ?? context.elementId;

  return context;
}

/** True when running inside a foreign iframe (i.e. embedded in Onshape) as
 *  opposed to opened standalone in a top-level browser tab during development. */
export function isEmbeddedInOnshape(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top throws, which itself only happens
    // inside a cross-origin iframe - so this still counts as "embedded".
    return true;
  }
}

/* =============================================================================
 * 2. Message types - what you can send, and what Onshape can send back
 * ========================================================================== */

export type OnshapeEntityType = 'VERTEX' | 'EDGE' | 'FACE' | 'BODY' | 'DEGENERATE_EDGE' | 'UNKNOWN';
export type OnshapeSelectionType = 'ENTITY' | 'BODY' | 'GEOMETRY';
export type OnshapeBodyType =
  | 'SOLID'
  | 'SHEET'
  | 'WIRE'
  | 'POINT'
  | 'MATE_CONNECTOR'
  | 'COMPOSITE'
  | 'UNKNOWN';
export type OnshapeGeometryType =
  | 'LINE'
  | 'CIRCLE'
  | 'ARC'
  | 'PLANE'
  | 'CYLINDER'
  | 'CONE'
  | 'SPHERE'
  | 'TORUS'
  | 'SPLINE'
  | 'ELLIPSE'
  | 'MESH'
  | 'CONIC'
  | 'REVOLVED'
  | 'EXTRUDED'
  | 'ALL_MESH'
  | 'MIXED_MESH'
  | 'SPLINE_INTERNAL_POINT'
  | 'SPLINE_CONTROL_POLYGON'
  | 'ELLIPTICAL_ARC'
  | 'UNKNOWN';

export interface OnshapeEntitySelection {
  selectionType: 'ENTITY';
  /** Get this from, e.g., Assembly/getFeatures or PartStudio/getPartStudioBodyDetails. */
  selectionId: string;
  entityType: OnshapeEntityType;
}
export interface OnshapeBodySelection {
  selectionType: 'BODY';
  selectionId: string;
  bodyType: OnshapeBodyType;
}
export interface OnshapeGeometrySelection {
  selectionType: 'GEOMETRY';
  selectionId: string;
  geometryType: OnshapeGeometryType;
}
/** One entity to highlight/select via `requestSelectionHighlight`. */
export type OnshapeSelection = OnshapeEntitySelection | OnshapeBodySelection | OnshapeGeometrySelection;

export interface OnshapeOpenSelectItemDialogOptions {
  dialogTitle?: string;
  selectAssemblies?: boolean;
  selectBlobs?: boolean;
  /** Comma-delimited mime types, e.g. 'application/dwt,application/dwg'. */
  selectBlobMimeTypes?: string;
  selectMultiple?: boolean;
  selectParts?: boolean;
  selectPartStudios?: boolean;
  showBrowseDocuments?: boolean;
  showStandardContent?: boolean;
}

export interface OnshapeRequestSelectionOptions {
  entityTypeSpecifier: OnshapeEntityType[];
  /** Selections needed before the request resolves. Omit (or pass 0) for
   *  "unbounded", in which case you must call `stopRequest()` yourself. */
  requiredSelectionCount?: number;
  /** Auto-generated if omitted. Returned so you can correlate the eventual
   *  response (and any `stoppedMessageId` from a `stopRequest`) to this call. */
  messageId?: string;
}

/** Loosely typed message coming from the Onshape client. Every message has a
 *  `messageName`; everything else depends on which one it is - use the
 *  `isXxxMessage` guards below to narrow it to a concrete shape. */
export interface OnshapeIncomingMessage {
  messageName: string;
  [key: string]: unknown;
}

// ---- Fully documented "received" messages ----

export interface OnshapeShowMessage extends OnshapeIncomingMessage {
  messageName: 'show';
}
export interface OnshapeHideMessage extends OnshapeIncomingMessage {
  messageName: 'hide';
}
export interface OnshapeTakeFocusMessage extends OnshapeIncomingMessage {
  messageName: 'takeFocus';
}
export interface OnshapeSaveChangesMessage extends OnshapeIncomingMessage {
  messageName: 'saveChanges';
  /** Echo this back via `finishedSaving(messageId)` once pending edits are flushed. */
  messageId: string;
}
export interface OnshapePrintMessage extends OnshapeIncomingMessage {
  messageName: 'print';
  baseFileName: string;
}
export interface OnshapeSelectItemDialogClosedMessage extends OnshapeIncomingMessage {
  messageName: 'selectItemDialogClosed';
  context?: string;
}
export interface OnshapeExportMessage extends OnshapeIncomingMessage {
  messageName: 'export';
  fileExtension: '.dwg' | '.dxf';
  baseFileName: string;
}
export interface OnshapeStartFirstViewCommandMessage extends OnshapeIncomingMessage {
  messageName: 'startFirstViewCommand';
  documentId: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  elementName: string;
  elementType: 'partStudio' | 'assembly' | 'blob';
  elementMicroversionId: string;
  itemType: 'part' | 'partStudio' | 'assembly';
  partName?: string;
  idTag?: string;
}
export interface OnshapeCameraPropertiesMessage extends OnshapeIncomingMessage {
  messageName: 'cameraProperties';
  graphicsElementId: string;
  /** false if `graphicsElementId` is invalid, or hasn't been opened this session. */
  isValid: boolean;
  projectionType: 'orthographic' | 'perspective' | '';
  /** 16-element matrix; the last few elements encode camera position. */
  viewMatrix: number[];
  projectionMatrix: number[];
  verticalFieldOfView: number;
  viewportHeight: number;
  viewportWidth: number;
}
export interface OnshapeViewerImageMessage extends OnshapeIncomingMessage {
  messageName: 'viewerImage';
  image: Blob;
}
export interface OnshapeItemSelectedMessage extends OnshapeIncomingMessage {
  messageName: 'itemSelectedInSelectItemDialog';
  documentId: string;
  documentMicroversionId: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  elementName: string;
  elementType: string;
  elementMicroversionId: string;
  elementConfiguration: string;
  itemType: string;
  partName?: string;
  idTag?: string;
  includeSurfaces?: boolean;
  includeWires?: boolean;
  isSurface?: boolean;
  isFlattenedBody?: boolean;
  isComposite?: boolean;
  isSketch?: boolean;
  sketchIds?: string[];
  partNumber?: string;
  revision?: string;
  context?: string;
  isConfigurable?: boolean;
}

/** Union of every fully-documented received message (no catch-all) - handy for
 *  an exhaustive `switch`. Day-to-day code will usually just use the
 *  `isXxxMessage` guards against `OnshapeIncomingMessage` instead. */
export type OnshapeKnownReceivedMessage =
  | OnshapeShowMessage
  | OnshapeHideMessage
  | OnshapeTakeFocusMessage
  | OnshapeSaveChangesMessage
  | OnshapePrintMessage
  | OnshapeSelectItemDialogClosedMessage
  | OnshapeExportMessage
  | OnshapeStartFirstViewCommandMessage
  | OnshapeCameraPropertiesMessage
  | OnshapeViewerImageMessage
  | OnshapeItemSelectedMessage;

export function isSaveChangesMessage(m: OnshapeIncomingMessage): m is OnshapeSaveChangesMessage {
  return m.messageName === 'saveChanges';
}
export function isPrintMessage(m: OnshapeIncomingMessage): m is OnshapePrintMessage {
  return m.messageName === 'print';
}
export function isSelectItemDialogClosedMessage(
  m: OnshapeIncomingMessage
): m is OnshapeSelectItemDialogClosedMessage {
  return m.messageName === 'selectItemDialogClosed';
}
export function isExportMessage(m: OnshapeIncomingMessage): m is OnshapeExportMessage {
  return m.messageName === 'export';
}
export function isStartFirstViewCommandMessage(
  m: OnshapeIncomingMessage
): m is OnshapeStartFirstViewCommandMessage {
  return m.messageName === 'startFirstViewCommand';
}
export function isCameraPropertiesMessage(m: OnshapeIncomingMessage): m is OnshapeCameraPropertiesMessage {
  return m.messageName === 'cameraProperties';
}
export function isViewerImageMessage(m: OnshapeIncomingMessage): m is OnshapeViewerImageMessage {
  return m.messageName === 'viewerImage';
}
export function isItemSelectedMessage(m: OnshapeIncomingMessage): m is OnshapeItemSelectedMessage {
  return m.messageName === 'itemSelectedInSelectItemDialog';
}
/**
 * Fires after `applicationInit`, whenever the user selects something in the
 * graphics area (documented for Element Right Panel extensions - Onshape's
 * docs mention it as a general rule but only diagram it for that location).
 * The payload shape beyond `messageName` isn't publicly documented; log the
 * message during development to see what your extension actually receives.
 */
export function isSelectionMessage(m: OnshapeIncomingMessage): boolean {
  return m.messageName === 'SELECTION';
}

/* =============================================================================
 * 3. The client - one method per documented outgoing message, plus a listener
 * ========================================================================== */

export interface OnshapeClient {
  readonly context: OnshapeContext;

  /** Send once, immediately on load - Onshape will not post you any messages
   *  until it receives this. Set `notifyWhenSaveRequired` to get a
   *  `saveChanges` message before Onshape saves a version, so you can flush
   *  pending edits first (Element Tab extensions). */
  applicationInit(options?: { notifyWhenSaveRequired?: boolean }): void;
  /** Shows `message` in the blue bubble at the top of your extension. */
  showMessageBubble(message: string): void;
  /** (Element Tab) Tells Onshape to close its open flyouts/dropdown menus -
   *  call this on click/focus inside your extension. */
  closeFlyoutsAndMenus(): void;
  /** (Element Tab) Opens Onshape's standard "select a part/assembly/..."
   *  dialog; the choice arrives as an `itemSelectedInSelectItemDialog` message. */
  openSelectItemDialog(options?: OnshapeOpenSelectItemDialogOptions): void;
  /** (Element Tab) Closes the Select Item dialog. */
  closeSelectItemDialog(): void;
  /** (Element Tab) Shows "Onshape is not connected" and forces a reload. */
  connectionLost(): void;
  /** (Element Tab) Like `connectionLost`, with a custom message. */
  errorReload(message: string): void;
  /** (Element Tab) Reply to a `saveChanges` message once cleanup is done. */
  finishedSaving(messageId: string): void;
  /** (Element Tab) Send periodically while the user is active, so the Onshape
   *  session doesn't time out. See also `useOnshapeKeepAlive`. */
  keepAlive(): void;
  /** (Element Tab) Opens the "Create a version" dialog (mirrors shift-S). */
  saveAVersion(): void;
  /** (Element Tab) Opens the Keyboard Shortcuts help dialog (mirrors shift-?). */
  showKeyboardShortcutsHelp(): void;
  /** (Element Tab) Requests the camera/view matrix of a Part Studio or
   *  Assembly tab; that tab must have been opened at least once this
   *  session. Response arrives as a `cameraProperties` message. */
  requestCameraProperties(graphicsElementId: string): void;
  /** (Element Right Panel) Takes a screenshot of the current window at the
   *  given size; arrives back as a `viewerImage` message with a Blob. */
  requestViewerImage(width: number, height: number): void;
  /** (Element Right Panel) Waits for the user to select `requiredSelectionCount`
   *  entities matching `entityTypeSpecifier` (unbounded if omitted/0, in
   *  which case call `stopRequest()` to end it). Returns the messageId. */
  requestSelection(options: OnshapeRequestSelectionOptions): string;
  /** (Element Right Panel) Highlights/selects the given entities in the
   *  Onshape viewport - i.e. "select an element on the assembly". Returns
   *  the messageId, so a later `stopRequest()` can be correlated to this call. */
  requestSelectionHighlight(selections: OnshapeSelection[], messageId?: string): string;
  /** (Element Right Panel) Stops a pending `requestSelection` or
   *  `requestSelectionHighlight`. */
  stopRequest(): void;
  /** (Element Right Panel) Opens a different element (tab) in the current workspace. */
  openAnotherElementInCurrentWorkspace(anotherElementId: string): void;
  /** (Element Right Panel) Opens the edit dialog for the given feature. */
  openFeatureDialog(featureId: string): void;
  /** (Element Right Panel) Closes any open feature dialog; `accept` mimics
   *  the green check (true) vs the X/Cancel (false). */
  closeFeatureDialog(accept?: boolean): void;
  /** Subscribes to messages from Onshape, validating `event.origin` against
   *  `context.server` first. Returns an unsubscribe function. */
  onMessage(handler: (message: OnshapeIncomingMessage, event: MessageEvent) => void): () => void;
  /** Escape hatch for message types not yet wrapped above - merges
   *  `{ documentId, workspaceId/versionId, elementId }` with whatever you pass,
   *  so you only need to supply `messageName` and any message-specific fields. */
  sendRaw(message: { messageName: string; [key: string]: unknown }): void;
}

/** Generates a reasonably-unique id for correlating request/response messages
 *  (`requestSelection`, `requestSelectionHighlight`, `stopRequest`). */
export function newOnshapeMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let warnedMissingServer = false;

/**
 * Builds a client bound to one Onshape context (one iframe load). Usually
 * you'll get this from `useOnshapeClient()` rather than calling this directly.
 */
export function createOnshapeClient(context: OnshapeContext): OnshapeClient {
  function base(messageName: string): Record<string, unknown> {
    const message: Record<string, unknown> = {
      documentId: context.documentId,
      elementId: context.elementId,
      messageName,
    };
    if (context.workspaceId) {
      message.workspaceId = context.workspaceId;
    } else if (context.versionId) {
      message.versionId = context.versionId;
    }
    return message;
  }

  function post(message: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    window.parent.postMessage(message, '*');
  }

  const client: OnshapeClient = {
    context,

    applicationInit(options = {}) {
      post({ ...base('applicationInit'), notifyWhenSaveRequired: options.notifyWhenSaveRequired ?? false });
    },

    showMessageBubble(message) {
      post({ ...base('showMessageBubble'), message });
    },

    closeFlyoutsAndMenus() {
      post(base('closeFlyoutsAndMenus'));
    },

    openSelectItemDialog(options = {}) {
      post({
        ...base('openSelectItemDialog'),
        dialogTitle: options.dialogTitle ?? '',
        selectAssemblies: options.selectAssemblies ?? false,
        selectBlobs: options.selectBlobs ?? false,
        selectBlobMimeTypes: options.selectBlobMimeTypes ?? '',
        selectMultiple: options.selectMultiple ?? false,
        selectParts: options.selectParts ?? false,
        selectPartStudios: options.selectPartStudios ?? false,
        showBrowseDocuments: options.showBrowseDocuments ?? true,
        showStandardContent: options.showStandardContent ?? false,
      });
    },

    closeSelectItemDialog() {
      post(base('closeSelectItemDialog'));
    },

    connectionLost() {
      post(base('connectionLost'));
    },

    errorReload(message) {
      post({ ...base('errorReload'), message });
    },

    finishedSaving(messageId) {
      post({ ...base('finishedSaving'), messageId });
    },

    keepAlive() {
      post(base('keepAlive'));
    },

    saveAVersion() {
      post(base('saveAVersion'));
    },

    showKeyboardShortcutsHelp() {
      post(base('showKeyboardShortcutsHelp'));
    },

    requestCameraProperties(graphicsElementId) {
      post({ ...base('requestCameraProperties'), graphicsElementId });
    },

    requestViewerImage(width, height) {
      post({ ...base('requestViewerImage'), width, height });
    },

    requestSelection(options) {
      const messageId = options.messageId ?? newOnshapeMessageId();
      const message: Record<string, unknown> = {
        ...base('requestSelection'),
        messageId,
        entityTypeSpecifier: options.entityTypeSpecifier,
      };
      if (typeof options.requiredSelectionCount === 'number') {
        message.requiredSelectionCount = options.requiredSelectionCount;
      }
      post(message);
      return messageId;
    },

    requestSelectionHighlight(selections, messageId) {
      const id = messageId ?? newOnshapeMessageId();
      post({ ...base('requestSelectionHighlight'), messageId: id, selections });
      return id;
    },

    stopRequest() {
      post(base('stopRequest'));
    },

    openAnotherElementInCurrentWorkspace(anotherElementId) {
      post({ ...base('openAnotherElementInCurrentWorkspace'), anotherElementId });
    },

    openFeatureDialog(featureId) {
      post({ ...base('openFeatureDialog'), featureId });
    },

    closeFeatureDialog(accept = false) {
      post({ ...base('closeFeatureDialog'), accept });
    },

    onMessage(handler) {
      if (typeof window === 'undefined') return () => {};
      if (!context.server && !warnedMissingServer) {
        warnedMissingServer = true;
        console.warn(
          '[onshapeExtension] context.server is empty, so incoming messages will be ' +
            'ignored (they fail the origin check). Build the context with ' +
            'parseOnshapeContext()/useOnshapeContext() from the URL Onshape actually ' +
            'loaded your extension with.'
        );
      }
      const listener = (event: MessageEvent) => {
        if (!context.server || event.origin !== context.server) return;
        const data = event.data as { messageName?: unknown } | null | undefined;
        if (!data || typeof data.messageName !== 'string') return;
        handler(data as OnshapeIncomingMessage, event);
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },

    sendRaw(message) {
      post({ ...base(message.messageName), ...message });
    },
  };

  return client;
}

/* =============================================================================
 * 4. React hooks
 * ========================================================================== */

/** Parses the current URL (search string or hash-router query) into an
 *  `OnshapeContext` once per mount. */
export function useOnshapeContext(): OnshapeContext {
  return useMemo(() => parseOnshapeContext(), []);
}

export interface UseOnshapeClientOptions {
  /** Pass a context you parsed yourself (e.g. from a router) instead of the current URL. */
  context?: OnshapeContext;
  /** Send `applicationInit` automatically on mount. Defaults to true. */
  autoInit?: boolean;
  notifyWhenSaveRequired?: boolean;
}

/**
 * Creates an `OnshapeClient` bound to the current (or given) context, and -
 * by default - sends the required `applicationInit` message once on mount.
 */
export function useOnshapeClient(options: UseOnshapeClientOptions = {}): OnshapeClient {
  const urlContext = useOnshapeContext();
  const context = options.context ?? urlContext;

  const client = useMemo(
    () => createOnshapeClient(context),
    // Recreate only when the identifying fields actually change.
    [context.documentId, context.workspaceId, context.versionId, context.elementId, context.server]
  );

  const autoInit = options.autoInit ?? true;
  const notifyWhenSaveRequired = options.notifyWhenSaveRequired;
  useEffect(() => {
    if (autoInit) {
      client.applicationInit({ notifyWhenSaveRequired });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, autoInit]);

  return client;
}

/** Subscribes to incoming Onshape messages for as long as the component is mounted. */
export function useOnshapeMessage(
  client: OnshapeClient,
  handler: (message: OnshapeIncomingMessage, event: MessageEvent) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return client.onMessage((message, event) => handlerRef.current(message, event));
  }, [client]);
}

/** Sends `keepAlive` on an interval so the Onshape session doesn't time out
 *  while the user is active in your extension. Default: every 4 minutes. */
export function useOnshapeKeepAlive(client: OnshapeClient, intervalMs: number = 4 * 60 * 1000): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => client.keepAlive(), intervalMs);
    return () => window.clearInterval(id);
  }, [client, intervalMs]);
}

/** Tracks the most recent `SELECTION` message (see `isSelectionMessage`'s
 *  caveat about the payload not being fully published). */
export function useOnshapeSelection(client: OnshapeClient): OnshapeIncomingMessage | null {
  const [selection, setSelection] = useState<OnshapeIncomingMessage | null>(null);
  useOnshapeMessage(client, (message) => {
    if (isSelectionMessage(message)) setSelection(message);
  });
  return selection;
}

/* =============================================================================
 * 5. OAuth2 helpers - redirects only. Exchanging a code for tokens needs your
 *    client secret, so that step has to happen on your server; see the docs
 *    linked at the top of this file.
 * ========================================================================== */

export const ONSHAPE_OAUTH_URL = 'https://oauth.onshape.com';

export interface OnshapeAuthorizeOptions {
  clientId: string;
  /** Must exactly match one of the redirect URIs registered for this OAuth application. */
  redirectUri: string;
  /** Defaults to https://oauth.onshape.com; override only if Onshape tells you
   *  to use a different OAuth host. */
  oauthBaseUrl?: string;
  /** Recommended: defends against CSRF and can round-trip your own state
   *  (e.g. via `stashPreAuthState` / `popPreAuthState`) through the redirect. */
  state?: string;
  /** Onshape scopes are mainly configured when you register the OAuth
   *  application in Developer Settings; included here in case your app's
   *  flow supports an explicit override, but it may simply be ignored. */
  scope?: string;
  /** Needed to authenticate against a specific company/enterprise's data -
   *  see https://onshape-public.github.io/docs/auth/oauth/#enterprise-users */
  companyId?: string;
}

/** Builds the URL to send the browser to, to start Onshape's OAuth2 consent
 *  screen. `clientId` and `redirectUri` are not secret, so this is safe to
 *  build entirely in the browser. */
export function buildOnshapeAuthorizeUrl(options: OnshapeAuthorizeOptions): string {
  const base = options.oauthBaseUrl ?? ONSHAPE_OAUTH_URL;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
  });
  if (options.state) params.set('state', options.state);
  if (options.scope) params.set('scope', options.scope);
  if (options.companyId) params.set('company_id', options.companyId);
  return `${base}/oauth/authorize?${params.toString()}`;
}

/** Navigates the current tab to Onshape's OAuth2 consent screen. */
export function redirectToOnshapeAuthorize(options: OnshapeAuthorizeOptions): void {
  if (typeof window === 'undefined') return;
  window.location.href = buildOnshapeAuthorizeUrl(options);
}

export interface OnshapeOAuthCallbackParams {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
}

/** Parses the `code` / `state` / `error` query params Onshape appends when it
 *  redirects back to your `redirectUri`. Send `code` to your backend to
 *  exchange it for an access/refresh token pair. */
export function parseOnshapeOAuthCallback(
  search: string = resolveOnshapeSearchString()
): OnshapeOAuthCallbackParams {
  const params = new URLSearchParams(search);
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
}

/**
 * When a user needs to (re)grant your app access, Onshape can load your
 * extension with a `redirectOnshapeUri` query parameter instead of your
 * normal action URL; Onshape's docs expect you to redirect straight there.
 * Returns the URI if present.
 */
export function getRedirectOnshapeUri(
  search: string = resolveOnshapeSearchString()
): string | null {
  return new URLSearchParams(search).get('redirectOnshapeUri');
}

/** Call this early (e.g. at the top of your root component). If Onshape sent
 *  a `redirectOnshapeUri`, this redirects there immediately and returns true;
 *  otherwise it does nothing and returns false. */
export function redirectIfGrantRequired(search?: string): boolean {
  const uri = getRedirectOnshapeUri(search);
  if (uri && typeof window !== 'undefined') {
    window.location.href = uri;
    return true;
  }
  return false;
}

const PRE_AUTH_STATE_KEY = 'onshape-extension:pre-auth-state';

/** Stashes arbitrary state (e.g. the current OnshapeContext) in
 *  sessionStorage right before redirecting via `redirectToOnshapeAuthorize`,
 *  so it can be restored once the OAuth round trip lands back on your app. */
export function stashPreAuthState(state: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PRE_AUTH_STATE_KEY, JSON.stringify(state));
}

/** Reads back (and clears) whatever was stashed with `stashPreAuthState`. */
export function popPreAuthState<T = Record<string, unknown>>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PRE_AUTH_STATE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(PRE_AUTH_STATE_KEY);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
