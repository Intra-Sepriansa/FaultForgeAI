import { WorkerServer } from './server.js';
import { disconnectPrisma, disconnectRedis } from '@faultforge/database';

async function main() {
  const server = new WorkerServer();
  await server.start();

  const shutdown = async (signal: string) => {
    console.info(`[FaultForge Worker] Received ${signal}. Starting graceful shutdown...`);
    await server.stop();
    await disconnectPrisma();
    await disconnectRedis();
    console.info('[FaultForge Worker] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[FaultForge Worker] Fatal error in worker process:', err);
  process.exit(1);
});
