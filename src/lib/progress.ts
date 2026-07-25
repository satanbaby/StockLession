/**
 * 學習進度。
 *
 * 存在 localStorage，不做帳號、不上傳 —— 這是一個純靜態教學網站，
 * 為了記住「讀到第幾課」而要求註冊是本末倒置。
 * 換裝置就重來，這個取捨可以接受。
 */

const KEY = 'sanxiong:completed';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    // 無痕模式或資料損毀，當作沒有進度
    return new Set();
  }
}

function write(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* 寫不進去就算了，不該因為記不住進度而讓頁面壞掉 */
  }
}

export const completed = (): Set<string> => read();

export const isDone = (id: string): boolean => read().has(id);

export function setDone(id: string, done: boolean): Set<string> {
  const set = read();
  if (done) set.add(id);
  else set.delete(id);
  write(set);
  document.dispatchEvent(new CustomEvent('progress:change', { detail: { id, done } }));
  return set;
}

export function toggle(id: string): boolean {
  const next = !isDone(id);
  setDone(id, next);
  return next;
}

export function clearAll(): void {
  write(new Set());
  document.dispatchEvent(new CustomEvent('progress:change', { detail: { id: null, done: false } }));
}
