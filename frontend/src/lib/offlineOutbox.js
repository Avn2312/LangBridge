const DB_NAME = "langbridge-offline-outbox";
const DB_VERSION = 1;
const MESSAGE_STORE = "messages";

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = db.createObjectStore(MESSAGE_STORE, {
          keyPath: "clientMessageId",
        });
        store.createIndex("senderId", "senderId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async (mode, callback) => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MESSAGE_STORE, mode);
    const store = transaction.objectStore(MESSAGE_STORE);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

export const enqueueOfflineMessage = (message) =>
  withStore("readwrite", (store) =>
    store.put({
      ...message,
      status: "queued",
      queuedAt: message.queuedAt || new Date().toISOString(),
    }),
  );

export const removeOfflineMessage = (clientMessageId) =>
  withStore("readwrite", (store) => store.delete(clientMessageId));

export const listOfflineMessages = async (senderId) => {
  const messages = await withStore("readonly", (store) => store.getAll());
  return messages
    .filter((message) => !senderId || message.senderId === senderId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};
