import * as fs from 'fs';
import * as path from 'path';
import { HistoryItem } from './types.js';

const SESSION_FILE = '.neurogent-session.json';

interface SavedSession {
  savedAt: string;
  history: HistoryItem[];
}

export function saveSession(history: HistoryItem[]): void {
  if (history.length === 0) return;
  try {
    const data: SavedSession = { savedAt: new Date().toISOString(), history: history.slice(-50) };
    fs.writeFileSync(path.resolve(process.cwd(), SESSION_FILE), JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* silently fail */ }
}

export function loadSession(): HistoryItem[] {
  try {
    const filePath = path.resolve(process.cwd(), SESSION_FILE);
    if (!fs.existsSync(filePath)) return [];
    const data: SavedSession = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.history ?? [];
  } catch {
    return [];
  }
}

export function clearSession(): void {
  try {
    const filePath = path.resolve(process.cwd(), SESSION_FILE);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* silently fail */ }
}
