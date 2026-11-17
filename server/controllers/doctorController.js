const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { assertObjectId, pick, assertJsonObject, requireFields } = require('../utils/http');

const FIELDS = ['fullName', 'specialization', 'licenseNumber', 'availability', 'isActive', 'contactNumber'];
const REQUIRED = ['fullName', 'specialization', 'licenseNumber', 'availability', 'isActive'];

const getDoctors = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive === 'true') filter.isActive = true;
  if (req.query.isActive === 'false') filter.isActive = false;

  const doctors = await Doctor.find(filter).sort({ fullName: 1 });
  res.status(200).json({ success: true, count: doctors.length, data: doctors });
});

const getDoctor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'doctor ID');
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);
  res.status(200).json({ success: true, data: doctor });
});

const createDoctor = asyncHandler(async (req, res) => {
  assertJsonObject(req.body);
  const payload = pick(req.body, FIELDS);
  requireFields(payload, ['fullName', 'specialization', 'licenseNumber', 'availability']);
  if (payload.isActive === undefined) payload.isActive = true;

  const doctor = await Doctor.create(payload);
  res.status(201).json({ success: true, data: doctor });
});

const updateDoctor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'doctor ID');
  assertJsonObject(req.body);

  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);

  const payload = pick(req.body, FIELDS);
  if (req.method === 'PUT') requireFields(payload, REQUIRED);
  if (Object.keys(payload).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  doctor.set(payload);
  await doctor.save();
  res.status(200).json({ success: true, data: doctor });
});

const deleteDoctor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'doctor ID');
  const doctor = await Doctor.findById(req.params.id);
  if (!doctor) throw new AppError('Doctor not found', 404);

  const linked = await Appointment.countDocuments({ doctor: doctor._id });
  if (linked > 0) {
    throw new AppError('Cannot delete this doctor while appointments still reference them', 400);
  }

  await doctor.deleteOne();
  res.status(200).json({ success: true, message: 'Doctor deleted', data: doctor });
});

module.exports = {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
