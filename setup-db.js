require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    console.log('🔌 Connecting to Postgres database...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully!');

        console.log('📖 Reading setup.sql file...');
        const sqlPath = path.join(__dirname, 'setup.sql');
        const sqlScript = fs.readFileSync(sqlPath, 'utf8');

        // Supabase specific setup script execution
        console.log('🚀 Executing database setup script...');

        // We split by standard delimiter but we have PL/pgSQL function blocks (like $$),
        // so it is better to execute the whole script at once!
        await client.query(sqlScript);

        // After that, let's explicitly run the ALTER table command just to be absolutely certain
        console.log('🚀 Running final migration (points column)...');
        await client.query(`
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
      ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_member_count_check;
      ALTER TABLE teams ADD CONSTRAINT teams_member_count_check CHECK (member_count >= 3 AND member_count <= 4);
    `);

        console.log('🎉 Database setup completed successfully!');
    } catch (err) {
        console.error('❌ Database setup failed:');
        console.error(err.message);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

setupDatabase();
