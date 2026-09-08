import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "stream";
import "dotenv/config";

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SETUP
 * ─────────────────────────────────────────────────────────────────────────
 * 1. You said you already created the OAuth2 client. Paste it in below,
 *    or better, import it from wherever you created it and pass it into
 *    `createGoogleDriveService(oauth2Client)`.
 *
 *    Example of what that client usually looks like:
 *
 *    const oauth2Client = new google.auth.OAuth2(
 *      process.env.GOOGLE_CLIENT_ID,
 *      process.env.GOOGLE_CLIENT_SECRET,
 *      process.env.GOOGLE_REDIRECT_URI
 *    );
 *    oauth2Client.setCredentials({
 *      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
 *    });
 *
 * 2. Set the root folder ID (the "specific folder" all your files live under)
 *    as an env var: GOOGLE_DRIVE_ROOT_FOLDER_ID=xxxxxxxxxxxx
 *    (This is the long ID in the folder's URL:
 *     https://drive.google.com/drive/folders/<THIS_PART>)
 *
 * 3. Install dependencies if you haven't:
 *    npm install googleapis
 * ─────────────────────────────────────────────────────────────────────────
 */

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID as string;

if (!ROOT_FOLDER_ID) {
  // Not throwing here so the module can still be imported in tests/tooling,
  // but every call will fail fast if this isn't set.
  console.warn(
    "[googleDriveService] GOOGLE_DRIVE_ROOT_FOLDER_ID is not set. All Drive operations will fail.",
  );
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  parents?: string[];
}

export interface UploadFileParams {
  /** Name to give the file in Drive, e.g. "invoice.pdf" */
  fileName: string;
  /** MIME type, e.g. "application/pdf", "image/png" */
  mimeType: string;
  /** File contents as a Buffer (from multer, fs.readFileSync, etc.) */
  buffer: Buffer;
  /**
   * Optional subfolder ID under the root folder to upload into.
   * If omitted, the file is uploaded directly into ROOT_FOLDER_ID.
   */
  folderId?: string;
}

export class GoogleDriveService {
  private drive: drive_v3.Drive;

  constructor(oauth2Client: OAuth2Client) {
    this.drive = google.drive({ version: "v3", auth: oauth2Client });
  }

  /**
   * Get all files in a given folder.
   * If no folderId is passed, defaults to the root folder configured above.
   */
  async getAllFilesInFolder(
    folderId: string = ROOT_FOLDER_ID,
  ): Promise<DriveFile[]> {
    this.assertRootConfigured();

    const files: DriveFile[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, blob)",
        pageSize: 100,
        pageToken,
      });

      const items = (res.data.files ?? []) as drive_v3.Schema$File[];
      files.push(...items.map(this.mapFile));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return files;
  }

  /**
   * Get metadata for a specific file by its Drive file ID.
   */
  async getFile(fileId: string): Promise<DriveFile> {
    const res = await this.drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents",
    });

    return this.mapFile(res.data);
  }

  /**
   * Download a specific file's raw content (useful if you want to stream it
   * back to a client via Express res.pipe(), or return it as a Buffer).
   */
  async getFileContent(fileId: string): Promise<Buffer> {
    const res = await this.drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    return Buffer.from(res.data as ArrayBuffer);
  }

  /**
   * Upload a file into a specific directory under the root folder.
   * If no folderId is passed, uploads directly into the root folder.
   */
  async uploadFile(params: UploadFileParams): Promise<DriveFile> {
    this.assertRootConfigured();
    const { fileName, mimeType, buffer, folderId } = params;

    const res = await this.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId ?? ROOT_FOLDER_ID],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents",
    });

    return this.mapFile(res.data);
  }

  /**
   * Delete a specific file by its Drive file ID.
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
  }

  /**
   * Delete a folder (and everything inside it, since Drive deletes
   * a folder's contents along with it).
   */
  async deleteFolder(folderId: string): Promise<void> {
    await this.drive.files.delete({ fileId: folderId });
  }

  /**
   * Create a subfolder under the root folder (handy helper, not explicitly
   * requested but often needed alongside the above).
   */
  async createFolder(
    folderName: string,
    parentFolderId: string = ROOT_FOLDER_ID,
  ): Promise<DriveFile> {
    this.assertRootConfigured();

    const res = await this.drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields:
        "id, name, mimeType, createdTime, modifiedTime, webViewLink, parents",
    });

    return this.mapFile(res.data);
  }

  private assertRootConfigured() {
    if (!ROOT_FOLDER_ID) {
      throw new Error(
        "GOOGLE_DRIVE_ROOT_FOLDER_ID is not set. Add it to your environment variables.",
      );
    }
  }

  async checkConnection(): Promise<
    | { connected: true; user: string | undefined }
    | { connected: false; error: string }
  > {
    try {
      const res = await this.drive.about.get({ fields: "user(emailAddress)" });
      return {
        connected: true,
        user: res.data.user?.emailAddress ?? undefined,
      };
    } catch (err: any) {
      return {
        connected: false,
        error: err?.message ?? "Unknown error connecting to Google Drive",
      };
    }
  }

  private mapFile(file: drive_v3.Schema$File): DriveFile {
    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size ?? undefined,
      createdTime: file.createdTime ?? undefined,
      modifiedTime: file.modifiedTime ?? undefined,
      webViewLink: file.webViewLink ?? undefined,
      webContentLink: file.webContentLink ?? undefined,
      parents: file.parents ?? undefined,
    };
  }
}

/**
 * Factory function — pass in your already-configured OAuth2Client.
 *
 * Usage in your Express app (e.g. app.ts or a routes file):
 *
 *   import { createGoogleDriveService } from './services/googleDriveService';
 *   import { oauth2Client } from './auth/oauth2Client'; // your existing client
 *
 *   const driveService = createGoogleDriveService(oauth2Client);
 *
 *   app.get('/files', async (req, res) => {
 *     const files = await driveService.getAllFilesInFolder();
 *     res.json(files);
 *   });
 */
export function createGoogleDriveService(
  oauth2Client: OAuth2Client,
): GoogleDriveService {
  return new GoogleDriveService(oauth2Client);
}
