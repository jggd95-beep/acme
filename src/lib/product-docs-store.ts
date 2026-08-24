/**
 * Local spec sheets (and later brochure / install) stored in this browser.
 * Files live in IndexedDB so they don't blow up the quote store.
 */
export type ProductDocKind = "spec" | "brochure" | "install";

export type StoredProductDoc = {
  productId: string;
  kind: ProductDocKind;
  name: string;
  mime: string;
  dataUrl: string;
  uploadedAt: string;
};

const DB_NAME = "aarvaks_product_docs_v1";
const STORE = "docs";
const INDEX_KEY = "aarvaks_product_docs_index_v1";
const MAX_BYTES = 4 * 1024 * 1024;

function docKey(productId: string, kind: ProductDocKind): string {
  return `${productId}::${kind}`;
}

export function readDocIndex(): Record<string, Partial<Record<ProductDocKind, string>>> {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      Partial<Record<ProductDocKind, string>>
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDocIndex(
  index: Record<string, Partial<Record<ProductDocKind, string>>>,
) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* quota */
  }
}

export function hasLocalProductDoc(
  productId: string,
  kind: ProductDocKind,
): boolean {
  return Boolean(readDocIndex()[productId]?.[kind]);
}

export function localProductDocName(
  productId: string,
  kind: ProductDocKind,
): string {
  return readDocIndex()[productId]?.[kind] || "";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("No IndexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getProductDoc(
  productId: string,
  kind: ProductDocKind,
): Promise<StoredProductDoc | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(docKey(productId, kind));
      req.onsuccess = () => resolve((req.result as StoredProductDoc) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveProductDoc(
  doc: StoredProductDoc,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(doc, docKey(doc.productId, doc.kind));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const index = readDocIndex();
    index[doc.productId] = { ...index[doc.productId], [doc.kind]: doc.name };
    writeDocIndex(index);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save file",
    };
  }
}

export async function removeProductDoc(
  productId: string,
  kind: ProductDocKind,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(docKey(productId, kind));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
  const index = readDocIndex();
  if (index[productId]) {
    delete index[productId][kind];
    if (!Object.keys(index[productId]).length) delete index[productId];
    writeDocIndex(index);
  }
}

export function fileToProductDoc(
  file: File,
  productId: string,
  kind: ProductDocKind,
): Promise<{ ok: true; doc: StoredProductDoc } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES) {
    return Promise.resolve({
      ok: false,
      error: "Keep spec sheets under 4 MB",
    });
  }
  const okType =
    file.type === "application/pdf" ||
    file.type.startsWith("image/") ||
    /\.pdf$/i.test(file.name);
  if (!okType) {
    return Promise.resolve({
      ok: false,
      error: "Use a PDF or image",
    });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:")) {
        resolve({ ok: false, error: "Could not read file" });
        return;
      }
      resolve({
        ok: true,
        doc: {
          productId,
          kind,
          name: file.name,
          mime: file.type || "application/pdf",
          dataUrl,
          uploadedAt: new Date().toISOString(),
        },
      });
    };
    reader.onerror = () => resolve({ ok: false, error: "Could not read file" });
    reader.readAsDataURL(file);
  });
}

export async function openLocalProductDoc(
  productId: string,
  kind: ProductDocKind,
): Promise<boolean> {
  const doc = await getProductDoc(productId, kind);
  if (!doc?.dataUrl) return false;
  window.open(doc.dataUrl, "_blank", "noopener,noreferrer");
  return true;
}
