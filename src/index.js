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
  const ruleCount = config.keywords.length + config.keywordGroups.length + config.regexPatterns.length;
  const parts = [
    `MeoW 昵称 ${config.meowNickname}`,
    `轮询间隔 ${config.checkIntervalMs / 1000} 秒`,
    `匹配范围 ${config.matchScope}`,
    `监控版块 ${categories}`
  ];
  if (config.pushCategory) {
    const label = config.pushCategory === 'all' ? 'all' : [...config.pushCategory].join(',');
    parts.push(`版块匹配 ${label}`);
  }
  parts.push(`规则 ${ruleCount} 条`);
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
  await pusher.pushStartupTest();
  logger.info('MeoW 启动测试推送成功');

  try {
    await fetchItems();
    logger.info('RSS 连接正常');
  } catch (error) {
    logger.warn(`RSS 连接检测失败: ${error.message}`);
  }

  const controller = new AbortController();
  let healthCheckTimer;
  if (config.healthCheckMs) {
    healthCheckTimer = setInterval(async () => {
      try {
        await fetchItems();
        logger.info('自检 RSS 连接正常');
        await pusher.pushHealthCheck();
        logger.info('自检 MeoW 推送正常');
      } catch (error) {
        logger.error(`自检失败: ${error.message}`);
      }
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
