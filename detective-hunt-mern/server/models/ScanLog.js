const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema({
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    qrValue: { type: String, required: true },
    result: { type: String, required: true, enum: ['success', 'fake', 'wrong', 'already_scanned'] },
    clueNumber: { type: Number, default: null },
    scannedAt: { type: Date, default: Date.now },
});

scanLogSchema.index({ teamId: 1 });
scanLogSchema.index({ scannedAt: -1 });

module.exports = mongoose.model('ScanLog', scanLogSchema);
