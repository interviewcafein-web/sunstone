// Google Drive share links, turned into an embeddable viewer and a direct download.
// Based on InterviewCafe's frontend (src/lib/driveLinks.ts).

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

/**
 * A direct download for Drive files; other links are returned unchanged. Drive's usual
 * uc?export=download stops at a "can't scan for viruses" page for files over ~100 MB (the
 * Java book is 176 MB); this address with confirm=t downloads straight away, under the
 * file's own name.
 */
export function driveDownloadUrl(url: string): string {
  const id = driveFileId(url);
  return id
    ? `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
    : url;
}

/** The normal Drive page, for "Open in Drive". */
export function driveViewUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/view` : url;
}
