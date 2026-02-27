// Quick database setup script using https module
// Run: node db-setup.js

const https = require('https');

const SUPABASE_URL = 'https://deumynymzuxtwvzbbbwi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldW15bnltenV4dHd2emJiYndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODA3OTYsImV4cCI6MjA4NzY1Njc5Nn0.tZ60n0tu-1timvsQ__GceDl2IzSY8vGFARHA0gSxY7I';

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SUPABASE_URL);
        const data = body ? JSON.stringify(body) : null;

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': method === 'POST' ? 'return=representation,resolution=ignore-duplicates' : 'return=representation',
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null, ok: res.statusCode >= 200 && res.statusCode < 300 });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, ok: res.statusCode >= 200 && res.statusCode < 300 });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function setup() {
    console.log('🔍 Checking connection to Supabase...');

    // 1. Check if tables exist by trying to query teams
    const checkRes = await request('GET', '/rest/v1/teams?select=id&limit=1');

    if (!checkRes.ok) {
        if (checkRes.status === 404 || (typeof checkRes.data === 'object' && checkRes.data?.message?.includes('relation'))) {
            console.log('❌ Tables do not exist yet!');
            console.log('   You need to create them first using setup.sql');
            console.log('');
            console.log('   Quick option: Go to your Supabase project dashboard:');
            console.log('   https://supabase.com/dashboard/project/deumynymzuxtwvzbbbwi');
            console.log('   Click "SQL Editor" in the left menu, paste setup.sql contents, and click Run');
            return;
        }
        console.log(`❌ Error checking tables: ${checkRes.status}`, checkRes.data);
        return;
    }

    console.log('✅ Connected! Tables exist.');

    // Check if data already present
    const existingTeams = Array.isArray(checkRes.data) ? checkRes.data : [];

    // 2. Check game_state
    console.log('🎮 Checking game state...');
    const gsCheck = await request('GET', '/rest/v1/game_state?id=eq.1');
    if (gsCheck.ok && Array.isArray(gsCheck.data) && gsCheck.data.length === 0) {
        const gsRes = await request('POST', '/rest/v1/game_state', [{ id: 1, is_running: false }]);
        console.log(gsRes.ok ? '   ✅ Game state initialized' : `   ⚠️ Game state: ${gsRes.status} ${JSON.stringify(gsRes.data)}`);
    } else {
        console.log('   ✅ Game state already exists');
    }

    // 3. Seed clues
    console.log('📋 Checking clues...');
    const clueCheck = await request('GET', '/rest/v1/clues?select=clue_number');
    const existingClues = (clueCheck.ok && Array.isArray(clueCheck.data)) ? clueCheck.data.length : 0;

    if (existingClues < 10) {
        const clues = [
            { clue_number: 0, clue_text: 'Welcome, Detective! Your journey begins here. Look for something that watches over the entrance — it sees everyone who enters.', hint: 'Check near the main entrance or security area' },
            { clue_number: 1, clue_text: 'Every great mystery needs knowledge. Find where stories are kept in neat rows, waiting to be discovered.', hint: 'Books are arranged on shelves...' },
            { clue_number: 2, clue_text: 'Where people gather to share ideas and debates echo off the walls. Your next clue awaits where voices carry.', hint: 'A meeting room or auditorium perhaps?' },
            { clue_number: 3, clue_text: 'Liquid courage for the mind — where steam rises and energy flows. The aroma will guide you.', hint: 'Follow the smell of coffee or tea' },
            { clue_number: 4, clue_text: 'Tick tock, the hands move in circles. Find the guardian of time that stands tall for all to see.', hint: 'Look for a large clock' },
            { clue_number: 5, clue_text: 'Nature finds a way even indoors. Seek the green oasis in this concrete jungle.', hint: 'Indoor plants or a garden area' },
            { clue_number: 6, clue_text: 'Art speaks louder than words. Find where creativity is displayed for wandering eyes.', hint: 'Look for artwork or a display wall' },
            { clue_number: 7, clue_text: 'The place where echoes of footsteps multiply. Go where paths cross and decisions are made.', hint: 'A stairwell or corridor intersection' },
            { clue_number: 8, clue_text: 'Almost there! Find the spot where achievements are celebrated and memories hang on walls.', hint: 'Trophy case or awards display' },
            { clue_number: 9, clue_text: 'The final frontier! Return to where it all began, but look UP this time. The treasure is revealed!', hint: 'Look above at the starting location' },
        ];
        const clueRes = await request('POST', '/rest/v1/clues', clues);
        console.log(clueRes.ok ? '   ✅ 10 clues inserted' : `   ⚠️ Clues: ${clueRes.status} ${JSON.stringify(clueRes.data)}`);
    } else {
        console.log(`   ✅ ${existingClues} clues already exist`);
    }

    // 4. Seed QR codes
    console.log('📱 Checking QR codes...');
    const qrCheck = await request('GET', '/rest/v1/qr_codes?select=qr_value');
    const existingQR = (qrCheck.ok && Array.isArray(qrCheck.data)) ? qrCheck.data.length : 0;

    if (existingQR < 20) {
        const qrCodes = [
            { qr_value: 'HUNT-CLUE-001', qr_type: 'correct', clue_number: 1 },
            { qr_value: 'HUNT-CLUE-002', qr_type: 'correct', clue_number: 2 },
            { qr_value: 'HUNT-CLUE-003', qr_type: 'correct', clue_number: 3 },
            { qr_value: 'HUNT-CLUE-004', qr_type: 'correct', clue_number: 4 },
            { qr_value: 'HUNT-CLUE-005', qr_type: 'correct', clue_number: 5 },
            { qr_value: 'HUNT-CLUE-006', qr_type: 'correct', clue_number: 6 },
            { qr_value: 'HUNT-CLUE-007', qr_type: 'correct', clue_number: 7 },
            { qr_value: 'HUNT-CLUE-008', qr_type: 'correct', clue_number: 8 },
            { qr_value: 'HUNT-CLUE-009', qr_type: 'correct', clue_number: 9 },
            { qr_value: 'HUNT-CLUE-010', qr_type: 'correct', clue_number: 0 },
            { qr_value: 'HUNT-FAKE-001', qr_type: 'fake', fake_message: '🕵️ Nice try, Detective! But this is a decoy! Keep searching...' },
            { qr_value: 'HUNT-FAKE-002', qr_type: 'fake', fake_message: '🎭 You\'ve been bamboozled! This clue is faker than a three-dollar bill!' },
            { qr_value: 'HUNT-FAKE-003', qr_type: 'fake', fake_message: '🐾 Wrong trail, Sherlock! The real clue is elsewhere...' },
            { qr_value: 'HUNT-FAKE-004', qr_type: 'fake', fake_message: '🎪 Welcome to the circus of wrong answers! Try again!' },
            { qr_value: 'HUNT-FAKE-005', qr_type: 'fake', fake_message: '👻 BOO! This is a ghost clue — it doesn\'t exist! Keep looking!' },
            { qr_value: 'HUNT-FAKE-006', qr_type: 'fake', fake_message: '🦆 Quack! You found a rubber duck, not a clue! 🦆' },
            { qr_value: 'HUNT-FAKE-007', qr_type: 'fake', fake_message: '🍕 This QR was just ordering pizza. No clue here!' },
            { qr_value: 'HUNT-FAKE-008', qr_type: 'fake', fake_message: '🤖 Error 404: Clue not found. Try scanning something else!' },
            { qr_value: 'HUNT-FAKE-009', qr_type: 'fake', fake_message: '🎵 Never gonna give you up, never gonna let you find the clue here!' },
            { qr_value: 'HUNT-FAKE-010', qr_type: 'fake', fake_message: '🧙‍♂️ A wizard placed this fake clue. You shall not pass...' },
        ];
        const qrRes = await request('POST', '/rest/v1/qr_codes', qrCodes);
        console.log(qrRes.ok ? '   ✅ 20 QR codes inserted' : `   ⚠️ QR codes: ${qrRes.status} ${JSON.stringify(qrRes.data)}`);
    } else {
        console.log(`   ✅ ${existingQR} QR codes already exist`);
    }

    // 5. Seed teams
    console.log('👥 Checking teams...');
    const teamCheck = await request('GET', '/rest/v1/teams?select=name');
    const existingTeamCount = (teamCheck.ok && Array.isArray(teamCheck.data)) ? teamCheck.data.length : 0;

    if (existingTeamCount === 0) {
        const teams = [
            { name: 'Shadow Seekers', password: 'shadow1', member_count: 3 },
            { name: 'Code Breakers', password: 'code1', member_count: 4 },
            { name: 'Mystery Mavens', password: 'mystery1', member_count: 2 },
            { name: 'Clue Chasers', password: 'clue1', member_count: 3 },
        ];
        const teamRes = await request('POST', '/rest/v1/teams', teams);
        console.log(teamRes.ok ? '   ✅ 4 teams inserted' : `   ⚠️ Teams: ${teamRes.status} ${JSON.stringify(teamRes.data)}`);
    } else {
        console.log(`   ✅ ${existingTeamCount} teams already exist`);
        if (teamCheck.data) {
            teamCheck.data.forEach(t => console.log(`      - ${t.name}`));
        }
    }

    console.log('');
    console.log('🎉 Setup complete! Your treasure hunt is ready.');
    console.log('');
    console.log('Default teams:');
    console.log('   Shadow Seekers  → password: shadow1  (3 members)');
    console.log('   Code Breakers   → password: code1    (4 members)');
    console.log('   Mystery Mavens  → password: mystery1 (2 members)');
    console.log('   Clue Chasers    → password: clue1    (3 members)');
}

setup().catch(err => {
    console.error('❌ Setup failed:', err.message);
});
