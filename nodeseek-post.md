## 为什么做这个
NodeSeek 上的 VPS 优惠、补货信息转瞬即逝，手动刷新既费时又容易错过。SeekMeow 自动订阅 NodeSeek 官方 RSS，根据你设置的关键词筛选帖子并推送到 MeoW。全程不需要 NodeSeek 账号或浏览器，一个 Docker 命令就能跑起来。

## 功能亮点
- 官方 RSS 直连：只依赖 `https://rss.nodeseek.com/`，无需账号、Cookie、浏览器或端口映射
- 灵活匹配规则：普通关键词、组合关键词、正则表达式、版块匹配四种规则可叠加，支持版块过滤与屏蔽词
- 精准命中范围：可单独匹配标题或 RSS 摘要，也可同时匹配两者
- 友好通知内容：推送正文显示中文版块、作者、关键词、中文发布时间和完整摘要
- 失败自动重试：推送失败的消息持久化保留，容器重启后继续补推
- 去重防打扰：已处理帖子记录在本地状态文件，同一帖绝不重复推送
- 定时自检：启动及定时验证 RSS 与 MeoW 连接，异常及时通知
- 轻量容器化：Node.js 24 Alpine 镜像，支持 amd64 / arm64，一条命令部署，无需映射端口或目录

## 截图预览
![SeekMeow 推送效果](https://cdn.nodeimage.com/i/u2gADd7WYh93ifd8TBme76ng1XDICfZY.png)

## 快速开始

**前置要求**：一台能访问外网的 VPS 或 NAS（需能连接 `rss.nodeseek.com` 和 `api.chuckfang.com`），Docker 18.09+，一个 MeoW 昵称。

**Docker Compose（推荐）**，新建 `compose.yaml`：

```yaml
services:
  seekmeow:
    image: ghcr.io/sunnyhmz7010/seekmeow:latest
    container_name: seekmeow
    restart: unless-stopped
    environment:
      - MEOW_NICKNAME=你的昵称
      - CHECK_INTERVAL_SECONDS=5
      - CATEGORIES=all
      - MATCH_SCOPE=all
      - KEYWORDS=VPS,优惠,补货
      - KEYWORD_GROUPS=[["香港","VPS"],["日本","线路"]]
      - REGEX_PATTERNS=["年付\\s*\\d+","香港|日本"]
      - PUSH_CATEGORY=trade
      - BLOCK_KEYWORDS=求购,已收
      - PUSH_EXISTING=false
      - HEALTH_CHECK_MINUTES=60
```

然后启动：

```bash
docker compose up -d
```

**或者一行 Docker 命令**：

```bash
docker run -d \
  --name seekmeow \
  --restart unless-stopped \
  -e MEOW_NICKNAME="你的昵称" \
  -e CHECK_INTERVAL_SECONDS=5 \
  -e CATEGORIES=all \
  -e MATCH_SCOPE=all \
  -e KEYWORDS="VPS,优惠,补货" \
  -e KEYWORD_GROUPS='[["香港","VPS"],["日本","线路"]]' \
  -e REGEX_PATTERNS='["年付\\s*\\d+","香港|日本"]' \
  -e PUSH_CATEGORY=trade \
  -e BLOCK_KEYWORDS="求购,已收" \
  -e PUSH_EXISTING=false \
  -e HEALTH_CHECK_MINUTES=60 \
  ghcr.io/sunnyhmz7010/seekmeow:latest
```

**自行构建**：

```bash
git clone https://github.com/sunnyhmz7010/SeekMeow.git
cd SeekMeow
docker build -t seekmeow .
docker run -d \
  --name seekmeow \
  --restart unless-stopped \
  -e MEOW_NICKNAME="你的昵称" \
  -e CHECK_INTERVAL_SECONDS=5 \
  -e CATEGORIES=all \
  -e MATCH_SCOPE=all \
  -e KEYWORDS="VPS,优惠,补货" \
  -e KEYWORD_GROUPS='[["香港","VPS"],["日本","线路"]]' \
  -e REGEX_PATTERNS='["年付\\s*\\d+","香港|日本"]' \
  -e PUSH_CATEGORY=trade \
  -e BLOCK_KEYWORDS="求购,已收" \
  -e PUSH_EXISTING=false \
  -e HEALTH_CHECK_MINUTES=60 \
  seekmeow
```

如果用 Docker Compose，把 `compose.yaml` 里的 `image: ghcr.io/...` 换成 `build: .`，然后 `docker compose up -d --build`。

启动时容器会自检 RSS 与 MeoW 连接并推送一条通知；首次启动默认把当前 RSS 作为基线，只推送之后的新帖，设置 `PUSH_EXISTING=true` 可同时检查已有帖子。

## 常用环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `MEOW_NICKNAME` | 是 | - | MeoW 昵称，不能包含 `/` |
| `CHECK_INTERVAL_SECONDS` | 否 | `5` | 检查新帖的间隔（秒），范围 1-2147483 |
| `CATEGORIES` | 否 | `all` | 全局版块过滤，`all` 或英文逗号分隔的版块标识，所有匹配规则均受此限制 |
| `MATCH_SCOPE` | 否 | `all` | `title`、`summary` 或 `all`，仅对关键词/组合词/正则生效 |
| `KEYWORDS` | 条件必填 | - | 英文逗号分隔，命中任意一个即推送 |
| `KEYWORD_GROUPS` | 条件必填 | `[]` | JSON 二维数组如 `[["词A","词B"]]`，同组全部命中才推送 |
| `REGEX_PATTERNS` | 条件必填 | `[]` | JSON 字符串数组如 `["年付\\s*\\d+"]`，命中任意一个即推送 |
| `PUSH_CATEGORY` | 条件必填 | - | 版块匹配，`all` 或英文逗号分隔的版块标识如 `trade,daily`，命中指定版块即推送 |
| `BLOCK_KEYWORDS` | 否 | - | 英文逗号分隔，命中任意一个就不推送，所有规则均生效 |
| `PUSH_EXISTING` | 否 | `false` | 首次启动是否处理已有帖子 |
| `HEALTH_CHECK_MINUTES` | 否 | `60` | 定时自检间隔（分钟），范围 0-1440，设为 0 关闭 |

> `KEYWORDS`、`KEYWORD_GROUPS`、`REGEX_PATTERNS`、`PUSH_CATEGORY` 四项至少配置一种。

可选版块标识：`daily` `tech` `info` `review` `trade` `carpool` `promo` `life` `dev` `photo-share` `expose` `inner` `sandbox`

## 项目地址

开源地址：https://github.com/sunnyhmz7010/SeekMeow

欢迎 Star、提 Issue、提交 PR。
