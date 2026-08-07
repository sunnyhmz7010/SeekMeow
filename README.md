<div align="center">
  <h1>SeekMeow</h1>
  <p>自动监控 NodeSeek 新帖，按关键词筛选后推送到 MeoW。</p>
</div>

<p align="center">
  <a href="https://github.com/sunnyhmz7010/SeekMeow/releases"><img src="https://img.shields.io/github/v/release/sunnyhmz7010/SeekMeow?label=Release&color=3b82f6" alt="Release" /></a>
  <a href="https://github.com/sunnyhmz7010/SeekMeow/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sunnyhmz7010/SeekMeow?color=10b981" alt="License" /></a>
</p>

---

## ✨ 为什么做这个应用

NodeSeek 上的 VPS 优惠、补货信息转瞬即逝，手动刷新既费时又容易错过。SeekMeow 自动订阅 NodeSeek 官方 RSS，根据你设置的关键词筛选帖子并推送到 MeoW。全程不需要 NodeSeek 账号或浏览器，一个 Docker 命令就能跑起来。

## 🚀 核心能力

- 官方 RSS 直连：只依赖 `https://rss.nodeseek.com/`，无需账号、Cookie、前端页面或端口映射
- 灵活匹配规则：普通关键词、组合关键词、正则表达式三种规则可叠加，还支持版块过滤与屏蔽词
- 精准命中范围：可单独匹配标题或 RSS 摘要，也可同时匹配两者
- 友好通知内容：推送正文显示中文版块、作者、关键词、中文发布时间和完整摘要，并使用 NodeSeek 图标
- 失败自动重试：推送失败的消息持久化保留，容器重启后继续补推
- 去重防打扰：已处理帖子记录在本地状态文件，同一帖绝不重复推送
- 轻量容器化：Node.js 24 Alpine 镜像，Docker 一条命令启动，零配置目录挂载

## ⚡ 快速开始

### 📋 前置要求

- Docker（18.09+）
- 一个 MeoW 昵称（`https://api.chuckfang.com/{你的昵称}/NodeSeek`）

### 📦 Docker Compose（推荐）

新建 `compose.yaml`，写入以下内容：

```yaml
services:
  seekmeow:
    image: ghcr.io/sunnyhmz7010/seekmeow:latest
    container_name: seekmeow
    restart: unless-stopped
    environment:
      - MEOW_NICKNAME=你的昵称
      - KEYWORDS=VPS,优惠,补货
      - KEYWORD_GROUPS=[["香港","VPS"],["日本","线路"]]
      - BLOCK_KEYWORDS=求购,已收
      - REGEX_PATTERNS=["年付\\s*\\d+","香港|日本"]
      - MATCH_SCOPE=all
      - CATEGORIES=all
      - CHECK_INTERVAL_SECONDS=5
      - PUSH_EXISTING=false
```

然后启动：

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

### 🖥️ 命令行方式

```bash
docker run -d \
  --name seekmeow \
  --restart unless-stopped \
  -e MEOW_NICKNAME="你的昵称" \
  -e KEYWORDS="VPS,优惠,补货" \
  -e KEYWORD_GROUPS='[["香港","VPS"],["日本","线路"]]' \
  -e BLOCK_KEYWORDS="求购,已收" \
  -e REGEX_PATTERNS='["年付\\s*\\d+","香港|日本"]' \
  -e MATCH_SCOPE=all \
  -e CATEGORIES=all \
  -e CHECK_INTERVAL_SECONDS=5 \
  -e PUSH_EXISTING=false \
  ghcr.io/sunnyhmz7010/seekmeow:latest
```

### 🛠️ 自行构建镜像

如果你想自己构建而不是使用预构建镜像：

```bash
git clone https://github.com/sunnyhmz7010/SeekMeow.git
cd SeekMeow
docker build -t seekmeow .
docker run -d \
  --name seekmeow \
  --restart unless-stopped \
  -e MEOW_NICKNAME="你的昵称" \
  -e KEYWORDS="VPS,优惠,补货" \
  -e KEYWORD_GROUPS='[["香港","VPS"],["日本","线路"]]' \
  -e BLOCK_KEYWORDS="求购,已收" \
  -e REGEX_PATTERNS='["年付\\s*\\d+","香港|日本"]' \
  -e MATCH_SCOPE=all \
  -e CATEGORIES=all \
  -e CHECK_INTERVAL_SECONDS=5 \
  -e PUSH_EXISTING=false \
  seekmeow
```

