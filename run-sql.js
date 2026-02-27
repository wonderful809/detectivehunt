// Direct PostgreSQL setup - run: npx -y node-pg-migrate up || node run-sql.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:ylksifkHTwo6B75n@db.deumynymzuxtwvzbbbwi.supabase.co:5432/postgres';

async function run() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!');

    const sql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');

    console.log('🚀 Running setup.sql...');
    try {
        await client.query(sql);
        console.log('✅ All tables, policies, and seed data created successfully!');
    } catch (err) {
        console.error('❌ Error:', err.message);
        // Try individual statements
        console.log('\\n🔄 Trying statements individually...');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('--'));
        let success = 0, fail = 0;
        for (const stmt of statements) {
            try {
                await client.query(stmt + ';');
                success++;
            } catch (e) {
                if (e.message.includes('already exists') || e.message.includes('duplicate')) {
                    success++;
                } else {
                    console.error(`   ⚠️ ${e.message.substring(0, 80)}`);
                    fail++;
                }
            }
        }
        console.log(`\\n📊 Results: ${success} succeeded, ${fail} failed`);
    }

    // Verify
    const { rows: teams } = await client.query('SELECT name, member_count FROM teams ORDER BY name');
    console.log('\\n👥 Teams in database:');
    teams.forEach(t => console.log(`   - ${t.name} (${t.member_count} members)`));

    const { rows: clues } = await client.query('SELECT count(*) as c FROM clues');
    console.log(`📋 Clues: ${clues[0].c}`);

    const { rows: qr } = await client.query('SELECT count(*) as c FROM qr_codes');
    console.log(`📱 QR codes: ${qr[0].c}`);

    await client.end();
    console.log('\\n🎉 Setup complete! You can now open index.html');
}

run().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
