import assert from 'node:assert/strict';
import test from 'node:test';

import { CATEGORY_SLUGS, parseConfig } from '../src/config.js';

const requiredEnv = {
  MEOW_NICKNAME: 'tester',
  KEYWORDS: 'VPS'
};

test('配置使用约定默认值', () => {
  const config = parseConfig(requiredEnv);

  assert.equal(config.meowNickname, 'tester');
  assert.equal(config.checkIntervalMs, 5000);
  assert.equal(config.matchScope, 'all');
  assert.equal(config.categories, null);
  assert.equal(config.pushExisting, false);
});

test('解析普通词、组合词、屏蔽词、正则和多版块', () => {
  const config = parseConfig({
    MEOW_NICKNAME: ' tester ',
    CHECK_INTERVAL_SECONDS: '10',
    MATCH_SCOPE: 'summary',
    KEYWORDS: ' VPS, 优惠 ,,',
    KEYWORD_GROUPS: '[["香港","VPS"],["日本","线路"]]',
    BLOCK_KEYWORDS: '求购, 已收',
    REGEX_PATTERNS: '["年付\\\\s*\\\\d+","香港|日本"]',
    CATEGORIES: 'trade,daily',
    PUSH_EXISTING: ' true '
  });

  assert.equal(config.meowNickname, 'tester');
  assert.equal(config.checkIntervalMs, 10000);
  assert.equal(config.matchScope, 'summary');
  assert.deepEqual(config.keywords, ['VPS', '优惠']);
  assert.deepEqual(config.keywordGroups, [['香港', 'VPS'], ['日本', '线路']]);
  assert.deepEqual(config.blockedKeywords, ['求购', '已收']);
  assert.deepEqual(config.regexPatterns.map((pattern) => pattern.source), ['年付\\s*\\d+', '香港|日本']);
  assert.deepEqual(config.regexPatterns.map((pattern) => pattern.flags), ['iu', 'iu']);
  assert.deepEqual([...config.categories], ['trade', 'daily']);
  assert.equal(config.pushExisting, true);
});

test('公开版块集合不可修改且不能放宽配置校验', () => {
  assert.equal(Object.isFrozen(CATEGORY_SLUGS), true);
  assert.equal(typeof CATEGORY_SLUGS.add, 'undefined');
  assert.equal(typeof CATEGORY_SLUGS.delete, 'undefined');
  assert.equal(typeof CATEGORY_SLUGS.clear, 'undefined');
  assert.throws(() => CATEGORY_SLUGS.add('unknown'), TypeError);
  assert.throws(() => parseConfig({ ...requiredEnv, CATEGORIES: 'unknown' }), /CATEGORIES/);
});

test('缺少昵称时拒绝启动', () => {
  assert.throws(() => parseConfig({ KEYWORDS: 'VPS' }), /MEOW_NICKNAME/);
  assert.throws(() => parseConfig({ MEOW_NICKNAME: 'a/b', KEYWORDS: 'VPS' }), /斜杠/);
});

test('未配置正向规则时拒绝启动', () => {
  assert.throws(() => parseConfig({ MEOW_NICKNAME: 'tester' }), /正向规则/);
});

test('非法范围、版块、布尔值、时间、JSON 和正则均拒绝启动', () => {
  assert.throws(() => parseConfig({ ...requiredEnv, MATCH_SCOPE: 'content' }), /MATCH_SCOPE/);
  assert.throws(() => parseConfig({ ...requiredEnv, CATEGORIES: 'unknown' }), /CATEGORIES/);
  assert.throws(() => parseConfig({ ...requiredEnv, PUSH_EXISTING: 'yes' }), /PUSH_EXISTING/);
  assert.throws(() => parseConfig({ ...requiredEnv, CHECK_INTERVAL_SECONDS: '0' }), /CHECK_INTERVAL_SECONDS/);
  assert.throws(() => parseConfig({ ...requiredEnv, KEYWORD_GROUPS: '[invalid' }), /KEYWORD_GROUPS/);
  assert.throws(() => parseConfig({ ...requiredEnv, REGEX_PATTERNS: '["("]' }), /REGEX_PATTERNS/);
});
