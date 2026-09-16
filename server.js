const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ✅ Using your EXACT MongoDB connection string
const dbURI = process.env.MONGO_URI || 'mongodb+srv://vidhioraofficial_db_user:sDmZKVGDWNu4vhvL@cluster0.0angzfx.mongodb.net/bootcamp_db?retryWrites=true&w=majority';

mongoose.connect(dbURI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ Database Connection Error:', err));

// --- SCHEMAS ---
const referralSchema = new mongoose.Schema({
    type: { type: String, enum: ['Ambassador', 'Organization'], required: true },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
const Referral = mongoose.model('Referral', referralSchema);

const userSchema = new mongoose.Schema({
    registrationNumber: { type: Number },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    college: { type: String, required: true },
    referralCode: { type: String, default: 'NONE' },
    transactionId: { type: String, required: true },
    amountPaid: { type: Number, required: true },
    status: { type: String, default: "Pending" },
    registrationDate: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- PUBLIC API ---
app.get('/api/event-status', async (req, res) => {
    try {
        const count = await User.countDocuments();
        let price = 599; // Final Slab
        if (count < 10) price = 449; // Early Bird
        else if (count < 40) price = 499; // Regular Phase

        const referrals = await Referral.find({ isActive: true }).select('name code type');
        res.json({ count, price, referrals });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const currentCount = await User.countDocuments();
        if (currentCount >= 50) return res.status(400).json({ success: false, message: "Bootcamp is completely sold out." });

        let basePrice = 599;
        if (currentCount < 10) basePrice = 449;
        else if (currentCount < 40) basePrice = 499;

        let finalPrice = basePrice;
        let appliedCode = req.body.referralCode;

        if (appliedCode && appliedCode !== 'NONE') {
            const isValidCode = await Referral.findOne({ code: appliedCode, isActive: true });
            if (isValidCode) finalPrice = Math.round(basePrice * 0.90);
            else appliedCode = 'NONE';
        }

        const newUser = new User({
            ...req.body,
            referralCode: appliedCode,
            registrationNumber: currentCount + 1,
            amountPaid: finalPrice
        });

        await newUser.save();
        res.json({ success: true, registrationNumber: newUser.registrationNumber });
    } catch (error) {
        res.status(500).json({ success: false, message: "Registration failed." });
    }
});

// --- ADMIN API ---
app.get('/api/admin/users', async (req, res) => {
    const users = await User.find().sort({ registrationDate: -1 });
    res.json(users);
});

app.post('/api/admin/users/:id/approve', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { status: "Confirmed" });
    res.json({ success: true });
});

app.get('/api/admin/referrals', async (req, res) => {
    const referrals = await Referral.find().sort({ createdAt: -1 }).lean();
    for (let ref of referrals) {
        const successfulUses = await User.countDocuments({ referralCode: ref.code, status: "Confirmed" });
        ref.totalUses = successfulUses;
        ref.totalEarnings = successfulUses * 25; 
    }
    res.json(referrals);
});

app.post('/api/admin/referrals', async (req, res) => {
    try {
        const newRef = new Referral(req.body);
        await newRef.save();
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: "Code already exists." });
    }
});

app.put('/api/admin/referrals/:id', async (req, res) => {
    await Referral.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive });
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Bootcamp Server running on port ${PORT}`));