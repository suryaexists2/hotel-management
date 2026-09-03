import app from './app.js';
import { env } from './config/env.js';
import { prisma } from '@innsight/database';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 InnSight API Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    console.log('HTTP Server closed.');
    
    try {
      await prisma.$disconnect();
      console.log('Database connection disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error disconnecting database during shutdown:', err);
      process.exit(1);
    }
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort safety nets: log and exit so a supervisor can restart cleanly rather
// than leaving the process in an undefined state.
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled promise rejection:', reason);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught exception:', err);
  shutdown('uncaughtException');
});
