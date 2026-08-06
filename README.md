# SeekMeow

直接读取 NodeSeek RSS，按标题或 RSS 摘要匹配关键词，并将新帖推送到 MeoW。无需 NodeSeek 账号、Cookie、浏览器、前端页面、端口映射或目录映射。

## 构建

```bash
docker build -t seekmeow .
```

## 启动

```bash
docker run -d \
  --name seekmeow \
  --restart unless-stopped \
  -e MEOW_NICKNAME="你的昵称" \
  -e KEYWORDS="VPS,优惠,补货" \
  -e KEYWORD_GROUPS='[["香港","VPS"],["日本","线路"]]' \
  -e BLOCK_KEYWORDS="求购,已收" \
  -e REGEX_PATTERNS='["年付\\s*\\d+","香港|日本"]' \
  -e MATCH_SCOPE="all" \
  -e CATEGORIES="all" \
  -e CHECK_INTERVAL_SECONDS="5" \
  -e PUSH_EXISTING="false" \
  seekmeow
```

容器不监听端口，也不要求映射目录。首次启动默认把当前 RSS 条目作为基线，只推送之后出现的新帖；设置 `PUSH_EXISTING=true` 后会同时检查当前 RSS 中已有的帖子。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `MEOW_NICKNAME` | 是 | - | MeoW 用户昵称，不允许包含 `/` |
| `CHECK_INTERVAL_SECONDS` | 否 | `5` | 检查间隔，单位为秒，范围为 1-2147483 |
| `MATCH_SCOPE` | 否 | `all` | `title`、`summary` 或 `all`；`summary` 是 RSS 摘要，不是完整正文 |
| `KEYWORDS` | 条件必填 | - | 英文逗号分隔，任意关键词命中即可 |
| `KEYWORD_GROUPS` | 条件必填 | `[]` | JSON 二维数组，同组内所有词都命中才成立 |
| `BLOCK_KEYWORDS` | 否 | - | 英文逗号分隔，任意屏蔽词命中便不推送 |
| `REGEX_PATTERNS` | 条件必填 | `[]` | JSON 字符串数组，任意正则命中即可，固定使用 `iu` 标志 |
| `CATEGORIES` | 否 | `all` | `all` 或逗号分隔的版块 slug |
| `PUSH_EXISTING` | 否 | `false` | 首次启动是否处理 RSS 中已有帖子 |

`KEYWORDS`、`KEYWORD_GROUPS`、`REGEX_PATTERNS` 至少配置一种。

可用版块 slug：`daily`、`tech`、`info`、`review`、`trade`、`carpool`、`promo`、`life`、`dev`、`photo-share`、`expose`、`inner`、`sandbox`。

## 匹配规则

屏蔽词优先。未命中屏蔽词时，普通关键词任意命中、任意组合规则全词命中、任意正则命中，满足其中一种便推送。

## 日志与去重

```bash
docker logs -f seekmeow
```

同一容器执行 `docker restart` 时会保留去重状态和待重试消息；删除并重建容器后，按照 `PUSH_EXISTING` 重新执行首次扫描规则。

## 本地测试

```bash
npm install
npm test
```
