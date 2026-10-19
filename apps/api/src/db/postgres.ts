import pg from 'pg';

import { env } from '../config/env.js';

export const postgres = new pg.Pool({ connectionString: env.DATABASE_URL });
