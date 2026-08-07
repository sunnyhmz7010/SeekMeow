import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createMeowClient, formatMessage } from '../src/meow.js';
import { Monitor } from '../src/monitor.js';
import { StateStore } from '../src/state.js';

const sampleItem = {
  id: '1',
  title: '香港 VPS 补货',
  summary: '年付 100 元',
  link: 'https://www.nodeseek.com/post-1-1',
  category: 'trade',
  creator: 'alice',
  pubDate: 'Thu, 06 Aug 2026 13:09:07 GMT'
};

async function tempState(t, limit = 1000) {
  const directory = await mkdtemp(path.join(tmpdir(), 'nodeseek-meow-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, file: path.join(directory, 'state.json'), state: new StateStore(path.join(directory, 'state.json'), limit) };
}

test('状态可持久化且只保留最近 ID', async (t) => {
  const { file, state } = await tempState(t, 2);
  assert.equal(await state.load(), false);
  state.addMany(['1', '2', '3']);
  await state.save();
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    processedIds: ['2', '3'],
    pendingItems: []
  });

  const reloaded = new StateStore(file, 2);
  assert.equal(await reloaded.load(), true);
  assert.equal(reloaded.has('2'), true);
  assert.equal(reloaded.has('1'), false);
});

test('待重试帖子会随状态持久化', async (t) => {
  const { file, state } = await tempState(t);
  await state.load();
  assert.equal(state.addPending(sampleItem), true);
  await state.save();

  const reloaded = new StateStore(file);
  assert.equal(await reloaded.load(), true);
  assert.deepEqual(reloaded.pendingItems(), [sampleItem]);
  assert.equal(reloaded.removePending(sampleItem.id), true);
  assert.deepEqual(reloaded.pendingItems(), []);
});

test('损坏状态文件明确失败', async (t) => {
  const { file, state } = await tempState(t);
  await writeFile(file, '{invalid', 'utf8');
  await assert.rejects(() => state.load(), /状态文件/);
});

test('构造 MeoW 纯文本消息并 POST JSON', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ status: 200, message: '推送成功' }), { status: 200 });
  };
  const client = createMeowClient({ nickname: '测试 用户', fetchImpl });

  await client.push(sampleItem, { reason: 'keyword:VPS' });

  assert.equal(request.url, 'https://api.chuckfang.com/%E6%B5%8B%E8%AF%95%20%E7%94%A8%E6%88%B7/NodeSeek?msgType=text');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), {
    title: sampleItem.title,
    msg: formatMessage(sampleItem, { reason: 'keyword:VPS' }),
    url: sampleItem.link,
    imgUrl: 'https://nodeseek.cc/uploads/default/optimized/1X/47c7a8a16553966c7b7b52b85dda45bbceb42d1b_2_512x512.png'
  });
});

test('MeoW 消息正文使用中文版块、关键词和中文时间，摘要完整输出', () => {
  const message = formatMessage({
    ...sampleItem,
    summary: '第一行摘要\n第二行摘要，不截断',
    pubDate: 'Thu, 06 Aug 2026 13:09:07 GMT'
  }, { reason: 'group:香港+VPS' });

  assert.equal(message, [
    '📌 版块：交易',
    '👤 作者：alice',
    '🎯 关键词：香港 + VPS',
    '🕒 发布时间：2026年8月6日 21:09:07',
    '📝 摘要：第一行摘要\n第二行摘要，不截断'
  ].join('\n'));
});

test('MeoW 启动测试推送使用固定标题、链接和图标', async () => {
  let body;
  const fetchImpl = async (url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ status: 200, message: '推送成功' }), { status: 200 });
  };
  const client = createMeowClient({ nickname: 'tester', fetchImpl });

  await client.pushStartupTest();

  assert.deepEqual(body, {
    title: 'SeekMeow 启动测试',
    msg: 'SeekMeow 已启动，NodeSeek RSS 关键词监控正在运行。',
    url: 'https://www.nodeseek.com/',
    imgUrl: 'https://nodeseek.cc/uploads/default/optimized/1X/47c7a8a16553966c7b7b52b85dda45bbceb42d1b_2_512x512.png'
  });
});

test('MeoW HTTP、JSON 和业务失败均抛错', async () => {
  const cases = [
    async () => new Response('error', { status: 503 }),
    async () => new Response('not-json', { status: 200 }),
    async () => new Response(JSON.stringify({ status: 400, msg: '参数错误' }), { status: 200 })
  ];

  for (const fetchImpl of cases) {
    const client = createMeowClient({ nickname: 'tester', fetchImpl });
    await assert.rejects(() => client.push(sampleItem));
  }
});

