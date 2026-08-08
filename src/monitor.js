import { setTimeout as delay } from 'node:timers/promises';
import { formatReason } from './meow.js';

function chronological(items) {
  return items
    .map((item, index) => ({
      item,
      index,
      time: Number.isNaN(Date.parse(item.pubDate)) ? Number.POSITIVE_INFINITY : Date.parse(item.pubDate)
    }))
    .sort((left, right) => left.time === right.time ? left.index - right.index : left.time - right.time)
    .map(({ item }) => item);
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
    const feedItems = chronological(await this.fetchItems());
    const pendingItems = this.state.pendingItems();
    const pendingIds = new Set(pendingItems.map((item) => item.id));
    const items = [...pendingItems, ...feedItems.filter((item) => !pendingIds.has(item.id))];
    const unseenCount = feedItems.filter((item) => !this.state.has(item.id) && !pendingIds.has(item.id)).length;
    if (this.#firstSuccessfulScan || unseenCount > 0) {
      this.logger.info(`RSS 获取成功，共 ${feedItems.length} 条，新增 ${unseenCount} 条`);
    }

    if (this.#firstSuccessfulScan && !this.config.pushExisting) {
      this.state.addMany(feedItems.map((item) => item.id));
      await this.state.save();
      this.#firstSuccessfulScan = false;
      this.logger.info(`首次扫描建立基线，共 ${feedItems.length} 条`);
      return;
    }

    const wasFirstSuccessfulScan = this.#firstSuccessfulScan;
    let changed = false;
    for (const item of items) {
      if (this.state.has(item.id)) continue;
      const result = this.matcher(item, this.config);
      if (!result.matched) {
        const removed = this.state.removePending(item.id);
        changed = this.state.add(item.id) || removed || changed;
        continue;
      }

      this.logger.info(`命中帖子 ${item.id}，命中规则：${formatReason(result.reason)}`);
      try {
        await this.pusher.push(item, result);
        const removed = this.state.removePending(item.id);
        changed = this.state.add(item.id) || removed || changed;
        this.logger.info(`推送成功 ${item.id}`);
      } catch (error) {
        changed = this.state.addPending(item) || changed;
        this.logger.error(`推送失败 ${item.id}，${error.message}`);
      }
    }

    if (changed || wasFirstSuccessfulScan) await this.state.save();
    this.#firstSuccessfulScan = false;
  }

  async run(signal) {
    let lastRssError = false;
    while (!signal.aborted) {
      try {
        await this.poll();
        if (lastRssError) {
          this.logger.info('RSS 连接已恢复');
          try {
            await this.pusher.pushRecovery();
            this.logger.info('RSS 恢复通知推送成功');
          } catch (pushError) {
            this.logger.error(`RSS 恢复通知推送失败，${pushError.message}`);
          }
          lastRssError = false;
        }
      } catch (error) {
        this.logger.error(error.message);
        if (!lastRssError) {
          try {
            await this.pusher.pushError(error.message);
            this.logger.info('RSS 异常通知推送成功');
          } catch (pushError) {
            this.logger.error(`RSS 异常通知推送失败，${pushError.message}`);
          }
          lastRssError = true;
        }
      }
      try {
        await delay(this.config.checkIntervalMs, undefined, { signal });
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
    }
  }
}
