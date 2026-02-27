-- =============================================
-- QR TREASURE HUNT - Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- Game state: single-row table controlling the game
CREATE TABLE IF NOT EXISTS game_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_running BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO game_state (id, is_running) VALUES (1, false) ON CONFLICT DO NOTHING;

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '1234',
  member_count INT NOT NULL DEFAULT 2 CHECK (member_count >= 2 AND member_count <= 4),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 10),
  start_time TIMESTAMPTZ,
  finish_time TIMESTAMPTZ,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clues (0 to 9)
CREATE TABLE IF NOT EXISTS clues (
  id SERIAL PRIMARY KEY,
  clue_number INT UNIQUE NOT NULL CHECK (clue_number >= 0 AND clue_number <= 9),
  clue_text TEXT NOT NULL,
  hint TEXT
);

-- QR Codes
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_value TEXT UNIQUE NOT NULL,
  qr_type TEXT NOT NULL CHECK (qr_type IN ('correct', 'fake')),
  clue_number INT REFERENCES clues(clue_number),
  fake_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scan logs
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  qr_value TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'fake', 'wrong', 'already_scanned')),
  clue_number INT,
  scanned_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scan_logs_team ON scan_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON scan_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_progress ON teams(progress DESC);
CREATE INDEX IF NOT EXISTS idx_qr_codes_value ON qr_codes(qr_value);

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

-- game_state: anyone can read, only service role can write
CREATE POLICY "Anyone can read game state" ON game_state FOR SELECT USING (true);
CREATE POLICY "Service role can update game state" ON game_state FOR UPDATE USING (true);
CREATE POLICY "Service role can insert game state" ON game_state FOR INSERT WITH CHECK (true);

-- teams: anyone can read (leaderboard), service role manages
CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Anyone can insert teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete teams" ON teams FOR DELETE USING (true);

-- clues: anyone can read
CREATE POLICY "Anyone can read clues" ON clues FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clues" ON clues FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clues" ON clues FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete clues" ON clues FOR DELETE USING (true);

-- qr_codes: anyone can read
CREATE POLICY "Anyone can read qr_codes" ON qr_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert qr_codes" ON qr_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update qr_codes" ON qr_codes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete qr_codes" ON qr_codes FOR DELETE USING (true);

-- scan_logs: anyone can read and insert
CREATE POLICY "Anyone can read scan_logs" ON scan_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert scan_logs" ON scan_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete scan_logs" ON scan_logs FOR DELETE USING (true);

-- =============================================
-- Enable Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE scan_logs;

-- =============================================
-- Seed Data: Sample Clues
-- =============================================
INSERT INTO clues (clue_number, clue_text, hint) VALUES
(0, 'Welcome, Detective! Your journey begins here. Look for something that watches over the entrance — it sees everyone who enters.', 'Check near the main entrance or security area'),
(1, 'I have four legs but cannot walk. I stay outside while others talk. I’m the quietest seat in the greenest space—find the next clue at my resting place.', 'Look for a bench in the green space'),
(2, 'Leave the grass and seek the spark, head to the block named after the man who tamed the dark. Ascend to the third level of this hive, and find the door where 300 meets 23.', 'Third floor, classroom 323 or near it?'),
(3, 'From the classroom to the grand stage. Seek the hall named after the Father of Indian Engineering. Where the mics are live and the speeches are tall, find the entrance to this scholarly hall.', 'Find the Visvesvaraya Hall entrance'),
(4, 'Brainpower requires hydration! Head to the hub of snacks and treats. Don''t look at the tables or the seats—instead, find the silver flow that quenches every thirst. Your next hint is taped where the water comes first.', 'Look near the water cooler/fountain at the canteen'),
(5, 'Water found? Don’t stop the race! Hunger now must find its place. Find the one who serves with cheer, The snack distributor standing near.', 'Look for the person serving snacks/canteen staff'),
(6, 'Not food, not class, not hall this time, Look for wheels that do not climb. AP39FK7467 is the sign, — your next clue you’ll find.', 'Look for a vehicle with the license plate AP39FK7467'),
(7, 'Dream like Kalam, strong and high, Where notices hang and students pass by. Ground floor board is where you go, Your next direction waits below.', 'Check the ground floor notice board near Kalam block/statue'),
(8, 'Back to science once again, Where problems are written in pen. Find where grievance drop, Your next clue makes you hop!', 'Look for the grievance/complaint drop box'),
(9, 'Culture, wisdom, stage so grand, Where performances proudly stand. Collect the object placed with care, Then move ahead from there.', 'Look carefully around the main stage/auditorium area'),
(10, 'The one who planned this thrilling race, Find that smiling guiding face. Tell them proudly you’ve done your part, Victory belongs to the smart!', 'Find the event organizer/coordinator to finish the hunt!')
ON CONFLICT (clue_number) DO NOTHING;

-- =============================================
-- Seed Data: QR Codes (1 correct + 3 fakes per clue)
-- =============================================
INSERT INTO qr_codes (qr_value, qr_type, clue_number, fake_message) VALUES
-- Clue 1 (Progress 0 -> 1)
('HUNT-CLUE-1-CORRECT', 'correct', 1, NULL),
('HUNT-CLUE-1-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-1-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-1-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 2 (Progress 1 -> 2)
('HUNT-CLUE-2-CORRECT', 'correct', 2, NULL),
('HUNT-CLUE-2-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-2-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-2-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 3 (Progress 2 -> 3)
('HUNT-CLUE-3-CORRECT', 'correct', 3, NULL),
('HUNT-CLUE-3-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-3-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-3-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 4 (Progress 3 -> 4)
('HUNT-CLUE-4-CORRECT', 'correct', 4, NULL),
('HUNT-CLUE-4-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-4-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-4-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 5 (Progress 4 -> 5)
('HUNT-CLUE-5-CORRECT', 'correct', 5, NULL),
('HUNT-CLUE-5-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-5-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-5-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 6 (Progress 5 -> 6)
('HUNT-CLUE-6-CORRECT', 'correct', 6, NULL),
('HUNT-CLUE-6-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-6-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-6-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 7 (Progress 6 -> 7)
('HUNT-CLUE-7-CORRECT', 'correct', 7, NULL),
('HUNT-CLUE-7-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-7-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-7-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 8 (Progress 7 -> 8)
('HUNT-CLUE-8-CORRECT', 'correct', 8, NULL),
('HUNT-CLUE-8-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-8-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-8-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 9 (Progress 8 -> 9)
('HUNT-CLUE-9-CORRECT', 'correct', 9, NULL),
('HUNT-CLUE-9-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-9-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-9-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),

-- Clue 10 (Progress 9 -> 10)
('HUNT-CLUE-10-CORRECT', 'correct', 10, NULL),
('HUNT-CLUE-10-FAKE-A', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-10-FAKE-B', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE'),
('HUNT-CLUE-10-FAKE-C', 'fake', NULL, 'IT IS NOT A CORRECT QR CODE SEARCH FOR NEXT QR CODE')
ON CONFLICT (qr_value) DO NOTHING;

-- =============================================
-- Seed Data: Sample Teams
-- =============================================
INSERT INTO teams (name, password, member_count) VALUES
('Shadow Seekers', 'shadow1', 3),
('Code Breakers', 'code1', 4),
('Mystery Mavens', 'mystery1', 2),
('Clue Chasers', 'clue1', 3)
ON CONFLICT (name) DO NOTHING;
