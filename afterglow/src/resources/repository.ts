import type { ResourcePackage } from "./types";
let pending: Promise<IDBDatabase> | undefined;
function database() {
  return pending ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("afterglow-resources", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("packages", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("资源存储被其他页面占用"));
  });
}
export async function loadPackages(): Promise<ResourcePackage[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("packages").objectStore("packages").getAll();
    request.onsuccess = () => resolve(request.result.sort((a: ResourcePackage, b: ResourcePackage) => a.importedAt - b.importedAt));
    request.onerror = () => reject(request.error);
  });
}
export async function savePackage(pkg: ResourcePackage | string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("packages", "readwrite");
    const store = transaction.objectStore("packages");
    if (typeof pkg === "string") store.delete(pkg); else store.put(pkg);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
