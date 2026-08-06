import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class StateStore {
  #ids = [];
  #set = new Set();

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
      this.#ids = [...new Set(parsed.processedIds)].slice(-this.limit);
      this.#set = new Set(this.#ids);
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

  async save() {
    const directory = path.dirname(this.filePath);
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify({ processedIds: this.#ids })}\n`, 'utf8');
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
