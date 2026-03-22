/**
 * Клиент Яндекс.Диска для браузера/мобильного приложения (fetch).
 * Совместим с тем же файлом safekey_backup.dat, что и десктоп.
 */

const CLIENT_ID = 'd0370b9cde634c51b74492b338fd1250';
const CLIENT_SECRET = 'fd0386685ca64690be1d14817561d7b3';
const REDIRECT_URI_DESKTOP = 'https://oauth.yandex.ru/verification_code';
/** Для мобильного приложения: добавьте этот URL в настройки OAuth приложения Яндекса как допустимый redirect_uri. */
const REDIRECT_URI_MOBILE = 'com.safekey.app://oauth';
const BASE_PATH = 'SafeKey';
const BACKUP_FILENAME = 'safekey_backup.dat';

function normalizePath(p: string): string {
  let s = (p || BASE_PATH).trim();
  if (s.startsWith('/')) s = s.substring(1);
  return s || BASE_PATH;
}

export function getYandexAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI_DESKTOP,
  });
  return `https://oauth.yandex.ru/authorize?${params.toString()}`;
}

/** URL для мобильного приложения (custom scheme, чтобы после авторизации открылось наше приложение). */
export function getYandexAuthUrlMobile(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI_MOBILE,
  });
  return `https://oauth.yandex.ru/authorize?${params.toString()}`;
}

export async function exchangeYandexCodeForToken(code: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

async function getDownloadLink(token: string, path: string): Promise<string | null> {
  const url = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.href || null;
}

/** Скачать файл с Яндекс.Диска. Возвращает текст (encrypted backup — UTF-8). */
export async function downloadYandexBackup(token: string, basePath?: string): Promise<string | null> {
  const path = normalizePath(basePath ?? BASE_PATH);
  const remotePath = `disk:/${path}/${BACKUP_FILENAME}`;
  const href = await getDownloadLink(token, remotePath);
  if (!href) return null;
  const res = await fetch(href);
  if (!res.ok) return null;
  return res.text();
}

/** Загрузить файл на Яндекс.Диск (тело — строка, UTF-8). */
export async function uploadYandexBackup(token: string, content: string, basePath?: string): Promise<boolean> {
  const path = normalizePath(basePath ?? BASE_PATH);
  const remotePath = `disk:/${path}/${BACKUP_FILENAME}`;
  const url = `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(remotePath)}&overwrite=true`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `OAuth ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  const uploadHref = data.href;
  if (!uploadHref) return false;
  const putRes = await fetch(uploadHref, {
    method: 'PUT',
    body: content,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
  return putRes.ok;
}

export async function listYandexFiles(token: string, basePath?: string): Promise<string[]> {
  const path = normalizePath(basePath ?? BASE_PATH);
  const searchPath = `disk:/${path}`;
  const url = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(searchPath)}&limit=100`;
  const res = await fetch(url, { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data._embedded?.items) return [];
  return data._embedded.items
    .filter((item: { type: string }) => item.type === 'file')
    .map((item: { name: string }) => item.name);
}

/** Скачать ключевой файл (salt + keyHash) для проверки пароля на мобильном. */
export async function downloadYandexKeyFile(token: string, basePath?: string): Promise<{ salt: string; keyHash: string } | null> {
  const path = normalizePath(basePath ?? BASE_PATH);
  const remotePath = `disk:/${path}/safekey_key.json`;
  const href = await getDownloadLink(token, remotePath);
  if (!href) return null;
  const res = await fetch(href);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.salt && data.keyHash) return { salt: data.salt, keyHash: data.keyHash };
  return null;
}

export { BACKUP_FILENAME };
