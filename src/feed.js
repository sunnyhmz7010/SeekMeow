import { DOMParser } from '@xmldom/xmldom';

const RSS_URL = 'https://rss.nodeseek.com/';

export function cleanSummary(value = '') {
  const document = new DOMParser({ onError() {} }).parseFromString(
    `<html><body>${value}</body></html>`,
    'text/html'
  );
  return (document.getElementsByTagName('body').item(0)?.textContent ?? value)
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[[0-9;]+[a-zA-Z](?![a-zA-Z0-9])/g, '')
    .replace(/\[[HJKR](?![a-zA-Z])/g, '')
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

function sanitizeXml(xml) {
  return xml.replace(/\uFFFD/gu, '');
}

export async function fetchFeed({
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
} = {}) {
  const response = await fetchImpl(RSS_URL, {
    headers: { 'user-agent': 'seekmeow/1.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`RSS 请求失败: HTTP ${response.status}`);
  return parseFeed(sanitizeXml(await response.text()));
}
