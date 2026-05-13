import { testConnection } from '@/config/database';

async function main() {
  const ok = await testConnection();
  process.exit(ok ? 0 : 1);
}

void main();
