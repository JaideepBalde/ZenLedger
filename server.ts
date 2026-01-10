import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import { UserRole, TransactionType, TransactionCategory, RequestStatus } from './database/types';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zenledger';
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to MongoDB with proper error handling (skip in test environment)
if (NODE_ENV !== 'test') {
  mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

// User Schema with proper validation
interface IUser extends mongoose.Document {
  familyId: string;
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>({
  familyId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 50
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  password: { type: String, required: true, minlength: 8 },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: true
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

// Password hashing will be done manually in the signup route to avoid pre-save hook issues in tests

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for performance
userSchema.index({ familyId: 1, username: 1 });
userSchema.index({ username: 1 }, { unique: true });

const UserModel = mongoose.model<IUser>('User', userSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: Object.values(TransactionType), required: true },
  category: { type: String, enum: Object.values(TransactionCategory), required: true },
  description: { type: String, required: true },
  timestamp: { type: Number, required: true }
});

const TransactionModel = mongoose.model('Transaction', transactionSchema);

// Money Request Schema
const requestSchema = new mongoose.Schema({
  childId: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: Object.values(RequestStatus), default: RequestStatus.PENDING },
  timestamp: { type: Number, required: true }
});

const RequestModel = mongoose.model('MoneyRequest', requestSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  familyId: { type: String, required: true },
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, required: true },
  isRead: { type: Boolean, default: false },
  replyToId: { type: String }
});

const MessageModel = mongoose.model('FamilyMessage', messageSchema);

