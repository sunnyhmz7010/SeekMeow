import assert from 'node:assert/strict';
import test from 'node:test';

import { matchItem } from '../src/matcher.js';

const item = {
  id: '1',
  title: '香港 VPS 补货',
  summary: '年付 100 元，支持退款',
  link: 'https://www.nodeseek.com/post-1-1',
  category: 'trade',
  creator: 'alice',
  pubDate: 'Thu, 06 Aug 2026 13:09:07 GMT'
};

function config(overrides = {}) {
  return {
    matchScope: 'all',
    keywords: [],
    keywordGroups: [],
    blockedKeywords: [],
    regexPatterns: [],
    categories: null,
    ...overrides
  };
}

test('title、summary 和 all 仅使用对应范围', () => {
  assert.equal(matchItem(item, config({ matchScope: 'title', keywords: ['VPS'] })).matched, true);
  assert.equal(matchItem(item, config({ matchScope: 'title', keywords: ['退款'] })).matched, false);
  assert.equal(matchItem(item, config({ matchScope: 'summary', keywords: ['退款'] })).matched, true);
  assert.equal(matchItem(item, config({ matchScope: 'summary', keywords: ['VPS'] })).matched, false);
  assert.equal(matchItem(item, config({ matchScope: 'all', keywords: ['退款'] })).matched, true);
});

test('普通关键词任意命中且忽略英文大小写', () => {
  assert.deepEqual(
    matchItem(item, config({ keywords: ['日本', 'vps'] })),
    { matched: true, reason: 'keyword:vps' }
  );
});

test('组合规则要求同组全部关键词命中', () => {
  assert.equal(matchItem(item, config({ keywordGroups: [['香港', 'VPS']] })).matched, true);
  assert.equal(matchItem(item, config({ keywordGroups: [['香港', '日本']] })).matched, false);
});

test('任意正则命中即可', () => {
  assert.deepEqual(
    matchItem(item, config({ regexPatterns: [/年付\s*100/iu] })),
    { matched: true, reason: 'regex:年付\\s*100' }
  );
});

test('屏蔽词优先于所有正向规则', () => {
  assert.deepEqual(
    matchItem(item, config({ keywords: ['VPS'], blockedKeywords: ['退款'] })),
    { matched: false, reason: 'blocked:退款' }
  );
});

test('版块不匹配时直接排除', () => {
  assert.deepEqual(
    matchItem(item, config({ keywords: ['VPS'], categories: new Set(['daily']) })),
    { matched: false, reason: 'category' }
  );
});

test('PUSH_CATEGORY 命中时跳过关键词直接推送', () => {
  assert.deepEqual(
    matchItem(item, config({ pushCategory: new Set(['trade']) })),
    { matched: true, reason: 'category-push:trade' }
  );
  assert.deepEqual(
    matchItem(item, config({ pushCategory: 'all' })),
    { matched: true, reason: 'category-push:trade' }
  );
  assert.deepEqual(
    matchItem(item, config({ pushCategory: new Set(['trade', 'daily']) })),
    { matched: true, reason: 'category-push:trade' }
  );
  assert.deepEqual(
    matchItem(item, config({ pushCategory: new Set(['daily']) })),
    { matched: false, reason: 'category-mismatch' }
  );
});

test('PUSH_CATEGORY 模式下屏蔽词仍然优先', () => {
  assert.deepEqual(
    matchItem(item, config({ pushCategory: new Set(['trade']), blockedKeywords: ['VPS'] })),
    { matched: false, reason: 'blocked:VPS' }
  );
});
