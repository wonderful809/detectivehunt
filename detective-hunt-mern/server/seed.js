require('dotenv').config();
const mongoose = require('mongoose');
const Clue = require('./models/Clue');
const QrCode = require('./models/QrCode');
const GameState = require('./models/GameState');
const Team = require('./models/Team');

const CLUES = [
    { clueNumber: 0, clueText: 'Welcome, Detective! Your journey begins here. Look for something that watches over the entrance — it sees everyone who enters.', hint: 'Check near the main entrance or security area' },
    { clueNumber: 1, clueText: "I have four legs but cannot walk. I stay outside while others talk. I'm the quietest seat in the greenest space—find the next clue at my resting place.", hint: 'Look for a bench in the green space' },
    { clueNumber: 2, clueText: 'Leave the grass and seek the spark, head to the block named after the man who tamed the dark. Ascend to the third level of this hive, and find the door where 300 meets 23.', hint: 'Third floor, classroom 323 or near it?' },
    { clueNumber: 3, clueText: 'From the classroom to the grand stage. Seek the hall named after the Father of Indian Engineering. Where the mics are live and the speeches are tall, find the entrance to this scholarly hall.', hint: 'Find the Visvesvaraya Hall entrance' },
    { clueNumber: 4, clueText: "Brainpower requires hydration! Head to the hub of snacks and treats. Don't look at the tables or the seats—instead, find the silver flow that quenches every thirst. Your next hint is taped where the water comes first.", hint: 'Look near the water cooler/fountain at the canteen' },
    { clueNumber: 5, clueText: "Water found? Don't stop the race! Hunger now must find its place. Find the one who serves with cheer, The snack distributor standing near.", hint: 'Look for the person serving snacks/canteen staff' },
    { clueNumber: 6, clueText: 'Not food, not class, not hall this time, Look for wheels that do not climb. AP39FK7467 is the sign, — your next clue you\'ll find.', hint: 'Look for a vehicle with the license plate AP39FK7467' },
    { clueNumber: 7, clueText: 'Dream like Kalam, strong and high, Where notices hang and students pass by. Ground floor board is where you go, Your next direction waits below.', hint: 'Check the ground floor notice board near Kalam block/statue' },
    { clueNumber: 8, clueText: 'Back to science once again, Where problems are written in pen. Find where grievance drop, Your next clue makes you hop!', hint: 'Look for the grievance/complaint drop box' },
    { clueNumber: 9, clueText: 'Culture, wisdom, stage so grand, Where performances proudly stand. Collect the object placed with care, Then move ahead from there.', hint: 'Look carefully around the main stage/auditorium area' },
    { clueNumber: 10, clueText: "The one who planned this thrilling race, Find that smiling guiding face. Tell them proudly you've done your part, Victory belongs to the smart!", hint: 'Find the event organizer/coordinator to finish the hunt!' },
];

function buildQrCodes() {
    const codes = [];
    for (let i = 1; i <= 10; i++) {
        codes.push({ qrValue: `HUNT-CLUE-${i}-CORRECT`, qrType: 'correct', clueNumber: i, fakeMessage: null });
        codes.push({ qrValue: `HUNT-CLUE-${i}-FAKE-A`, qrType: 'fake', clueNumber: null, fakeMessage: 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE' });
        codes.push({ qrValue: `HUNT-CLUE-${i}-FAKE-B`, qrType: 'fake', clueNumber: null, fakeMessage: 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE' });
        codes.push({ qrValue: `HUNT-CLUE-${i}-FAKE-C`, qrType: 'fake', clueNumber: null, fakeMessage: 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE' });
    }
    return codes;
}

const SAMPLE_TEAMS = [
    { name: 'Shadow Seekers', password: 'shadow1', memberCount: 3 },
    { name: 'Code Breakers', password: 'code1', memberCount: 4 },
    { name: 'Mystery Mavens', password: 'mystery1', memberCount: 2 },
    { name: 'Clue Chasers', password: 'clue1', memberCount: 3 },
];

async function seed() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    // Game State
    console.log('🎮 Seeding game state...');
    const existing = await GameState.findOne({ key: 'main' });
    if (!existing) {
        await GameState.create({ key: 'main', isRunning: false });
        console.log('   ✅ Game state created');
    } else {
        console.log('   ✅ Game state already exists');
    }

    // Clues
    console.log('📋 Seeding clues...');
    for (const clue of CLUES) {
        await Clue.findOneAndUpdate({ clueNumber: clue.clueNumber }, clue, { upsert: true });
    }
    console.log(`   ✅ ${CLUES.length} clues upserted`);

    // QR Codes
    console.log('📱 Seeding QR codes...');
    const qrCodes = buildQrCodes();
    for (const qr of qrCodes) {
        await QrCode.findOneAndUpdate({ qrValue: qr.qrValue }, qr, { upsert: true });
    }
    console.log(`   ✅ ${qrCodes.length} QR codes upserted`);

    // Sample Teams
    console.log('👥 Seeding sample teams...');
    for (const team of SAMPLE_TEAMS) {
        await Team.findOneAndUpdate({ name: team.name }, team, { upsert: true });
    }
    console.log(`   ✅ ${SAMPLE_TEAMS.length} sample teams upserted`);

    console.log('\n🎉 Seed complete!');
    console.log('\nDefault teams:');
    SAMPLE_TEAMS.forEach(t => console.log(`   ${t.name} → password: ${t.password} (${t.memberCount} members)`));

    await mongoose.disconnect();
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
