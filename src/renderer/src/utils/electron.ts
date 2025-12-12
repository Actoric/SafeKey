// Утилиты для работы с Electron API

import { ElectronAPI } from '../../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const electronAPI = window.electronAPI;
