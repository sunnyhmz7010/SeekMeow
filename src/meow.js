const MEOW_BASE_URL = 'https://api.chuckfang.com';

export function formatMessage(item) {
  return [
    `版块：${item.category || '未知'}`,
    `作者：${item.creator || '未知'}`,
    `发布时间：${item.pubDate || '未知'}`,
    `摘要：${item.summary || '（无摘要）'}`
  ].join('\n');
}

export function createMeowClient({
  nickname,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
}) {
  const endpoint = `${MEOW_BASE_URL}/${encodeURIComponent(nickname)}/NodeSeek?msgType=text`;

  return {
    async push(item) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          msg: formatMessage(item),
          url: item.link
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) throw new Error(`MeoW 请求失败: HTTP ${response.status}`);

      let result;
      try {
        result = await response.json();
      } catch (error) {
        throw new Error(`MeoW 响应不是有效 JSON: ${error.message}`);
      }
      if (result.status !== 200) {
        const detail = result.msg ?? result.message ?? '';
        throw new Error(`MeoW 推送失败: ${result.status ?? '未知状态'} ${detail}`.trim());
      }
    }
  };
}
