const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Service = require('../models/Service');
const ActivityLog = require('../models/ActivityLog');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const {
  assertObjectId,
  pick,
  assertJsonObject,
  requireFields,
  isObjectId,
  weekdayName,
  parseDateOnly,
  formatDateOnly,
} = require('../utils/http');

const WRITABLE = ['user', 'doctor', 'service', 'appointmentDate', 'timeSlot', 'reason', 'status', 'notes'];
const REQUIRED = ['user', 'doctor', 'service', 'appointmentDate', 'timeSlot', 'reason', 'status'];
const OPEN_STATUSES = ['pending', 'confirmed'];
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const POPULATE = [
  { path: 'user', select: 'fullName email role studentEmployeeId contactNumber' },
  { path: 'doctor', select: 'fullName specialization licenseNumber isActive availability' },
  { path: 'service', select: 'name description durationMinutes isActive' },
];

const normalizePayload = (payload) => {
  if (payload.appointmentDate !== undefined) {
    payload.appointmentDate = parseDateOnly(String(payload.appointmentDate));
  }
  if (payload.notes === undefined) {
    return payload;
  }
  if (payload.notes === null) payload.notes = '';
  return payload;
};

const ensureRef = async (id, Model, label) => {
  if (!isObjectId(String(id))) throw new AppError(`Invalid ${label} ID`, 400);
  const doc = await Model.findById(id);
  if (!doc) throw new AppError(`Referenced ${label} does not exist`, 400);
  return doc;
};

const assertSchedule = (doctor, service, appointmentDate, timeSlot, status) => {
  if (!OPEN_STATUSES.includes(status)) return;

  if (!doctor.isActive) {
    throw new AppError('Doctor is not accepting appointments', 400);
  }
  if (!service.isActive) {
    throw new AppError('Service is not currently offered', 400);
  }

  const day = weekdayName(appointmentDate);
  const slot = (doctor.availability || []).find((item) => item.day === day);
  if (!slot) {
    throw new AppError(`Doctor is not available on ${day}`, 400);
  }
  if (timeSlot < slot.startTime || timeSlot >= slot.endTime) {
    throw new AppError(`Time slot must be from ${slot.startTime} up to ${slot.endTime}`, 400);
  }
};

const assertNoDoubleBook = async (appointment) => {
  if (!OPEN_STATUSES.includes(appointment.status)) return;

  const dayStart = new Date(appointment.appointmentDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const clash = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctor: appointment.doctor,
    timeSlot: appointment.timeSlot,
    status: { $in: OPEN_STATUSES },
    appointmentDate: { $gte: dayStart, $lt: dayEnd },
  });

  if (clash) {
    throw new AppError('That doctor already has an open appointment in this time slot', 400);
  }
};

const resolveActor = async (req, fallbackUserId) => {
  const raw = req.body?.performedBy || req.get('x-user-id') || fallbackUserId;
  if (!raw) throw new AppError('A user is required to record appointment activity', 400);
  if (!isObjectId(String(raw))) throw new AppError('Invalid performedBy user ID', 400);
  const actor = await User.findById(raw);
  if (!actor) throw new AppError('Activity user was not found', 400);
  return actor._id;
};

const writeLog = async ({ user, action, resourceId, details }) => {
  await ActivityLog.create({
    user,
    action,
    targetResource: 'Appointment',
    resourceId: String(resourceId),
    details,
  });
};

const changedSummary = (before, after) => {
  const fields = ['user', 'doctor', 'service', 'timeSlot', 'reason', 'status', 'notes'];
  const changes = [];

  for (const field of fields) {
    if (String(before[field] ?? '') !== String(after[field] ?? '')) {
      changes.push(field);
    }
  }

  const beforeDate = formatDateOnly(before.appointmentDate);
  const afterDate = formatDateOnly(after.appointmentDate);
  if (beforeDate !== afterDate) changes.push('appointmentDate');

  if (!changes.length) return 'Updated appointment with no field changes';
  return `Updated appointment fields: ${changes.join(', ')}`;
};

const loadPopulated = (id) => Appointment.findById(id).populate(POPULATE);

