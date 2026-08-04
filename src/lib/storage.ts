import { get, set, del, keys } from 'idb-keyval';

export async function setItem(key: string, value: any): Promise<void> {
  try {
    await set(key, value);
  } catch (err) {
    console.error(`Failed to set ${key} in IndexedDB:`, err);
    // Fallback to localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalStorage fallback failed', e);
    }
  }
}

export async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await get(key);
    if (val !== undefined) return val as T;
  } catch (err) {
    console.error(`Failed to get ${key} from IndexedDB:`, err);
  }
  // Fallback to localStorage
  try {
    const localVal = localStorage.getItem(key);
    if (localVal !== null) {
      return JSON.parse(localVal) as T;
    }
  } catch (e) {
    console.error('LocalStorage parsing failed', e);
  }
  return defaultValue;
}

export async function removeItem(key: string): Promise<void> {
  try {
    await del(key);
  } catch (err) {
    console.error(`Failed to remove ${key} from IndexedDB:`, err);
  }
  localStorage.removeItem(key);
}

export async function clearAll(): Promise<void> {
  try {
    const allKeys = await keys();
    await Promise.all(allKeys.map((key) => del(key)));
  } catch (err) {
    console.error('Failed to clear IndexedDB:', err);
  }
  localStorage.clear();
}
