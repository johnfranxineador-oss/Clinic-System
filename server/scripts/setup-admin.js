const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');
const { hash } = require('../utils/password');
(async () => {
  try {
    await connectDB();
    const existing = await User.findOne({ username: 'admin' });
    if (existing) { console.log('Admin already exists; no changes made.'); return; }
    const password = process.env.INITIAL_ADMIN_PASSWORD || randomBytes(18).toString('base64url');
    if (password.length < 8 || password.length > 128) throw new Error('Password must have 8 to 128 characters');
    await User.create({ username: 'admin', passwordHash: await hash(password),
      studentEmployeeId: 'SYS-ADMIN', fullName: 'Infirmary Administrator',
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@cvsu.edu.ph',
      role: 'admin', contactNumber: process.env.INITIAL_ADMIN_PHONE || '09171234567' });
    console.log('Initial account created. Username: admin');
    if (!process.env.INITIAL_ADMIN_PASSWORD) console.log(`Generated password: ${password}`);
    console.log('Update the administrator contact details before use.');
  } catch (_) { console.error('Admin setup failed. Check MongoDB, account uniqueness, and initial password settings.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
