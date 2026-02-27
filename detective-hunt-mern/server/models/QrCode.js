const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
    qrValue: { type: String, required: true, unique: true },
    qrType: { type: String, required: true, enum: ['correct', 'fake'] },
    clueNumber: { type: Number, default: null },
    fakeMessage: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('QrCode', qrCodeSchema);
