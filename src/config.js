const CATEGORY_SLUG_SET = new Set([
  'daily', 'tech', 'info', 'review', 'trade', 'carpool', 'promo',
  'life', 'dev', 'photo-share', 'expose', 'inner', 'sandbox'
]);

export const CATEGORY_SLUGS = Object.freeze({
  get size() {
    return CATEGORY_SLUG_SET.size;
  },
  has(value) {
    return CATEGORY_SLUG_SET.has(value);
  },
  entries() {
    return CATEGORY_SLUG_SET.entries();
  },
  keys() {
    return CATEGORY_SLUG_SET.keys();
  },
  values() {
    return CATEGORY_SLUG_SET.values();
  },
  forEach(callback, thisArg) {
    CATEGORY_SLUG_SET.forEach((value) => callback.call(thisArg, value, value, CATEGORY_SLUGS));
  },
  [Symbol.iterator]() {
    return CATEGORY_SLUG_SET[Symbol.iterator]();
  }
});

const MATCH_SCOPES = new Set(['title', 'summary', 'all']);

function splitCsv(value = '') {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseJson(value, name, fallback) {
  if (value === undefined || value.trim() === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${name} 必须是有效 JSON: ${error.message}`);
  }
}

function parseStringArray(value, name) {
  const parsed = parseJson(value, name, []);
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${name} 必须是非空字符串组成的 JSON 数组`);
  }
  return parsed.map((item) => item.trim());
}

function parseGroups(value) {
  const parsed = parseJson(value, 'KEYWORD_GROUPS', []);
  if (!Array.isArray(parsed) || parsed.some((group) =>
    !Array.isArray(group) || group.length === 0 ||
    group.some((item) => typeof item !== 'string' || !item.trim())
  )) {
    throw new Error('KEYWORD_GROUPS 必须是由非空字符串数组组成的 JSON 数组');
  }
  return parsed.map((group) => group.map((item) => item.trim()));
}

function parseBoolean(value, name, fallback) {
  if (value === undefined || value.trim() === '') return fallback;
  const normalized = value.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`${name} 只允许 true 或 false`);
}

export function parseConfig(env = process.env) {
  const meowNickname = env.MEOW_NICKNAME?.trim();
  if (!meowNickname) throw new Error('MEOW_NICKNAME 不能为空，请设置 MeoW 用户昵称');
  if (meowNickname.includes('/')) throw new Error('MEOW_NICKNAME 不能包含斜杠');

  const intervalSeconds = Number(env.CHECK_INTERVAL_SECONDS ?? '5');
  const intervalMs = intervalSeconds * 1000;
  if (!Number.isSafeInteger(intervalSeconds) || intervalSeconds < 1 || intervalMs > 2_147_483_647) {
    throw new Error('CHECK_INTERVAL_SECONDS 必须是 1 到 2147483 之间的整数');
  }

  const matchScope = (env.MATCH_SCOPE ?? 'all').trim();
  if (!MATCH_SCOPES.has(matchScope)) {
    throw new Error('MATCH_SCOPE 只允许 title、summary 或 all');
  }

  const keywords = splitCsv(env.KEYWORDS);
  const keywordGroups = parseGroups(env.KEYWORD_GROUPS);
  const blockedKeywords = splitCsv(env.BLOCK_KEYWORDS);
  const regexSources = parseStringArray(env.REGEX_PATTERNS, 'REGEX_PATTERNS');
  let regexPatterns;
  try {
    regexPatterns = regexSources.map((source) => new RegExp(source, 'iu'));
  } catch (error) {
    throw new Error(`REGEX_PATTERNS 包含无效正则: ${error.message}`);
  }

  const pushCategoryValue = (env.PUSH_CATEGORY ?? '').trim();
  let pushCategory = null;
  if (pushCategoryValue) {
    if (pushCategoryValue === 'all') {
      pushCategory = 'all';
    } else if (CATEGORY_SLUG_SET.has(pushCategoryValue)) {
      pushCategory = pushCategoryValue;
    } else {
      throw new Error('PUSH_CATEGORY 必须是 all 或有效的版块标识');
    }
  }

  if (keywords.length === 0 && keywordGroups.length === 0 && regexPatterns.length === 0 && !pushCategory) {
    throw new Error('至少需要配置一种正向规则或设置 PUSH_CATEGORY');
  }

  const categoryValue = (env.CATEGORIES ?? 'all').trim();
  const categories = categoryValue === 'all' ? null : new Set(splitCsv(categoryValue));
  if (categories && ([...categories].length === 0 || [...categories].some((slug) => !CATEGORY_SLUG_SET.has(slug)))) {
    throw new Error('CATEGORIES 包含不支持的版块 slug');
  }

  return {
    meowNickname,
    checkIntervalMs: intervalMs,
    matchScope,
    keywords,
    keywordGroups,
    blockedKeywords,
    regexPatterns,
    categories,
    pushCategory,
    pushExisting: parseBoolean(env.PUSH_EXISTING, 'PUSH_EXISTING', false)
  };
}
