const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    specialization: { type: String, trim: true, default: '' },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Service name must be at least 3 characters'],
      maxlength: [80, 'Service name must be at most 80 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description must be at most 500 characters'],
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [5, 'Duration must be at least 5 minutes'],
      max: [240, 'Duration cannot exceed 240 minutes'],
      validate: {
        validator: Number.isInteger,
        message: 'Duration must be a whole number of minutes',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      required: [true, 'Active status is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
