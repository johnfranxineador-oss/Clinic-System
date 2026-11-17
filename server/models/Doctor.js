const mongoose = require('mongoose');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const availabilitySlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: [true, 'Availability day is required'],
      enum: {
        values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        message: 'Availability day must be a full weekday name',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Availability start time is required'],
      trim: true,
      match: [TIME, 'Start time must use 24-hour HH:MM format'],
    },
    endTime: {
      type: String,
      required: [true, 'Availability end time is required'],
      trim: true,
      match: [TIME, 'End time must use 24-hour HH:MM format'],
    },
  },
  { _id: false }
);

availabilitySlotSchema.pre('validate', function validateSlot(next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be later than start time');
  }
  next();
});

const doctorSchema = new mongoose.Schema(
  {
    contactNumber: { type: String, trim: true, default: '' },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [120, 'Full name must be at most 120 characters'],
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      minlength: [2, 'Specialization must be at least 2 characters'],
      maxlength: [80, 'Specialization must be at most 80 characters'],
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [5, 'License number must be at least 5 characters'],
      maxlength: [30, 'License number must be at most 30 characters'],
      match: [/^[A-Z0-9-]+$/, 'License number may contain letters, numbers, and dashes only'],
    },
    availability: {
      type: [availabilitySlotSchema],
      required: [true, 'At least one availability slot is required'],
      validate: [
        {
          validator: (slots) => Array.isArray(slots) && slots.length > 0,
          message: 'Add at least one availability slot',
        },
        {
          validator: (slots) => {
            const days = (slots || []).map((slot) => slot.day);
            return days.length === new Set(days).size;
          },
          message: 'Each weekday can appear only once in availability',
        },
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
      required: [true, 'Active status is required'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
