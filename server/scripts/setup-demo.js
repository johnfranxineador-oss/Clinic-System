const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { hash } = require('../utils/password');

const PASSWORD = 'Infirmary@2026';
async function setupDemo() {
  const accounts = [
    { username: 'demo.admin', role: 'admin', fullName: 'Demo Administrator', studentEmployeeId: 'DEMO-ADMIN' },
    { username: 'demo.staff', role: 'staff', fullName: 'Demo Clinic Staff', studentEmployeeId: 'DEMO-STAFF' },
    { username: 'demo.patient', role: 'student', fullName: 'Demo Patient', studentEmployeeId: 'DEMO-PATIENT' },
  ];
  for (const account of accounts) {
    const existing = await User.findOne({ username: account.username });
    if (existing) {
      console.log(`${account.username}: already exists; password and profile unchanged`);
      continue;
    }
    await User.create({ ...account, email: `${account.username}@example.com`,
      contactNumber: '09171234567', active: true, passwordHash: await hash(PASSWORD) });
    console.log(`${account.username}: created`);
  }
  console.log(`New demo accounts use password: ${PASSWORD}`);
  console.log('Visitor: choose Continue as Visitor; no account or password is needed.');
}

if (require.main === module) {
  (async () => {
    try {
      await require('../config/db')();
      await setupDemo();
    } catch (_) {
      console.error('Demo setup failed. Check MongoDB and unique account IDs/emails. Existing accounts were not overwritten.');
      process.exitCode = 1;
    } finally { await mongoose.disconnect(); }
  })();
}
module.exports = { setupDemo, PASSWORD };
