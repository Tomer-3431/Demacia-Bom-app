import { useEffect, useState } from "react";

const BASE_URL = "http://localhost:5050/api";

export interface ApiError {
  message: string;
  statusCode?: number;
}

export async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const secret = import.meta.env.VITE_CLIENT_SECRET;

  if (!secret) {
    throw { message: "VITE_CLIENT_SECRET is missing from environment variables." };
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "x-client-secret": secret,
      },
    });

    if (!response.ok) {
      throw {
        message: `Failed request to ${endpoint}: ${response.statusText}`,
        statusCode: response.status,
      } as ApiError;
    }

    return await response.json();
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw { message: err.message || "Network error occurred." } as ApiError;
  }
}

/**
 * Fetches a file from the backend server using the client secret header
 * and triggers a browser file download[cite: 6].
 *
 * Handles both raw binary responses (Blob) and JSON-wrapped Buffer responses
 * ({ type: "Buffer", data: number[] })[cite: 6].
 *
 * @param url - Full endpoint URL to fetch the file from (e.g., http://localhost:5050/api/drive/file/${id})[cite: 6].
 * @param filename - Filename to save as on the user's device (e.g., "part.stl")[cite: 6].
 * @param mimeType - Optional explicit MIME type for the downloaded blob[cite: 6].
 */
export async function downloadFile(
  url: string,
  filename: string,
  mimeType?: string
): Promise<void> {
  const secret = import.meta.env.VITE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("VITE_CLIENT_SECRET is missing from environment variables.");
  }

  const response = await fetch(url, {
    headers: {
      "x-client-secret": secret,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const firstBytes = new Uint8Array(arrayBuffer.slice(0, 16));

  // Check if response is a JSON-wrapped Buffer: { type: "Buffer", data: number[] }
  const looksLikeJson = firstBytes.length > 0 && firstBytes[0] === 0x7b; // '{'

  let blob: Blob;
  if (looksLikeJson) {
    const text = new TextDecoder().decode(arrayBuffer);
    const json: { type: "Buffer"; data: number[] } = JSON.parse(text);
    const bytes = new Uint8Array(json.data);
    blob = new Blob([bytes], { type: mimeType ?? "application/octet-stream" });
  } else {
    const responseContentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    blob = new Blob([arrayBuffer], { type: mimeType ?? responseContentType });
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export function AuthenticatedImage({ src, alt, className, ...props }: AuthenticatedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const mimeType = 'image/png';

  useEffect(() => {
    let objectUrl: string | null = null;
    const secret = import.meta.env.VITE_CLIENT_SECRET;

    if (!src) return;

    const getPicture = async () => {
      try {
        const res = await fetch(`${BASE_URL}${src}`, {
          headers: secret ? { "x-client-secret": secret } : {},
        })
        if (!res.ok) throw new Error("Failed to load image");

        const arrayBuffer = await res.arrayBuffer();
        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 16));
        const looksLikeJson = firstBytes.length > 0 && firstBytes[0] === 0x7b; // '{'

        let blob: Blob;
        if (looksLikeJson) {
          // JSON-wrapped Buffer response: { type: "Buffer", data: number[] }
          const text = new TextDecoder().decode(arrayBuffer);
          const json: { type: 'Buffer'; data: number[] } = JSON.parse(text);
          const bytes = new Uint8Array(json.data);
          blob = new Blob([bytes], { type: mimeType  });
        } else {
          blob = new Blob([arrayBuffer], { type: mimeType  });
        }

        console.info(blob);

        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setError(false);
      } catch (err) {
        setError(true);
      } 
    };

    return () => {
      getPicture();
    };
  }, [src])

  // Cleanup object URL when component unmounts or src changes to prevent memory leaks
  if (error) {
    return <span className="text-zinc-600 text-sm">Image Load Failed</span>;
  }

  if (!imageSrc) {
    return <span className="text-zinc-600 text-sm">Loading...</span>;
  }

  return <img src={imageSrc} alt={alt} className={className} {...props} />;
}
