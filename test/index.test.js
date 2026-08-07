import assert from 'node:assert/strict';
import test from 'node:test';

import { describeConfig, runApp } from '../src/index.js';

test('启动配置摘要包含昵称、轮询间隔、匹配范围、版块和规则数量', () => {
  assert.equal(describeConfig({
    meowNickname: 'tester',
    checkIntervalMs: 5000,
    matchScope: 'all',
    keywords: ['VPS', '优惠'],
    keywordGroups: [['香港', 'VPS']],
    regexPatterns: [/年付/iu],
    categories: new Set(['trade', 'daily'])
  }), 'MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 trade,daily，规则 4 条');
});

test('启动时先记录配置并发送 MeoW 测试推送', async () => {
  const logs = [];
  const events = [];
  const state = { async load() { events.push('state'); return true; } };
  const monitor = {
    async initialize() { events.push('monitor'); },
    async run() { events.push('run'); }
  };
  const pusher = {
    async pushStartupTest() { events.push('test-push'); }
  };

  await runApp({
    env: {
      MEOW_NICKNAME: 'tester',
      KEYWORDS: 'VPS'
    },
    stateFactory: () => state,
    monitorFactory: () => monitor,
    pusherFactory: () => pusher,
    logger: {
      info(message) { logs.push(message); },
      warn() {},
      error() {}
    }
  });

  assert.deepEqual(events, ['test-push', 'monitor', 'run']);
  assert.equal(logs[0], '启动配置：MeoW 昵称 tester，轮询间隔 5 秒，匹配范围 all，监控版块 all，规则 1 条');
  assert.equal(logs[1], 'MeoW 启动测试推送成功');
  assert.equal(logs[2], '监控已启动');
});
