import assert from 'node:assert/strict';
import test from 'node:test';

import { describeConfig, runApp } from '../src/index.js';

test('启动配置摘要包含所有配置项', () => {
  assert.equal(describeConfig({
    meowNickname: 'tester',
    checkIntervalMs: 5000,
    healthCheckMs: 3600000,
    matchScope: 'all',
    keywords: ['VPS', '优惠'],
    keywordGroups: [['香港', 'VPS']],
    regexPatterns: [/年付/iu],
    pushCategory: new Set(['trade']),
    blockedKeywords: ['求购'],
    categories: new Set(['trade', 'daily']),
    pushExisting: false,
    showLinkUrl: false
  }), '版本 v2.0.0，MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 trade,daily，规则 4 条（关键词：VPS,优惠 | 组合词：香港+VPS | 正则：年付 | 版块匹配：trade），屏蔽词：求购，版块过滤：trade,daily，首次推送已有 否，显示链接 否，自检间隔 60 分钟');
});

test('启动时推送启动信息到 MeoW', async () => {
  const logs = [];
  const events = [];
  let startupOptions;
  const state = { async load() { events.push('state'); return true; } };
  const monitor = {
    async initialize() { events.push('monitor'); },
    async run() { events.push('run'); }
  };
  const pusher = {
    async pushHealthCheck(options) { startupOptions = options; events.push('startup'); }
  };

  await runApp({
    env: {
      MEOW_NICKNAME: 'tester',
      KEYWORDS: 'VPS'
    },
    stateFactory: () => state,
    monitorFactory: () => monitor,
    pusherFactory: () => pusher,
    fetchItems: async () => [],
    checkUpdateFn: async (logger) => { logger.info('当前已是最新版本 v2.0.0'); return null; },
    registerSignals: false,
    logger: {
      info(message) { logs.push(message); },
      warn() {},
      error() {}
    }
  });

  assert.deepEqual(events, ['startup', 'monitor', 'run']);
  assert.equal(startupOptions.rssOk, true);
  assert.equal(startupOptions.version, '2.0.0');
  assert.equal(startupOptions.updateInfo, null);
  assert.ok(startupOptions.configSummary.includes('版本 v2.0.0'));
  assert.ok(startupOptions.configSummary.includes('MeoW 昵称 tester'));
  assert.equal(logs[0], '启动配置：版本 v2.0.0，MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 all，规则 1 条（关键词：VPS），首次推送已有 否，显示链接 否，自检间隔 1440 分钟');
  assert.equal(logs[1], '自检 RSS 连接正常');
  assert.equal(logs[2], '当前已是最新版本 v2.0.0');
  assert.equal(logs[3], '启动信息已推送至 MeoW');
  assert.equal(logs[4], '监控已启动');
});

test('RSS 失败时仍推送启动信息', async () => {
  const events = [];
  const state = { async load() { return true; } };
  const monitor = {
    async initialize() {},
    async run() {}
  };
  const pusher = {
    async pushHealthCheck(options) { events.push(options); }
  };

  await runApp({
    env: {
      MEOW_NICKNAME: 'tester',
      KEYWORDS: 'VPS'
    },
    stateFactory: () => state,
    monitorFactory: () => monitor,
    pusherFactory: () => pusher,
    fetchItems: async () => { throw new Error('rss down'); },
    checkUpdateFn: async (logger) => { logger.info('当前已是最新版本 v2.0.0'); return null; },
    registerSignals: false,
    logger: {
      info() {},
      warn() {},
      error() {}
    }
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].rssOk, false);
  assert.ok(events[0].configSummary.includes('版本 v2.0.0'));
  assert.ok(events[0].configSummary.includes('MeoW 昵称 tester'));
});

test('启动时 MeoW 推送失败则拒绝启动', async () => {
  const monitor = {
    async initialize() { throw new Error('monitor should not start'); },
    async run() {}
  };
  const pusher = {
    async pushHealthCheck() { throw new Error('meow down'); }
  };

  await assert.rejects(() => runApp({
    env: {
      MEOW_NICKNAME: 'tester',
      KEYWORDS: 'VPS'
    },
    monitorFactory: () => monitor,
    pusherFactory: () => pusher,
    fetchItems: async () => [],
    checkUpdateFn: async (logger) => { logger.info('当前已是最新版本 v2.0.0'); return null; },
    registerSignals: false,
    logger: {
      info() {},
      warn() {},
      error() {}
    }
  }), /meow down/);
});
