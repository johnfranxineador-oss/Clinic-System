const router = require('express').Router();
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { verify, hash } = require('../utils/password');
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128)
    throw new AppError('Enter a username and password', 400);
  const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !user.active || !await verify(password, user.passwordHash))
    throw new AppError('Wrong username or password, or account is inactive', 400);
  const data = user.toObject();
  delete data.passwordHash;
  res.status(200).json({ success: true, data });
}));
router.post('/change-password', asyncHandler(async (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  if (typeof username !== 'string' || typeof currentPassword !== 'string' || currentPassword.length > 128)
    throw new AppError('Enter your username and current password', 400);
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128)
    throw new AppError('New password must have 8 to 128 characters', 400);
  if (newPassword === currentPassword)
    throw new AppError('Choose a password different from your current password', 400);
  const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !user.active || !await verify(currentPassword, user.passwordHash))
    throw new AppError('Current password is incorrect or account is inactive', 400);
  // Compare the verified hash to avoid overwriting a concurrent password change.
  const result = await User.updateOne({ _id: user._id, passwordHash: user.passwordHash, active: true },
    { $set: { passwordHash: await hash(newPassword) } }, { runValidators: true });
  if (!result.modifiedCount) throw new AppError('Password changed elsewhere. Try again with your current password', 400);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
}));
module.exports = router;
