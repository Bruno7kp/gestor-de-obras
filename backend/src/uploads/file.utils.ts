import { unlink } from 'fs/promises';
import { basename, join } from 'path';

const uploadsDir = join(process.cwd(), 'uploads');
const uploadsPrefix = '/uploads/';

export function isLocalUpload(url?: string | null): url is string {
  return Boolean(url && url.startsWith(uploadsPrefix));
}

export async function removeLocalUpload(url?: string | null) {
  if (!isLocalUpload(url)) return false;

  const filename = basename(url);
  if (!filename || filename === '.' || filename === '..') return false;

  await unlink(join(uploadsDir, filename)).catch(() => {});
  return true;
}

export async function removeLocalUploads(urls: Array<string | null | undefined>) {
  const unique = new Set<string>();

  for (const url of urls) {
    if (isLocalUpload(url)) unique.add(url);
  }

  await Promise.all(Array.from(unique).map(removeLocalUpload));
}
