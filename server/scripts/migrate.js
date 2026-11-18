// Applies pending migrations (also run automatically when the API starts).
import { migrate, pool } from '../src/db.js';

await migrate();
await pool.end();
console.log('✓ migrations up to date');
