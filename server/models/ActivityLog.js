const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A user is required for the activity log'],
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      minlength: [3, 'Action must be at least 3 characters'],
      maxlength: [40, 'Action must be at most 40 characters'],
      match: [/^[A-Za-z][A-Za-z _-]*$/, 'Action may contain letters, spaces, hyphens, and underscores'],
    },
    targetResource: {
      type: String,
      required: [true, 'Target resource is required'],
      trim: true,
      enum: {
        values: ['User', 'Doctor', 'Service', 'Appointment'],
        message: 'Target resource must be User, Doctor, Service, or Appointment',
      },
    },
    resourceId: {
      type: String,
      required: [true, 'Resource ID is required'],
      trim: true,
      match: [/^[a-fA-F0-9]{24}$/, 'Resource ID must be a MongoDB ObjectId'],
    },
    details: {
      type: String,
      required: [true, 'Details are required'],
      trim: true,
      minlength: [3, 'Details must be at least 3 characters'],
      maxlength: [1000, 'Details must be at most 1000 characters'],
    },
  },
  { timestamps: true, collection: 'activity_logs' }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
