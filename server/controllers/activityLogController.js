const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { assertObjectId, pick, assertJsonObject, requireFields, isObjectId } = require('../utils/http');

const FIELDS = ['user', 'action', 'targetResource', 'resourceId', 'details'];

const populateUser = { path: 'user', select: 'fullName email role studentEmployeeId' };

const getActivityLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.targetResource) filter.targetResource = req.query.targetResource;
  if (req.query.user) {
    if (!isObjectId(req.query.user)) throw new AppError('Invalid user ID', 400);
    filter.user = req.query.user;
  }

  const logs = await ActivityLog.find(filter).populate(populateUser).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: logs.length, data: logs });
});

const getActivityLog = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'activity log ID');
  const log = await ActivityLog.findById(req.params.id).populate(populateUser);
  if (!log) throw new AppError('Activity log not found', 404);
  res.status(200).json({ success: true, data: log });
});

const createActivityLog = asyncHandler(async (req, res) => {
  assertJsonObject(req.body);
  const payload = pick(req.body, FIELDS);
  requireFields(payload, FIELDS);

  if (!isObjectId(String(payload.user))) throw new AppError('Invalid user ID', 400);
  const user = await User.findById(payload.user);
  if (!user) throw new AppError('Referenced user does not exist', 400);

  const log = await ActivityLog.create(payload);
  const populated = await ActivityLog.findById(log._id).populate(populateUser);
  res.status(201).json({ success: true, data: populated });
});

module.exports = {
  getActivityLogs,
  getActivityLog,
  createActivityLog,
};
