const MEOW_BASE_URL = 'https://api.chuckfang.com';
const NODESEEK_HOME_URL = 'https://www.nodeseek.com/';
const NODESEEK_ICON_URL = 'https://nodeseek.cc/uploads/default/optimized/1X/47c7a8a16553966c7b7b52b85dda45bbceb42d1b_2_512x512.png';

const CATEGORY_NAMES = new Map([
  ['daily', '日常'],
  ['tech', '技术'],
  ['info', '情报'],
  ['review', '测评'],
  ['trade', '交易'],
  ['carpool', '拼车'],
  ['promo', '推广'],
  ['life', '生活'],
  ['dev', 'Dev'],
  ['photo-share', '贴图'],
  ['expose', '曝光'],
  ['inner', '内版'],
  ['sandbox', '沙盒']
]);

function categoryName(slug) {
  if (!slug) return '未知';
  return CATEGORY_NAMES.get(slug) ?? slug;
}

function formatSingleKeyword(reason = '') {
  if (reason.startsWith('keyword:')) return reason.slice('keyword:'.length);
  if (reason.startsWith('group:')) return reason.slice('group:'.length);
  if (reason.startsWith('regex:')) return reason.slice('regex:'.length);
  if (reason.startsWith('category-push:')) return `${categoryName(reason.slice('category-push:'.length))}（版块匹配）`;
  return reason;
}

function formatKeyword(reason = '') {
  return reason.split('|').filter(Boolean).map(formatSingleKeyword).join(' ');
}

export function formatReason(reason = '') {
  if (reason === 'no-match') return '未命中';
  if (reason === 'category') return '版块过滤';
  if (reason.startsWith('blocked:')) return `屏蔽词（${reason.slice('blocked:'.length)}）`;
  return formatKeyword(reason);
}

function formatChineseTime(value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value || '未知';
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(time)).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}年${Number(parts.month)}月${Number(parts.day)}日 ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatMessage(item, match = {}) {
  return [
    `📌 版块：${categoryName(item.category)}`,
    `👤 作者：${item.creator || '未知'}`,
    `🎯 命中规则：${formatKeyword(match.reason)}`,
    `🕒 发布时间：${formatChineseTime(item.pubDate)}`,
    `📝 摘要：${item.summary || '（无摘要）'}`
  ].join('\n');
}

export function createMeowClient({
  nickname,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000
}) {
  const endpoint = `${MEOW_BASE_URL}/${encodeURIComponent(nickname)}/NodeSeek?msgType=text`;

  async function post(payload) {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        imgUrl: NODESEEK_ICON_URL
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

  return {
    async push(item, match) {
      await post({
        title: item.title,
        msg: formatMessage(item, match),
        url: item.link
      });
    },
    async pushHealthCheck({ rssOk = true, version = '', updateInfo = null } = {}) {
      const lines = [];
      if (rssOk) {
        lines.push('SeekMeow 已启动，RSS 与 MeoW 连接正常。');
      } else {
        lines.push('SeekMeow 已启动，MeoW 连接正常；RSS 连接异常，请检查网络或 NodeSeek RSS 服务。');
      }
      if (version) {
        const updateLine = updateInfo
          ? `当前版本：v${version}，发现新版本 v${updateInfo.latestVersion}！请访问 ${updateInfo.url} 查看更新。`
          : `当前已是最新版本：v${version}`;
        lines.push(updateLine);
      }
      await post({
        title: 'SeekMeow 自检',
        msg: lines.join('\n'),
        url: NODESEEK_HOME_URL
      });
    },
    async pushError(message) {
      await post({
        title: 'SeekMeow 异常',
        msg: message,
        url: NODESEEK_HOME_URL
      });
    }
  };
}
