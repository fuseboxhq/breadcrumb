import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import {
  installsDateIdx,
  heartbeatsDateIdx,
  heartbeatsMachineIdx,
  commandsDateIdx,
  commandsNameIdx,
} from './schema';

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  const indexes = [installsDateIdx, heartbeatsDateIdx, heartbeatsMachineIdx, commandsDateIdx, commandsNameIdx];
  for (const idx of indexes) {
    await sql.query(idx);
    console.log(`Applied: ${idx.split(' ON ')[1]}`);
  }
  console.log('All indexes created.');
}

run().catch(console.error);
