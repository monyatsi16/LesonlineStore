import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const rec = await pool.query('select count(*)::int as c from price_recommendations');
  const latest = await pool.query('select id,user_id,product_id,current_price,recommended_price,confidence,created_at from price_recommendations order by created_at desc limit 5');
  console.log(JSON.stringify({ recommendationCount: rec.rows[0]?.c ?? 0, latest: latest.rows }, null, 2));
} catch (error) {
  console.error(error);
} finally {
  await pool.end();
}
