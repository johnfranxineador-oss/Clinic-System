const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true, match: /^[a-z0-9_.]{3,20}$/ },
    passwordHash: { type: String, select: false },
    active: { type: Boolean, default: true },
    dob: { type: String, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    photo: { type: String, maxlength: 100000, default: '' },
    studentEmployeeId: {
      type: String,
      required: [true, 'Student or employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [4, 'Student or employee ID must be at least 4 characters'],
      maxlength: [20, 'Student or employee ID must be at most 20 characters'],
      match: [/^[A-Z0-9-]+$/, 'Student or employee ID may contain letters, numbers, and dashes only'],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [120, 'Full name must be at most 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [160, 'Email must be at most 160 characters'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['student', 'faculty', 'staff', 'admin'],
        message: 'Role must be student, faculty, staff, or admin',
      },
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      validate: {
        validator: (value) => /^[0-9+\-\s()]{7,18}$/.test(value) &&
          (value.match(/\d/g) || []).length >= 7,
        message: 'Enter a valid contact number (7–18 digits, spaces, or + - ( ))',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
