// Google Drive share links, turned into an embeddable viewer and a direct download.
// Same rules as InterviewCafe's frontend (src/lib/driveLinks.ts).

function driveFileId(url: string): string | null {
  const fromPath = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fromPath) return fromPath[1];
  const fromQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return fromQuery && /google\.com/.test(url) ? fromQuery[1] : null;
}

/** Drive's own PDF viewer for Drive files; other links are shown as they are. */
export function drivePreviewUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

/** Drive's direct-download address for Drive files; other links are returned unchanged. */
export function driveDownloadUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

/** The normal Drive page, for "Open in Drive". */
export function driveViewUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/view` : url;
}