// Express app setup
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://esm.sh", "https://cdn.tailwindcss.com"],
      connectSrc: ["'self'", "http://localhost:3001"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'test' ? 1000 : 5, // Allow many requests in test environment
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
if (NODE_ENV !== 'test') {
  app.use('/api/auth', authLimiter);
}

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, error: 'Token expired' });
        }
        return res.status(403).json({ success: false, error: 'Invalid token' });
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles: UserRole[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
};

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e: any) => e.message);
    return res.status(400).json({ success: false, error: errors.join(', ') });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({ success: false, error: 'Duplicate entry found' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// --- AUTH ROUTES ---
app.post('/api/auth/signup', [
  body('familyId').trim().isLength({ min: 3, max: 50 }).withMessage('Family ID must be 3-50 characters'),
  body('handle').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-30 characters, letters/numbers/underscore only'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { familyId, handle, password } = req.body;

    const existingUser = await UserModel.findOne({
      $or: [
        { username: handle.toLowerCase().trim() },
        { familyId: familyId.toLowerCase().trim() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username or Family ID already exists' });
    }

    // Hash password manually
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new UserModel({
      familyId: familyId.trim().toLowerCase(),
      username: handle.trim().toLowerCase(),
      password: hashedPassword,
      role: UserRole.PARENT
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, familyId: user.familyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      userId: user._id,
      familyId: user.familyId,
      role: user.role,
      exp: Date.now() + 86400000,
      data: {
        id: user._id,
        familyId: user.familyId,
        username: user.username,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/auth/login', [
  body('familyId').trim().notEmpty().withMessage('Family ID is required'),
  body('handle').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { familyId, handle, password } = req.body;

    const user = await UserModel.findOne({
      familyId: familyId.trim().toLowerCase(),
      username: handle.trim().toLowerCase()
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, error: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { userId: user._id, familyId: user.familyId, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      token,
      userId: user._id,
      familyId: user.familyId,
      role: user.role,
      exp: Date.now() + 86400000
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// --- USER ROUTES ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await UserModel.find({ familyId: req.user.familyId });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== UserRole.PARENT) return res.status(403).json({ success: false, error: 'Unauthorized' });

  const { username, password, role } = req.body;
  try {
    const user = new UserModel({
      familyId: req.user.familyId,
      username: username.trim().toLowerCase(),
      password,
      role
    });
    await user.save();
    res.json({ success: true, data: user });
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Username already exists' });
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// --- TRANSACTION ROUTES ---
app.get('/api/transactions', [
  authenticateToken,
  body('userIds').optional().isArray().withMessage('userIds must be an array'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { userIds = [] } = req.body;

    // Ensure users can only see transactions from their family
    const familyUsers = await UserModel.find({ familyId: req.user.familyId }, '_id');
    const familyUserIds = familyUsers.map(u => u._id.toString());

    const allowedUserIds = userIds.length > 0
      ? userIds.filter((id: string) => familyUserIds.includes(id))
      : familyUserIds;

    const transactions = await TransactionModel.find({
      userId: { $in: allowedUserIds }
    }).sort({ timestamp: -1 }).limit(1000); // Limit results

    res.json({ success: true, data: transactions });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve transactions' });
  }
});

app.post('/api/transactions', [
  authenticateToken,
  body('userId').isMongoId().withMessage('Invalid user ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('type').isIn(Object.values(TransactionType)).withMessage('Invalid transaction type'),
  body('category').isIn(Object.values(TransactionCategory)).withMessage('Invalid category'),
  body('description').trim().isLength({ min: 1, max: 200 }).withMessage('Description must be 1-200 characters'),
  body('timestamp').optional().isInt().withMessage('Invalid timestamp'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { userId, amount, type, category, description, timestamp } = req.body;

    // Verify the userId belongs to the same family
    const targetUser = await UserModel.findOne({
      _id: userId,
      familyId: req.user.familyId
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found in your family' });
    }

    // Only allow parents to create transactions for others, or users for themselves
    if (req.user.role !== UserRole.PARENT && req.user.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Can only create transactions for yourself' });
    }

    const transaction = new TransactionModel({
      userId,
      amount: parseFloat(amount),
      type,
      category,
      description: description.trim(),
      timestamp: timestamp || Date.now()
    });

    await transaction.save();

    res.status(201).json({ success: true, data: transaction });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ success: false, error: 'Failed to create transaction' });
  }
});

// --- REQUEST ROUTES ---
app.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await RequestModel.find();
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.post('/api/requests', authenticateToken, async (req, res) => {
  if (req.user.role !== UserRole.CHILD) return res.status(403).json({ success: false, error: 'Unauthorized' });

  const { childId, amount, reason, timestamp } = req.body;
  try {
    const request = new RequestModel({
      childId,
      amount,
      reason,
      timestamp
    });
    await request.save();
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== UserRole.PARENT) return res.status(403).json({ success: false, error: 'Unauthorized' });

  const { status } = req.body;
  try {
    const request = await RequestModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// --- MESSAGE ROUTES ---
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await MessageModel.find({
      familyId: req.user.familyId,
      $or: [
        { fromId: req.user.userId },
        { toId: req.user.userId },
        { toId: 'cluster' } // Broadcast messages
      ]
    })
      .populate('fromId', 'username role')
      .populate('toId', 'username role')
      .sort({ timestamp: -1 })
      .limit(500);

    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve messages' });
  }
});

app.post('/api/messages', [
  authenticateToken,
  body('toId').notEmpty().withMessage('Recipient is required'),
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
  body('replyToId').optional().isMongoId().withMessage('Invalid reply ID'),
  body('timestamp').optional().isInt().withMessage('Invalid timestamp'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { toId, text, replyToId, timestamp } = req.body;

    // Verify recipient exists in the same family (unless it's a broadcast)
    if (toId !== 'cluster') {
      const recipient = await UserModel.findOne({
        _id: toId,
        familyId: req.user.familyId
      });

      if (!recipient) {
        return res.status(404).json({ success: false, error: 'Recipient not found in your family' });
      }
    }

    // If replying to a message, verify it exists and belongs to the conversation
    if (replyToId) {
      const replyToMessage = await MessageModel.findOne({
        _id: replyToId,
        familyId: req.user.familyId,
        $or: [
          { fromId: req.user.userId },
          { toId: req.user.userId },
          { toId: 'cluster' }
        ]
      });

      if (!replyToMessage) {
        return res.status(404).json({ success: false, error: 'Reply message not found' });
      }
    }

    const message = new MessageModel({
      familyId: req.user.familyId,
      fromId: req.user.userId,
      toId,
      text: text.trim(),
      timestamp: timestamp || Date.now(),
      replyToId,
      isRead: false
    });

    await message.save();

    // Populate sender and recipient info
    await message.populate('fromId', 'username role');
    if (toId !== 'cluster') {
      await message.populate('toId', 'username role');
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

app.put('/api/messages/:id/read', [
  authenticateToken,
  body('id').isMongoId().withMessage('Invalid message ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    // Find the message and verify user can access it
    const message = await MessageModel.findOne({
      _id: req.params.id,
      familyId: req.user.familyId,
      $or: [
        { toId: req.user.userId },
        { toId: 'cluster' }
      ]
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (message.fromId.toString() === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Cannot mark your own message as read' });
    }

    message.isRead = true;
    await message.save();

    await message.populate('fromId', 'username role');
    await message.populate('toId', 'username role');

    res.json({ success: true, data: message });
  } catch (err) {
    console.error('Mark message read error:', err);
    res.status(500).json({ success: false, error: 'Failed to mark message as read' });
  }
});

// --- AUDIT ROUTES ---
app.get('/api/audit', authenticateToken, async (req, res) => {
  // In a real app, you'd have an AuditEntry model
  res.json({ success: true, data: [] });
});

app.post('/api/audit', authenticateToken, async (req, res) => {
  const { action, metadata } = req.body;
  // Log audit entry (in production, save to database)
  console.log(`Audit: ${req.user.userId} - ${action}`, metadata);
  res.json({ success: true });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// 404 handler for undefined routes (skip in test environment to avoid path-to-regexp issues)
if (NODE_ENV !== 'test') {
  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (NODE_ENV === 'development') {
    process.exit(1);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start server (skip in test environment)
let server: any;
if (NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  });
}

// Export for testing
export { app, server, UserModel };
