import assert from 'node:assert/strict';
import test from 'node:test';

import { describeConfig, describeRules, runApp } from '../src/index.js';

test('启动配置摘要包含昵称、轮询间隔、匹配范围、版块、规则数量和自检间隔', () => {
  assert.equal(describeConfig({
    meowNickname: 'tester',
    checkIntervalMs: 5000,
    healthCheckMs: 3600000,
    matchScope: 'all',
    keywords: ['VPS', '优惠'],
    keywordGroups: [['香港', 'VPS']],
    regexPatterns: [/年付/iu],
    categories: new Set(['trade', 'daily'])
  }), 'MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 trade,daily，规则 4 条，自检间隔 60 分钟');
});

test('生效规则日志列出全部匹配条件', () => {
  assert.equal(describeRules({
    keywords: ['VPS', '优惠'],
    keywordGroups: [['香港', 'VPS']],
    regexPatterns: [/年付/iu],
    pushCategory: new Set(['trade']),
    blockedKeywords: ['求购'],
    categories: new Set(['trade', 'daily'])
  }), '关键词：VPS, 优惠 | 组合词：香港 + VPS | 正则：年付 | 版块匹配：trade | 屏蔽词：求购 | 版块过滤：trade, daily');
});

test('启动时自检 RSS 连接并推送自检通知', async () => {
  const logs = [];
  const events = [];
  const state = { async load() { events.push('state'); return true; } };
  const monitor = {
    async initialize() { events.push('monitor'); },
    async run() { events.push('run'); }
  };
  const pusher = {
    async pushHealthCheck() { events.push('health-check'); }
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
    registerSignals: false,
    logger: {
      info(message) { logs.push(message); },
      warn() {},
      error() {}
    }
  });

  assert.deepEqual(events, ['health-check', 'monitor', 'run']);
  assert.equal(logs[0], '启动配置：MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 all，规则 1 条，自检间隔 60 分钟');
  assert.equal(logs[1], '生效规则：关键词：VPS');
  assert.equal(logs[2], 'RSS 连接正常');
  assert.equal(logs[3], '自检推送成功');
  assert.equal(logs[4], '监控已启动');
});