const getAppointments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      throw new AppError('Status must be pending, confirmed, completed, or cancelled', 400);
    }
    filter.status = req.query.status;
  }
  if (req.query.user) {
    if (!isObjectId(req.query.user)) throw new AppError('Invalid user ID', 400);
    filter.user = req.query.user;
  }
  if (req.query.doctor) {
    if (!isObjectId(req.query.doctor)) throw new AppError('Invalid doctor ID', 400);
    filter.doctor = req.query.doctor;
  }
  if (req.query.service) {
    if (!isObjectId(req.query.service)) throw new AppError('Invalid service ID', 400);
    filter.service = req.query.service;
  }
  if (req.query.date) {
    const day = parseDateOnly(req.query.date);
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    filter.appointmentDate = { $gte: day, $lt: next };
  }

  const appointments = await Appointment.find(filter).populate(POPULATE).sort({ appointmentDate: 1, timeSlot: 1 });
  res.status(200).json({ success: true, count: appointments.length, data: appointments });
});

const getAppointment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'appointment ID');
  const appointment = await loadPopulated(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);
  res.status(200).json({ success: true, data: appointment });
});

const createAppointment = asyncHandler(async (req, res) => {
  assertJsonObject(req.body);
  const payload = normalizePayload(pick(req.body, WRITABLE));
  if (!payload.status) payload.status = 'pending';
  if (payload.notes === undefined) payload.notes = '';
  requireFields(payload, REQUIRED);

  const [user, doctor, service] = await Promise.all([
    ensureRef(payload.user, User, 'user'),
    ensureRef(payload.doctor, Doctor, 'doctor'),
    ensureRef(payload.service, Service, 'service'),
  ]);

  assertSchedule(doctor, service, payload.appointmentDate, payload.timeSlot, payload.status);

  const draft = new Appointment(payload);
  await assertNoDoubleBook(draft);

  const actorId = await resolveActor(req, user._id);
  const appointment = await draft.save();

  try {
    await writeLog({
      user: actorId,
      action: 'create',
      resourceId: appointment._id,
      details: `Created ${payload.status} appointment on ${formatDateOnly(payload.appointmentDate)} at ${payload.timeSlot}`,
    });
  } catch (error) {
    await Appointment.findByIdAndDelete(appointment._id);
    throw error;
  }

  const populated = await loadPopulated(appointment._id);
  res.status(201).json({ success: true, data: populated });
});

const updateAppointment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'appointment ID');
  assertJsonObject(req.body);

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const payload = normalizePayload(pick(req.body, WRITABLE));
  if (req.method === 'PUT') {
    if (payload.notes === undefined) payload.notes = '';
    requireFields(payload, REQUIRED);
  }
  if (Object.keys(payload).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const nextUserId = payload.user || appointment.user;
  const nextDoctorId = payload.doctor || appointment.doctor;
  const nextServiceId = payload.service || appointment.service;
  const nextDate = payload.appointmentDate || appointment.appointmentDate;
  const nextSlot = payload.timeSlot || appointment.timeSlot;
  const nextStatus = payload.status || appointment.status;

  const [doctor, service] = await Promise.all([
    ensureRef(nextDoctorId, Doctor, 'doctor'),
    ensureRef(nextServiceId, Service, 'service'),
    ensureRef(nextUserId, User, 'user'),
  ]);

  assertSchedule(doctor, service, nextDate, nextSlot, nextStatus);

  const before = appointment.toObject();
  appointment.set(payload);
  await assertNoDoubleBook(appointment);

  const actorId = await resolveActor(req, appointment.user);
  await appointment.save();

  try {
    await writeLog({
      user: actorId,
      action: 'update',
      resourceId: appointment._id,
      details: changedSummary(before, appointment.toObject()),
    });
  } catch (error) {
    appointment.set(pick(before, WRITABLE));
    await appointment.save();
    throw error;
  }

  const populated = await loadPopulated(appointment._id);
  res.status(200).json({ success: true, data: populated });
});

const deleteAppointment = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'appointment ID');
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const actorId = await resolveActor(req, appointment.user);
  const snapshot = appointment.toObject();

  await appointment.deleteOne();

  try {
    await writeLog({
      user: actorId,
      action: 'delete',
      resourceId: snapshot._id,
      details: `Deleted ${snapshot.status} appointment on ${formatDateOnly(snapshot.appointmentDate)} at ${snapshot.timeSlot}`,
    });
  } catch (error) {
    await Appointment.create(snapshot);
    throw error;
  }

  res.status(200).json({ success: true, message: 'Appointment deleted', data: snapshot });
});

module.exports = {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
};
