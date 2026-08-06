import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ITEM_FIELDS = ['id', 'title', 'summary', 'link', 'category', 'creator', 'pubDate'];

function normalizePendingItem(item) {
  if (!item || ITEM_FIELDS.some((field) => typeof item[field] !== 'string')) {
    throw new Error('pendingItems 格式无效');
  }
  return Object.fromEntries(ITEM_FIELDS.map((field) => [field, item[field]]));
}

export class StateStore {
  #ids = [];
  #set = new Set();
  #pending = [];
  #pendingById = new Map();

  constructor(filePath, limit = 1000) {
    this.filePath = filePath;
    this.limit = limit;
  }

  async load() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw new Error(`状态文件读取失败: ${error.message}`);
    }

    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.processedIds) || parsed.processedIds.some((id) => typeof id !== 'string')) {
        throw new Error('processedIds 格式无效');
      }
      const pendingItems = parsed.pendingItems ?? [];
      if (!Array.isArray(pendingItems)) throw new Error('pendingItems 格式无效');
      this.#ids = [...new Set(parsed.processedIds)].slice(-this.limit);
      this.#set = new Set(this.#ids);
      this.#pending = pendingItems
        .map(normalizePendingItem)
        .filter((item) => !this.#set.has(item.id))
        .slice(-this.limit);
      this.#pendingById = new Map(this.#pending.map((item) => [item.id, item]));
      return true;
    } catch (error) {
      throw new Error(`状态文件格式错误: ${error.message}`);
    }
  }

  has(id) {
    return this.#set.has(id);
  }

  add(id) {
    if (this.#set.has(id)) return false;
    this.removePending(id);
    this.#ids.push(id);
    this.#set.add(id);
    while (this.#ids.length > this.limit) {
      this.#set.delete(this.#ids.shift());
    }
    return true;
  }

  addMany(ids) {
    return ids.reduce((changed, id) => this.add(id) || changed, false);
  }

  pendingItems() {
    return this.#pending.map((item) => ({ ...item }));
  }

  addPending(item) {
    if (this.#set.has(item.id) || this.#pendingById.has(item.id)) return false;
    const normalized = normalizePendingItem(item);
    this.#pending.push(normalized);
    this.#pendingById.set(normalized.id, normalized);
    while (this.#pending.length > this.limit) {
      this.#pendingById.delete(this.#pending.shift().id);
    }
    return true;
  }

  removePending(id) {
    if (!this.#pendingById.delete(id)) return false;
    const index = this.#pending.findIndex((item) => item.id === id);
    if (index >= 0) this.#pending.splice(index, 1);
    return true;
  }

  async save() {
    const directory = path.dirname(this.filePath);
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify({
        processedIds: this.#ids,
        pendingItems: this.#pending
      })}\n`, 'utf8');
      try {
        await rename(temporary, this.filePath);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
        await rm(this.filePath, { force: true });
        await rename(temporary, this.filePath);
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