如果用 Docker Compose，把 `compose.yaml` 里的 `image: ghcr.io/...` 换成 `build: .`，然后 `docker compose up -d --build`。

### 📌 首次运行说明

启动时会先向 MeoW 发送一条测试推送；如果测试推送失败，容器会报错退出，方便排查配置问题。

首次启动默认不会推送 RSS 中已有的旧帖，只推送之后出现的新帖。如果需要把当前已有的帖子也检查一遍，设置 `PUSH_EXISTING=true`。

## 📖 使用说明

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `MEOW_NICKNAME` | 是 | - | MeoW 昵称，不能包含 `/` |
| `CHECK_INTERVAL_SECONDS` | 否 | `5` | 检查新帖的间隔（秒），范围 1-2147483 |
| `MATCH_SCOPE` | 否 | `all` | `title`（仅标题）、`summary`（仅摘要）、`all`（同时匹配） |
| `KEYWORDS` | 条件必填 | - | 英文逗号分隔，命中任意一个即推送 |
| `KEYWORD_GROUPS` | 条件必填 | `[]` | 多组关键词，同组内的词必须全部命中才推送，如 `[["香港","VPS"],["日本","线路"]]` |
| `BLOCK_KEYWORDS` | 否 | - | 英文逗号分隔，命中任意一个就不推送 |
| `REGEX_PATTERNS` | 条件必填 | `[]` | 正则表达式列表，命中任意一个即推送，如 `["年付\\s*\\d+","香港|日本"]` |
| `CATEGORIES` | 否 | `all` | `all`（所有版块）或用英文逗号分隔的版块标识 |
| `PUSH_EXISTING` | 否 | `false` | 首次启动时是否也检查 RSS 中已有的帖子 |

> `KEYWORDS`、`KEYWORD_GROUPS`、`REGEX_PATTERNS` 至少配置一种。

可选版块标识：
`daily` `tech` `info` `review` `trade` `carpool` `promo` `life` `dev` `photo-share` `expose` `inner` `sandbox`

### 匹配规则

屏蔽词优先级最高。没有命中屏蔽词时，只要满足以下任一条件就会推送：
- 普通关键词命中
- 某组关键词全部命中
- 正则表达式命中

### 推送内容

MeoW 通知标题为帖子原标题，图标为 NodeSeek 图标，点击通知会跳转到对应帖子。正文显示版块、作者、触发关键词、发布时间和帖子摘要。

### 日志与去重

```bash
docker logs -f seekmeow
```

重启容器（`docker restart`）会保留已处理和待重试的记录；删除并重建容器后，会按 `PUSH_EXISTING` 设置重新扫描。

## 🧠 功能细节

- 运行记录保存在本地，重启不会丢失
- RSS 内容自动清洗为纯文本再匹配，不受 HTML 标签干扰
- 匹配优先级：屏蔽词 > 版块过滤 > 关键词 > 组合词 > 正则
- 帖子按发布时间顺序处理，推送不会乱序
- 程序退出前会完成当前一轮检查，不会丢失数据

## 🧱 技术栈

- Node.js：>=24（ESM，`node --test` 内置测试）
- @xmldom/xmldom：RSS/HTML 解析
- 目标平台：Docker（node:24-alpine）或任意 Node.js 24+ 环境

## 🗂️ 项目结构

```
SeekMeow/
├── src/                    # 源码
│   ├── index.js            # 入口：组装依赖、信号处理、主循环
│   ├── config.js           # 环境变量解析与校验
│   ├── feed.js             # RSS 抓取与 XML 解析
│   ├── matcher.js          # 关键词 / 组合词 / 正则 / 版块匹配
│   ├── meow.js             # MeoW 推送客户端
│   ├── monitor.js          # 轮询调度、去重与失败重试
│   └── state.js            # 状态持久化存储（原子写入）
├── test/                   # 单元测试（node --test）
├── .github/ISSUE_TEMPLATE/ # Issue 模板
├── Dockerfile              # 容器镜像定义
├── .env.example            # 环境变量示例
└── package.json            # 依赖与脚本
```

## 👨‍💻 本地开发

### 🧰 环境

- Node.js >= 24
- 无需安装任何运行时服务，测试为纯离线单元测试

### ⚙️ 命令

```bash
npm install
npm test
```

## 🔐 安全报告

如果发现安全问题，请不要公开披露。请参考 [SECURITY.md](./SECURITY.md) 提交报告。

## 📄 许可证

[GPL-3.0](./LICENSE)

<div align="center">
  <sub>Built with ❤️ by Sunny</sub>
</div>
