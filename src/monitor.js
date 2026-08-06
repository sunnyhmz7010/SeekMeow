import { setTimeout as delay } from 'node:timers/promises';

function chronological(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.pubDate);
    const rightTime = Date.parse(right.pubDate);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
    return leftTime - rightTime;
  });
}

export class Monitor {
  #firstSuccessfulScan = false;

  constructor({ config, fetchItems, matcher, pusher, state, logger = console }) {
    this.config = config;
    this.fetchItems = fetchItems;
    this.matcher = matcher;
    this.pusher = pusher;
    this.state = state;
    this.logger = logger;
  }

  async initialize() {
    this.#firstSuccessfulScan = !(await this.state.load());
  }

  async poll() {
    const items = chronological(await this.fetchItems());
    const unseenCount = items.filter((item) => !this.state.has(item.id)).length;
    if (this.#firstSuccessfulScan || unseenCount > 0) {
      this.logger.info(`RSS 获取成功，共 ${items.length} 条，新增 ${unseenCount} 条`);
    }

    if (this.#firstSuccessfulScan && !this.config.pushExisting) {
      this.state.addMany(items.map((item) => item.id));
      await this.state.save();
      this.#firstSuccessfulScan = false;
      this.logger.info(`首次扫描建立基线，共 ${items.length} 条`);
      return;
    }

    const wasFirstSuccessfulScan = this.#firstSuccessfulScan;
    let changed = false;
    for (const item of items) {
      if (this.state.has(item.id)) continue;
      const result = this.matcher(item, this.config);
      if (!result.matched) {
        changed = this.state.add(item.id) || changed;
        continue;
      }

      this.logger.info(`命中帖子 ${item.id}: ${result.reason}`);
      try {
        await this.pusher.push(item);
        changed = this.state.add(item.id) || changed;
        this.logger.info(`推送成功 ${item.id}`);
      } catch (error) {
        this.logger.error(`推送失败 ${item.id}: ${error.message}`);
      }
    }

    if (changed || wasFirstSuccessfulScan) await this.state.save();
    this.#firstSuccessfulScan = false;
  }

  async run(signal) {
    while (!signal.aborted) {
      try {
        await this.poll();
      } catch (error) {
        this.logger.error(`轮询失败: ${error.message}`);
      }
      try {
        await delay(this.config.checkIntervalMs, undefined, { signal });
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
  }
}
