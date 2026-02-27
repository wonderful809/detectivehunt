const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:ylksifkHTwo6B75n@db.deumynymzuxtwvzbbbwi.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});
async function check() {
    await client.connect();
    const res = await client.query("SELECT * FROM teams WHERE name = 'TestPuppeteerTeam'");
    console.log('Database returned:', res.rows);
    await client.end();
}
check();
