/* global jest */
/**
 * In-memory stand-ins for the scanning modules (document scanner, text recognition, image
 * picker and manipulator, file system) and Firebase Storage, so the scan flow runs in Jest.
 */

// ---- Firebase Storage: uploaded files by path, with a switch to fail the next uploads.
const uploads = new Map();
const storageState = { failNext: 0, putCalls: [], failDeletes: 0, deleteCalls: [] };

const fakeStorage = {
  getStorage: () => ({}),
  connectStorageEmulator: jest.fn(),
  ref: (_storage, path) => ({ fullPath: path }),
  putFile: jest.fn((ref, filePath, metadata) => {
    storageState.putCalls.push(ref.fullPath);
    if (storageState.failNext > 0) {
      storageState.failNext -= 1;
      return Promise.reject(new Error('storage/retry-limit-exceeded'));
    }
    uploads.set(ref.fullPath, { filePath, metadata });
    return Promise.resolve({ state: 'success' });
  }),
  deleteObject: jest.fn(async (ref) => {
    storageState.deleteCalls.push(ref.fullPath);
    if (storageState.failDeletes > 0) {
      storageState.failDeletes -= 1;
      throw Object.assign(new Error('retry limit'), { code: 'storage/retry-limit-exceeded' });
    }
    if (!uploads.has(ref.fullPath)) {
      throw Object.assign(new Error('not found'), { code: 'storage/object-not-found' });
    }
    uploads.delete(ref.fullPath);
  }),
  getDownloadURL: jest.fn(async (ref) => {
    if (!uploads.has(ref.fullPath)) throw new Error('storage/object-not-found');
    return `https://storage.test/${ref.fullPath}`;
  }),
};

function resetStorage() {
  uploads.clear();
  storageState.failNext = 0;
  storageState.putCalls.length = 0;
  storageState.failDeletes = 0;
  storageState.deleteCalls.length = 0;
}

// ---- expo-file-system: a set of existing file URIs.
const files = new Set();
const join = (...parts) =>
  parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .join('/')
    .replace(/([^:/])\/{2,}/g, '$1/');

class Directory {
  constructor(...parts) {
    this.uri = join(...parts);
  }
  get exists() {
    return true;
  }
  get name() {
    return this.uri.split('/').pop();
  }
  create() {}
  list() {
    return [];
  }
  delete() {}
}
/** Text written to fake files (export tests read it back). */
const written = new Map();
class File {
  constructor(...parts) {
    this.uri = join(...parts);
  }
  get exists() {
    return files.has(this.uri);
  }
  delete() {
    files.delete(this.uri);
  }
  create() {
    files.add(this.uri);
  }
  async write(content) {
    files.add(this.uri);
    written.set(this.uri, content);
  }
  async base64() {
    return 'QUJD';
  }
  // Like the native module, move finishes later (it returns a promise).
  async move(target) {
    for (let i = 0; i < 5; i++) await Promise.resolve();
    files.delete(this.uri);
    files.add(target.uri);
    this.uri = target.uri;
  }
}
const fakeFileSystem = {
  Directory,
  File,
  Paths: { document: new Directory('file:///docs'), cache: new Directory('file:///cache') },
};

// ---- expo-image-manipulator: "renders" any image as 3000 x 4000 and saves it to the cache.
let saved = 0;
const manipulated = { resizes: [], saves: [] };
const fakeImageManipulator = {
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: (uri) => {
      const ctx = {
        resize: (size) => {
          manipulated.resizes.push(size);
          return ctx;
        },
        renderAsync: async () => ({
          width: 3000,
          height: 4000,
          saveAsync: async (options) => {
            manipulated.saves.push(options);
            const out = `file:///cache/manipulated-${++saved}.jpg`;
            files.add(out);
            return { uri: out, width: 1500, height: 2000 };
          },
        }),
      };
      return ctx;
    },
  },
};

// ---- Text recognition (modules/receipt-text): returns whatever lines the test sets.
const ocr = { lines: [], fail: false };
const fakeTextRecognition = {
  recognizeText: jest.fn(async () => {
    if (ocr.fail) throw new Error('ocr failed');
    return ocr.lines;
  }),
};

/** One recognised line per text line, stacked top to bottom. */
function setOcrText(text) {
  ocr.lines = text.split('\n').map((line, i) => ({
    text: line,
    frame: { left: 0, top: i * 20, right: 200, bottom: i * 20 + 16 },
  }));
}

// ---- Document scanner and image picker.
const fakeDocumentScanner = {
  __esModule: true,
  default: { scanDocument: jest.fn(async () => ({ status: 'cancel' })) },
  ResponseType: { Base64: 'base64', ImageFilePath: 'imageFilePath' },
  ScanDocumentResponseStatus: { Success: 'success', Cancel: 'cancel' },
};

const fakeImagePicker = {
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
};

function resetScan() {
  resetStorage();
  files.clear();
  manipulated.resizes.length = 0;
  manipulated.saves.length = 0;
  ocr.lines = [];
  ocr.fail = false;
  fakeDocumentScanner.default.scanDocument.mockReset();
  fakeDocumentScanner.default.scanDocument.mockImplementation(async () => ({ status: 'cancel' }));
  fakeImagePicker.getCameraPermissionsAsync.mockReset();
  fakeImagePicker.getCameraPermissionsAsync.mockImplementation(async () => ({
    granted: true,
    canAskAgain: true,
  }));
  fakeImagePicker.requestCameraPermissionsAsync.mockReset();
  fakeImagePicker.requestCameraPermissionsAsync.mockImplementation(async () => ({
    granted: true,
    canAskAgain: true,
  }));
  fakeImagePicker.launchImageLibraryAsync.mockReset();
  fakeImagePicker.launchImageLibraryAsync.mockImplementation(async () => ({
    canceled: true,
    assets: null,
  }));
  fakeImagePicker.launchCameraAsync.mockReset();
  fakeImagePicker.launchCameraAsync.mockImplementation(async () => ({
    canceled: true,
    assets: null,
  }));
}

module.exports = {
  writtenFiles: written,
  fakeStorage,
  storageState,
  uploads,
  fakeFileSystem,
  files,
  fakeImageManipulator,
  manipulated,
  fakeTextRecognition,
  ocr,
  setOcrText,
  fakeDocumentScanner,
  fakeImagePicker,
  resetScan,
};
