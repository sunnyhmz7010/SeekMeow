# SeekMeow 项目 AGENTS.md

## 项目说明

自动订阅 NodeSeek 官方 RSS，按关键词/组合词/正则/版块匹配规则筛选帖子，推送到 MeoW。

## 技术栈

- Node.js >= 24（ESM）
- @xmldom/xmldom：RSS/HTML 解析
- Docker（node:24-alpine 镜像）
- 无框架，无运行时服务依赖

## 本地命令

```bash
npm install        # 安装依赖
npm test           # 运行全部测试（node --test，纯离线）
docker build -t seekmeow .  # 构建镜像
```

## 发布惯例

- 版本号遵循 semver（`major.minor.patch`）
- 发版步骤：`git tag vX.Y.Z` → `git push origin vX.Y.Z` → `gh release create` 写中英双语发布说明
- 镜像自动构建并推送到 `ghcr.io/sunnyhmz7010/seekmeow`（多标签：`X.Y.Z`、`X.Y`、`X`、`latest`）
- README 遵循 `github-repo-infrastructure` skill 规范，所有 H2/H3 标题固定 Emoji 前缀，不可增删调换章节
- 发布说明格式：`## ✨ New Features / 新增功能`、`## ⚙️ Enhancements / 功能优化`、`## 🛠️ Bug Fixes / 问题修复`

## 项目约定

- 环境变量命名统一大写蛇形（`MEOW_NICKNAME`、`PUSH_CATEGORY`）
- 配置解析集中在 `src/config.js`，校验失败抛出中文错误，容器直接退出
- 匹配器收集全部命中规则（不早停），四种规则取并集
- 状态持久化使用临时文件 + 原子重命名写入（`src/state.js`）
- 推送失败消息进入待重试队列，下轮轮询优先处理
- RSS 异常时推送 MeoW 通知，并记录推送结果
- 容器内工作目录 `/app`，状态文件 `/app/data/state.json`

## 架构分层

```
src/index.js     ← 入口：启动自检、定时自检、版本检查、信号处理、主循环
src/config.js    ← 环境变量解析与校验（非法值直接抛错退出）
src/feed.js      ← RSS 抓取与 XML/HTML 解析
src/matcher.js   ← 匹配引擎：CATEGORIES 过滤 → 屏蔽词 → 收集全部命中规则（取并集）
src/meow.js      ← MeoW 推送客户端（push / pushHealthCheck / pushError）、命中规则格式化、版本信息追加
src/monitor.js   ← 轮询调度、去重、失败重试、RSS 异常推送
src/state.js     ← 状态持久化（原子写入、限长裁剪）
```

## 匹配逻辑

1. CATEGORIES 全局过滤：不在白名单直接排除
2. BLOCK_KEYWORDS 屏蔽：命中任意一个即排除
3. 收集全部命中规则（不早停）：版块匹配 + 关键词 + 组合词 + 正则，取并集
4. 日志和推送的命中规则统一格式：`VPS 优惠 香港+VPS 年付\s*\d+ 交易（版块匹配）`

## 环境变量完整列表

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `MEOW_NICKNAME` | 是 | - | MeoW 昵称 |
| `CHECK_INTERVAL_SECONDS` | 否 | `5` | 轮询间隔（秒） |
| `CATEGORIES` | 否 | `all` | 全局版块过滤，所有规则均受此限制 |
| `MATCH_SCOPE` | 否 | `all` | `title` / `summary` / `all`，仅对关键词/组合词/正则生效 |
| `KEYWORDS` | 条件必填 | - | 普通关键词（逗号分隔） |
| `KEYWORD_GROUPS` | 条件必填 | `[]` | 组合关键词（JSON 二维数组） |
| `REGEX_PATTERNS` | 条件必填 | `[]` | 正则表达式（JSON 字符串数组，`iu` 标志） |
| `PUSH_CATEGORY` | 条件必填 | - | 版块匹配（`all` 或逗号分隔版块标识） |
| `BLOCK_KEYWORDS` | 否 | - | 屏蔽词（逗号分隔），所有规则均生效 |
| `PUSH_EXISTING` | 否 | `false` | 首次启动是否推送已有帖子 |
| `SHOW_LINK_URL` | 否 | `false` | 是否在推送内容底部显示帖子链接便于复制 |
| `HEALTH_CHECK_MINUTES` | 否 | `1440` | 定时自检间隔（分钟），0 关闭。自检时验证 RSS/MeoW 连接并检查版本更新 |

条件必填项（`KEYWORDS` / `KEYWORD_GROUPS` / `REGEX_PATTERNS` / `PUSH_CATEGORY`）至少配置一种。
