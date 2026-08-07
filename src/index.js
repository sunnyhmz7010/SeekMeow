import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseConfig } from './config.js';
import { fetchFeed } from './feed.js';
import { matchItem } from './matcher.js';
import { createMeowClient } from './meow.js';
import { Monitor } from './monitor.js';
import { StateStore } from './state.js';

export function createLogger() {
  const write = (level, message) => console[level](`[${new Date().toISOString()}] ${message}`);
  return {
    info: (message) => write('log', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message)
  };
}

export function describeConfig(config) {
  const categories = config.categories ? [...config.categories].join(',') : 'all';
  const ruleParts = [];
  if (config.keywords.length) ruleParts.push(`关键词:${config.keywords.join(',')}`);
  if (config.keywordGroups.length) ruleParts.push(`组合词:${config.keywordGroups.map((g) => g.join('+')).join(',')}`);
  if (config.regexPatterns.length) ruleParts.push(`正则:${config.regexPatterns.map((r) => r.source).join(',')}`);
  if (config.pushCategory) {
    const label = config.pushCategory === 'all' ? 'all' : [...config.pushCategory].join(',');
    ruleParts.push(`版块匹配:${label}`);
  }
  const ruleCount = ruleParts.length;
  const parts = [
    `MeoW 昵称 ${config.meowNickname}`,
    `轮询间隔 ${config.checkIntervalMs / 1000} 秒`,
    `匹配范围 ${config.matchScope}`,
    `监控版块 ${categories}`,
    `规则 ${ruleCount} 条（${ruleParts.join(' | ')}）`
  ];
  if (config.blockedKeywords.length) parts.push(`屏蔽词:${config.blockedKeywords.join(',')}`);
  if (config.categories) parts.push(`版块过滤:${[...config.categories].join(',')}`);
  if (config.healthCheckMs) parts.push(`自检间隔 ${config.healthCheckMs / 60000} 分钟`);
  return parts.join('，');
}

export async function runApp({
  env = process.env,
  logger = createLogger(),
  stateFactory = () => new StateStore('/app/data/state.json', 1000),
  pusherFactory = (config) => createMeowClient({ nickname: config.meowNickname }),
  monitorFactory = (options) => new Monitor(options),
  fetchItems = () => fetchFeed(),
  registerSignals = true
} = {}) {
  const config = parseConfig(env);
  logger.info(`启动配置：${describeConfig(config)}`);

  const pusher = pusherFactory(config);

  let rssOk = false;
  try {
    await fetchItems();
    rssOk = true;
  } catch (error) {
    logger.warn(`自检 RSS 连接失败: ${error.message}`);
  }

  let meowOk = false;
  try {
    await pusher.pushHealthCheck();
    meowOk = true;
  } catch (error) {
    logger.error(`自检推送失败: ${error.message}`);
  }

  if (rssOk && meowOk) {
    logger.info('自检通过，RSS 与 MeoW 连接正常');
  }

  const controller = new AbortController();
  let healthCheckTimer;
  if (config.healthCheckMs) {
    healthCheckTimer = setInterval(async () => {
      let ok = true;
      try {
        await fetchItems();
      } catch (error) {
        logger.warn(`自检 RSS 连接失败: ${error.message}`);
        ok = false;
      }
      try {
        await pusher.pushHealthCheck();
      } catch (error) {
        logger.error(`自检推送失败: ${error.message}`);
        ok = false;
      }
      if (ok) logger.info('自检通过，RSS 与 MeoW 连接正常');
    }, config.healthCheckMs);
  }

  if (registerSignals) {
    const stop = (signal) => {
      logger.info(`收到 ${signal}，将在当前操作完成后退出`);
      if (healthCheckTimer) clearInterval(healthCheckTimer);
      controller.abort();
    };
    process.once('SIGTERM', () => stop('SIGTERM'));
    process.once('SIGINT', () => stop('SIGINT'));
  }

  const monitor = monitorFactory({
    config,
    fetchItems,
    matcher: matchItem,
    pusher,
    state: stateFactory(),
    logger
  });

  await monitor.initialize();
  logger.info('监控已启动');
  try {
    await monitor.run(controller.signal);
  } finally {
    if (healthCheckTimer) clearInterval(healthCheckTimer);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runApp().catch((error) => {
    console.error(`[${new Date().toISOString()}] 启动失败: ${error.message}`);
    process.exitCode = 1;
  });
}
