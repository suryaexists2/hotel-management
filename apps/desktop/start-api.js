process.env.DATABASE_URL = 'file:./innsight.db';
process.env.NODE_ENV = 'production';
process.env.PORT = '4567';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-!!!!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4567/api/v1';
process.env.LOG_LEVEL = 'error';
process.env.ELECTRON_RUN = 'true';
process.env.ELECTRON_ROOT = path.resolve(process.cwd(), '..', '..');
process.env.NODE_PATH = process.env.NODE_PATH || '';

const fs = require('fs');
try { fs.unlinkSync('./innsight.db'); } catch {}
try { fs.unlinkSync('./innsight.db-wal'); } catch {}
try { fs.unlinkSync('./innsight.db-shm'); } catch {}

const app = require('./dist/main/api-bundle.cjs').default;
app.listen(4567, '127.0.0.1', () => {
  console.log('READY');
});
