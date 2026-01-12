
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { UserRole, RequestStatus, TransactionType } from './types';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "ZENLEDGER_INSTITUTIONAL_SECRET";
const MONGO_URI = process.env.MONGO_URI;

app.use(cors() as any);
app.use(express.json() as any);

// --- DB MODELS ---
const UserSchema = new mongoose.Schema({
  familyId: { type: String, required: true, lowercase: true, trim: true },
  username: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  isActive: { type: Boolean, default: true }
});
UserSchema.index({ familyId: 1, username: 1 }, { unique: true });
const UserModel = mongoose.model('User', UserSchema);

// --- ROUTES ---
app.post('/auth/signup', async (req, res) => {
  try {
    const { familyId, handle, password } = req.body;
    // Updated UserRole.PARENT to UserRole.HOST to match the defined UserRole enum in types.ts
    const user = new UserModel({ familyId, username: handle, password, role: UserRole.HOST });
    await user.save();
    res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Identity already exists in this cluster.' });
    res.status(500).json({ success: false, error: 'Internal Cluster Fault.' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { familyId, handle, password } = req.body;
  const user = await UserModel.findOne({ 
    familyId: familyId.trim().toLowerCase(), 
    username: handle.trim().toLowerCase(), 
    password 
  });
  
  if (!user) return res.status(401).json({ success: false, error: 'Authorization Denied. Verify credentials.' });
  
  const token = jwt.sign({ userId: user._id, familyId: user.familyId, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token, userId: user._id, familyId: user.familyId, role: user.role, exp: Date.now() + 86400000 });
});

// Start Server
if (MONGO_URI) {
  mongoose.connect(MONGO_URI).then(() => {
    app.listen(PORT, () => console.log(`ZenLedger Node active on port ${PORT}`));
  }).catch(err => console.error('Database connection failed:', err));
} else {
  console.warn("MONGO_URI not found. Server running in disconnected mode for testing.");
  app.listen(PORT);
}