function memoryState({ existed = false, ids = [] } = {}) {
  const seen = new Set(ids);
  const pending = new Map();
  return {
    saved: 0,
    async load() { return existed; },
    has(id) { return seen.has(id); },
    add(id) { const before = seen.size; seen.add(id); return seen.size !== before; },
    addMany(values) { return values.reduce((changed, id) => this.add(id) || changed, false); },
    pendingItems() { return [...pending.values()]; },
    addPending(item) { if (pending.has(item.id)) return false; pending.set(item.id, item); return true; },
    removePending(id) { return pending.delete(id); },
    async save() { this.saved += 1; },
    values() { return [...seen]; }
  };
}

const silentLogger = { info() {}, warn() {}, error() {} };
const monitorConfig = (overrides = {}) => ({
  checkIntervalMs: 5,
  pushExisting: false,
  matchScope: 'all',
  keywords: ['VPS'],
  keywordGroups: [],
  blockedKeywords: [],
  regexPatterns: [],
  categories: null,
  ...overrides
});

test('首次启动默认建立基线而不推送', async () => {
  const state = memoryState();
  const pushed = [];
  const monitor = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => [sampleItem],
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async (item) => pushed.push(item.id) },
    state,
    logger: silentLogger
  });

  await monitor.initialize();
  await monitor.poll();
  assert.deepEqual(pushed, []);
  assert.deepEqual(state.values(), ['1']);
  assert.equal(state.saved, 1);
});

test('PUSH_EXISTING=true 时首次扫描推送已有命中帖', async () => {
  const state = memoryState();
  const pushed = [];
  const monitor = new Monitor({
    config: monitorConfig({ pushExisting: true }),
    fetchItems: async () => [sampleItem],
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async (item) => pushed.push(item.id) },
    state,
    logger: silentLogger
  });

  await monitor.initialize();
  await monitor.poll();
  assert.deepEqual(pushed, ['1']);
  assert.deepEqual(state.values(), ['1']);
});

test('按旧到新处理，未命中去重，推送失败下轮重试', async () => {
  const old = { ...sampleItem, id: '1', pubDate: 'Thu, 06 Aug 2026 13:00:00 GMT' };
  const failed = { ...sampleItem, id: '2', pubDate: 'Thu, 06 Aug 2026 13:01:00 GMT' };
  const unmatched = { ...sampleItem, id: '3', pubDate: 'Thu, 06 Aug 2026 13:02:00 GMT' };
  const state = memoryState({ existed: true });
  const attempts = [];
  let failOnce = true;
  const monitor = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => [unmatched, failed, old],
    matcher: (item) => ({ matched: item.id !== '3', reason: item.id === '3' ? 'no-match' : 'keyword:VPS' }),
    pusher: { async push(item, match) { attempts.push([item.id, match.reason]); if (item.id === '2' && failOnce) { failOnce = false; throw new Error('temporary'); } } },
    state,
    logger: silentLogger
  });

  await monitor.initialize();
  await monitor.poll();
  assert.deepEqual(attempts, [['1', 'keyword:VPS'], ['2', 'keyword:VPS']]);
  assert.deepEqual(state.values(), ['1', '3']);
  await monitor.poll();
  assert.deepEqual(attempts, [['1', 'keyword:VPS'], ['2', 'keyword:VPS'], ['2', 'keyword:VPS']]);
  assert.deepEqual(state.values(), ['1', '3', '2']);
});

test('RSS 获取失败时不推进状态', async () => {
  const state = memoryState({ existed: true });
  const monitor = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => { throw new Error('rss down'); },
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async () => {} },
    state,
    logger: silentLogger
  });

  await monitor.initialize();
  await assert.rejects(() => monitor.poll(), /rss down/);
  assert.deepEqual(state.values(), []);
  assert.equal(state.saved, 0);
});

test('推送失败后帖子移出 RSS 并重启仍会重试', async (t) => {
  const { file, state } = await tempState(t);
  await state.load();
  await state.save();
  const first = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => [sampleItem],
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async () => { throw new Error('meow down'); } },
    state,
    logger: silentLogger
  });
  await first.initialize();
  await first.poll();

  const reloaded = new StateStore(file);
  const pushed = [];
  const second = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => [],
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async (item) => pushed.push(item.id) },
    state: reloaded,
    logger: silentLogger
  });
  await second.initialize();
  await second.poll();

  assert.deepEqual(pushed, ['1']);
  assert.equal(reloaded.has('1'), true);
  assert.deepEqual(reloaded.pendingItems(), []);
});

test('有效发布时间先于无效发布时间处理', async () => {
  const state = memoryState({ existed: true });
  const attempts = [];
  const valid = { ...sampleItem, id: 'valid', pubDate: 'Thu, 06 Aug 2026 13:00:00 GMT' };
  const invalid = { ...sampleItem, id: 'invalid', pubDate: '' };
  const monitor = new Monitor({
    config: monitorConfig(),
    fetchItems: async () => [invalid, valid],
    matcher: () => ({ matched: true, reason: 'keyword:VPS' }),
    pusher: { push: async (item) => attempts.push(item.id) },
    state,
    logger: silentLogger
  });

  await monitor.initialize();
  await monitor.poll();
  assert.deepEqual(attempts, ['valid', 'invalid']);
});
