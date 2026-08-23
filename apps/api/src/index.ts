import { buildServer } from './server.js';
import { config } from '@faultforge/config';
import { disconnectPrisma, disconnectRedis } from '@faultforge/database';

async function start() {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info(`[FaultForge API] Received ${signal}. Starting graceful shutdown...`);
    try {
      await app.close();
      await disconnectPrisma();
      await disconnectRedis();
      app.log.info('[FaultForge API] Graceful shutdown completed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, '[FaultForge API] Error during graceful shutdown.');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`[FaultForge API] Gateway running on http://${config.HOST}:${config.PORT}`);
    app.log.info(
      `[FaultForge API] Swagger documentation available at http://${config.HOST}:${config.PORT}/docs`,
    );
  } catch (err) {
    app.log.error({ err }, '[FaultForge API] Fatal error starting server.');
    process.exit(1);
  }
}

start();
