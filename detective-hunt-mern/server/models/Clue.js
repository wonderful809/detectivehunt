const mongoose = require('mongoose');

const clueSchema = new mongoose.Schema({
    clueNumber: { type: Number, required: true, unique: true, min: 0, max: 10 },
    clueText: { type: String, required: true },
    hint: { type: String, default: '' },
});

module.exports = mongoose.model('Clue', clueSchema);
