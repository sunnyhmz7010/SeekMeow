import { parseConfig } from './config.js';
import { fetchFeed } from './feed.js';
import { matchItem } from './matcher.js';
import { createMeowClient } from './meow.js';
import { Monitor } from './monitor.js';
import { StateStore } from './state.js';

function createLogger() {
  const write = (level, message) => console[level](`[${new Date().toISOString()}] ${message}`);
  return {
    info: (message) => write('log', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message)
  };
}

async function main() {
  const logger = createLogger();
  const config = parseConfig(process.env);
  const state = new StateStore('/app/data/state.json', 1000);
  const monitor = new Monitor({
    config,
    fetchItems: () => fetchFeed(),
    matcher: matchItem,
    pusher: createMeowClient({ nickname: config.meowNickname }),
    state,
    logger
  });
  const controller = new AbortController();
  const stop = (signal) => {
    logger.info(`收到 ${signal}，将在当前操作完成后退出`);
    controller.abort();
  };
  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));

  await monitor.initialize();
  logger.info(`监控已启动，轮询间隔 ${config.checkIntervalMs / 1000} 秒`);
  await monitor.run(controller.signal);
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] 启动失败: ${error.message}`);
  process.exitCode = 1;
});
