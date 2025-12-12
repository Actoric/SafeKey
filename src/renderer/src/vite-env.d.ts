/// <reference types="vite/client" />

import { ElectronAPI } from '../../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI & {
      minimize?: () => Promise<void>;
      maximize?: () => Promise<void>;
      close?: () => Promise<void>;
    };
  }
}
