import { DOMParser } from '@xmldom/xmldom';

const RSS_URL = 'https://rss.nodeseek.com/';

const NAMED_ENTITIES = new Map([
  ['nbsp', ' '], ['amp', '&'], ['lt', '<'], ['gt', '>'],
  ['quot', '"'], ['apos', "'"], ['#39', "'"]
]);

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    const lower = entity.toLowerCase();
    const codePoint = lower.startsWith('#x')
      ? Number.parseInt(lower.slice(2), 16)
      : lower.startsWith('#') ? Number.parseInt(lower.slice(1), 10) : null;
    if (codePoint !== null) {
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return NAMED_ENTITIES.get(lower) ?? match;
  });
}

export function cleanSummary(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/gu, ' ')
    .trim();
}

function textOf(element, tagName) {
  return element.getElementsByTagName(tagName).item(0)?.textContent?.trim() ?? '';
}

export function parseFeed(xml) {
  let document;
  const parseErrors = [];
  try {
    document = new DOMParser({
      onError(level, message) {
        parseErrors.push({ level, message });
      }
    }).parseFromString(xml, 'text/xml');
  } catch (error) {
    throw new Error(`RSS XML 解析失败: ${error.message}`);
  }

  if (parseErrors.length > 0) {
    throw new Error(`RSS XML 解析失败: ${parseErrors[0].message}`);
  }

  if (!document?.documentElement || document.getElementsByTagName('parsererror').length > 0) {
    throw new Error('RSS XML 解析失败');
  }

  return Array.from(document.getElementsByTagName('item'), (item) => {
    const link = textOf(item, 'link');
    const id = textOf(item, 'guid') || link;
    if (!id) return null;
    return {
      id,
      title: textOf(item, 'title'),
      summary: cleanSummary(textOf(item, 'description')),
      link,
      category: textOf(item, 'category'),
      creator: textOf(item, 'dc:creator'),
      pubDate: textOf(item, 'pubDate')
    };
  }).filter(Boolean);
}

export async function fetchFeed({
  fetchImpl = globalThis.fetch,
  url = RSS_URL,
  timeoutMs = 15000
} = {}) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'nodeseek-meow-monitor/1.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`RSS 请求失败: HTTP ${response.status}`);
  return parseFeed(await response.text());
}
