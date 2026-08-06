import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanSummary, fetchFeed, parseFeed } from '../src/feed.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <item>
      <title><![CDATA[香港 VPS 补货]]></title>
      <description><![CDATA[<p>年付&nbsp;100 元 &amp; 可退款</p>]]></description>
      <link>https://www.nodeseek.com/post-2-1</link>
      <guid isPermaLink="false">2</guid>
      <category><![CDATA[trade]]></category>
      <dc:creator><![CDATA[alice]]></dc:creator>
      <pubDate>Thu, 06 Aug 2026 13:09:07 GMT</pubDate>
    </item>
    <item>
      <title>无 guid 帖子</title>
      <description>纯文本摘要</description>
      <link>https://www.nodeseek.com/post-1-1</link>
      <category>daily</category>
    </item>
  </channel>
</rss>`;

test('清理摘要中的 HTML、实体和多余空白', () => {
  assert.equal(cleanSummary('<p>年付&nbsp;100 元 &amp; 可退款</p>'), '年付 100 元 & 可退款');
  assert.equal(cleanSummary('1 &lt; 2 &amp;&amp; 3 &gt; 2'), '1 < 2 && 3 > 2');
  assert.equal(cleanSummary('&copy; &mdash; &hellip;'), '© — …');
});

test('解析 RSS 条目并优先使用 guid', () => {
  const items = parseFeed(RSS);

  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    id: '2',
    title: '香港 VPS 补货',
    summary: '年付 100 元 & 可退款',
    link: 'https://www.nodeseek.com/post-2-1',
    category: 'trade',
    creator: 'alice',
    pubDate: 'Thu, 06 Aug 2026 13:09:07 GMT'
  });
  assert.equal(items[1].id, 'https://www.nodeseek.com/post-1-1');
});

test('parseFeed 保留 XML 实体表示的普通比较文本', () => {
  const xml = '<rss><channel><item><title>比较</title><description>价格 &lt; VPS 且内存 &gt; 2G</description><guid>3</guid></item></channel></rss>';
  assert.equal(parseFeed(xml)[0].summary, '价格 < VPS 且内存 > 2G');
});

test('缺少 guid 和 link 的条目会被忽略', () => {
  const xml = '<rss><channel><item><title>无 ID</title></item></channel></rss>';
  assert.deepEqual(parseFeed(xml), []);
});

test('无效 XML 会明确失败', () => {
  assert.throws(() => parseFeed('<rss><channel>'), /RSS XML/);
});

test('无效 XML 失败时不会输出解析器诊断', () => {
  const diagnostics = [];
  const originalError = console.error;
  console.error = (...args) => diagnostics.push(args);

  try {
    assert.throws(() => parseFeed('<rss><channel>'), /RSS XML/);
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(diagnostics, []);
});

test('RSS 请求失败时抛出包含状态码的错误', async () => {
  const fetchImpl = async () => new Response('error', { status: 503 });
  await assert.rejects(() => fetchFeed({ fetchImpl }), /503/);
});

test('RSS 请求固定使用 NodeSeek RSS 地址', async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = url;
    return new Response('<rss><channel></channel></rss>', { status: 200 });
  };

  await fetchFeed({ fetchImpl });
  assert.equal(requestedUrl, 'https://rss.nodeseek.com/');
});
