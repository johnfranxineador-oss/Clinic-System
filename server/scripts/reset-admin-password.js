const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { randomBytes } = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');
const { hash } = require('../utils/password');

(async () => {
  try {
    const password = randomBytes(18).toString('base64url');
    await connectDB();
    const user = await User.findOneAndUpdate(
      { username: 'admin', role: 'admin' },
      { $set: { passwordHash: await hash(password) } },
      { new: true, runValidators: true }
    );
    if (!user) {
      console.error('Admin account not found. Run npm.cmd run setup-admin first.');
      process.exitCode = 1;
      return;
    }
    console.log('Admin password reset. Username: admin');
    console.log(`New password: ${password}`);
    console.log('Save this password; it cannot be retrieved later.');
    if (!user.active) console.log('This account is inactive; resetting its password does not reactivate it.');
  } catch (_) {
    console.error('Password reset failed. Check your MongoDB connection and try again.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
