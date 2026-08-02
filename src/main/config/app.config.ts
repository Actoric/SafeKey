import { APP_VERSION } from '../version-info';

export const APP_CONFIG = {
  name: 'SafeKey',
  version: APP_VERSION,
  database: {
    name: 'safekey.db',
  },
  encryption: {
    algorithm: 'AES',
    keySize: 256,
    ivSize: 128 / 8,
    pbkdf2Iterations: 10000,
  },
  shortcuts: {
    overlay: 'CommandOrControl+Shift+P',
  },
  window: {
    main: {
      width: 1280,
      height: 800,
      minWidth: 1280,
      minHeight: 800,
      maxWidth: 1280,
      maxHeight: 800,
    },
    overlay: {
      width: 600,
      height: 500,
    },
  },
};
