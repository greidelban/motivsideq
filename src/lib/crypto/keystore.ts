// La chiave dati sul dispositivo: un archivio IndexedDB a parte, una voce per
// account. Non va mai nel cloud né nelle copie di sicurezza; si toglie con
// "esci e togli i dati da questo dispositivo".
// (Nell'app per iPhone potrà passare al Portachiavi.)

const DB_NAME = "getcontrol-keys";
const STORE = "keys";

type Entry = { dataKey: Uint8Array<ArrayBuffer> };

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(factory: IDBFactory, mode: IDBTransactionMode, task: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open(factory);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = task(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const defaultFactory = () => globalThis.indexedDB;

export async function loadDeviceKey(userId: string, factory: IDBFactory = defaultFactory()): Promise<Uint8Array<ArrayBuffer> | null> {
  const entry = (await run(factory, "readonly", (s) => s.get(userId))) as Entry | undefined;
  return entry?.dataKey instanceof Uint8Array ? new Uint8Array(entry.dataKey) : null;
}

export async function saveDeviceKey(userId: string, dataKey: Uint8Array<ArrayBuffer>, factory: IDBFactory = defaultFactory()): Promise<void> {
  await run(factory, "readwrite", (s) => s.put({ dataKey } satisfies Entry, userId));
}

export async function forgetDeviceKey(userId: string, factory: IDBFactory = defaultFactory()): Promise<void> {
  await run(factory, "readwrite", (s) => s.delete(userId));
}
