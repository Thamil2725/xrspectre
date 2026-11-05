import { createApp } from './app.js';
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`XRSpectre API listening on port ${config.port}`);
  console.log(config.staticDir ? `Serving frontend from ${config.staticDir}` : 'Frontend build not found — serving the API only.');

  if (config.executionProvider === 'stub') {
    console.warn('⚠️  EXECUTION_PROVIDER=stub — Run/Submit are NOT actually executing code.');
    console.warn('   Every test case will report as passed. Set EXECUTION_PROVIDER to a real provider for production.');
  }
  if (config.isProduction && config.executionProvider === 'judge0' && !process.env.JUDGE0_URL) {
    console.warn('⚠️  EXECUTION_PROVIDER=judge0 but JUDGE0_URL is not set — Run/Submit will fail until it is configured.');
  }
  if (config.isProduction && config.executionProvider === 'piston' && !process.env.PISTON_URL) {
    console.warn('⚠️  EXECUTION_PROVIDER=piston but PISTON_URL is not set — Run/Submit will fail until it is configured.');
  }
  if ((process.env.AI_EVALUATION_PROVIDER || 'stub') === 'stub') {
    console.warn('⚠️  AI_EVALUATION_PROVIDER=stub — every non-empty subjective answer receives full marks.');
  }
});

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
