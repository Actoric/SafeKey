import * as fs from 'fs';
import * as path from 'path';

const pkgPath = path.join(__dirname, '../../package.json');

function readRootVersion(): string {
  try {
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const j = JSON.parse(raw) as { version?: string };
    return typeof j.version === 'string' ? j.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readRootVersion();
