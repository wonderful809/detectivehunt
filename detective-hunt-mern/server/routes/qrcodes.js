const express = require('express');
const router = express.Router();
const QrCode = require('../models/QrCode');
const Team = require('../models/Team');
const ScanLog = require('../models/ScanLog');

// GET /api/qrcodes/:qrValue
router.get('/:qrValue', async (req, res) => {
    try {
        const qr = await QrCode.findOne({ qrValue: req.params.qrValue });
        if (!qr) return res.status(404).json({ error: 'QR code not found' });
        res.json(qr);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/qrcodes/scan — process a QR scan (full game logic)
router.post('/scan', async (req, res) => {
    try {
        const { teamId, qrValue } = req.body;
        if (!teamId || !qrValue) return res.status(400).json({ error: 'teamId and qrValue are required' });

        // Refresh team
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        if (team.disqualified) return res.status(403).json({ error: 'Team is disqualified' });

        // Look up QR code
        const qrCode = await QrCode.findOne({ qrValue: qrValue.trim() });

        // NOT IN DATABASE or FAKE QR
        if (!qrCode || qrCode.qrType === 'fake') {
            await ScanLog.create({
                teamId: team._id,
                qrValue: qrValue.trim(),
                result: qrCode ? 'fake' : 'wrong',
                clueNumber: null,
            });
            return res.json({
                success: false,
                type: qrCode ? 'fake' : 'wrong',
                message: qrCode?.fakeMessage || 'This is not the right QR. Scan another QR code!',
                team,
            });
        }

        // CORRECT QR
        if (qrCode.qrType === 'correct') {
            let clueNum = qrCode.clueNumber;
            if (clueNum == null) {
                const match = qrValue.match(/HUNT-CLUE-(\d+)-CORRECT/i);
                if (match) clueNum = parseInt(match[1]);
            }

            const expectedClue = team.progress + 1;

            // Already scanned
            if (clueNum != null && clueNum <= team.progress) {
                await ScanLog.create({ teamId: team._id, qrValue: qrValue.trim(), result: 'already_scanned', clueNumber: clueNum });
                return res.json({
                    success: false,
                    type: 'already_scanned',
                    message: 'You already solved this clue! Scan another QR code.',
                    team,
                });
            }

            // Wrong order
            if (clueNum !== expectedClue) {
                await ScanLog.create({ teamId: team._id, qrValue: qrValue.trim(), result: 'wrong', clueNumber: clueNum });
                return res.json({
                    success: false,
                    type: 'wrong_order',
                    message: `Wrong order! Find clue ${expectedClue} first. Scan another QR code!`,
                    team,
                });
            }

            // ✅ CORRECT! +2 points — atomic update with progress guard to prevent race conditions
            const newProgress = expectedClue;
            const updateSet = { progress: newProgress };
            if (!team.startTime) updateSet.startTime = new Date();
            if (newProgress >= 10) updateSet.finishTime = new Date();

            const updatedTeam = await Team.findOneAndUpdate(
                { _id: team._id, progress: team.progress },  // atomic guard: only if progress hasn't changed
                { $set: updateSet, $inc: { points: 2 } },
                { new: true }
            );

            // If null, another request already processed this scan
            if (!updatedTeam) {
                await ScanLog.create({ teamId: team._id, qrValue: qrValue.trim(), result: 'already_scanned', clueNumber: clueNum });
                return res.json({ success: false, type: 'already_scanned', message: 'Already processed! Move to the next clue.', team });
            }

            await ScanLog.create({ teamId: team._id, qrValue: qrValue.trim(), result: 'success', clueNumber: clueNum });

            const message = newProgress >= 10
                ? '🎉 ALL 10 CLUES SOLVED! You cracked the case!'
                : `Clue ${clueNum} solved! You earned +2 points!`;

            return res.json({
                success: true,
                type: 'success',
                message,
                team: updatedTeam,
            });
        }

        res.status(400).json({ error: 'Invalid QR type' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
