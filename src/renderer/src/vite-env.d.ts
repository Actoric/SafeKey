/// <reference types="vite/client" />

import { ElectronAPI } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
