// Конфигурация приложения

export const APP_CONFIG = {
  name: 'SafeKey',
  version: '1.0.0',
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
      width: 1000,
      height: 650,
      minWidth: 1000,
      minHeight: 650,
      maxWidth: 1000,
      maxHeight: 650,
    },
    overlay: {
      width: 600,
      height: 500,
    },
  },
};
