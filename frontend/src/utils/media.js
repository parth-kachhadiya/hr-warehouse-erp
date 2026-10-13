// Makes photo uploads faster: photos are shrunk in the browser before upload, and a few
// files are sent at the same time instead of one by one.

const MAX_SIDE = 1600; // longest side in pixels after shrinking
const QUALITY = 0.82; // JPEG quality (0 to 1)
const SKIP_BELOW_BYTES = 300 * 1024; // small photos are sent as they are

// Returns a smaller JPEG copy of the photo. If the browser can't read the photo (for
// example some HEIC files) or shrinking doesn't help, the original file is returned.
export async function shrinkPhoto(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < SKIP_BELOW_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNG areas become white instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Runs task(item) for every item, at most `limit` at a time.
// Returns one { ok, value } or { ok: false, error } per item, in the original order.
export async function runLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await task(items[i], i) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
