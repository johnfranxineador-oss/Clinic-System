const User = require('../models/User');
const Appointment = require('../models/Appointment');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { assertObjectId, pick, assertJsonObject, requireFields } = require('../utils/http');

const FIELDS = ['studentEmployeeId', 'fullName', 'email', 'role', 'contactNumber', 'username', 'active', 'dob', 'address', 'photo'];
const REQUIRED = ['studentEmployeeId', 'fullName', 'email', 'role', 'contactNumber'];

const sendOne = (res, statusCode, data) => {
  res.status(statusCode).json({ success: true, data });
};

const ROLES = ['student', 'faculty', 'staff', 'admin'];

const getUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) {
    if (!ROLES.includes(req.query.role)) {
      throw new AppError('Role must be student, faculty, staff, or admin', 400);
    }
    filter.role = req.query.role;
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: users.length, data: users });
});

const getUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'user ID');
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  sendOne(res, 200, user);
});

const createUser = asyncHandler(async (req, res) => {
  assertJsonObject(req.body);
  const payload = pick(req.body, FIELDS);
  requireFields(payload, REQUIRED);
  if (req.body.password !== undefined) {
    if (typeof req.body.password !== 'string' || req.body.password.length < 8 || req.body.password.length > 128)
      throw new AppError('Password must have 8 to 128 characters', 400);
    payload.passwordHash = await require('../utils/password').hash(req.body.password);
  }
  const user = await User.create(payload);
  user.passwordHash = undefined;
  sendOne(res, 201, user);
});

const updateUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'user ID');
  assertJsonObject(req.body);

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const payload = pick(req.body, FIELDS);
  if (req.method === 'PUT') requireFields(payload, REQUIRED);
  if (Object.keys(payload).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  user.set(payload);
  await user.save();
  sendOne(res, 200, user);
});

const deleteUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'user ID');
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const [appointments, logs] = await Promise.all([
    Appointment.countDocuments({ user: user._id }),
    ActivityLog.countDocuments({ user: user._id }),
  ]);

  if (appointments > 0 || logs > 0) {
    throw new AppError('Cannot delete this user while appointments or activity logs still reference them', 400);
  }

  await user.deleteOne();
  res.status(200).json({ success: true, message: 'User deleted', data: user });
});

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
};
