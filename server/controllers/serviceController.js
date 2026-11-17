const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const { assertObjectId, pick, assertJsonObject, requireFields } = require('../utils/http');

const FIELDS = ['name', 'description', 'durationMinutes', 'isActive', 'specialization'];
const REQUIRED = ['name', 'description', 'durationMinutes', 'isActive'];

const getServices = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive === 'true') filter.isActive = true;
  if (req.query.isActive === 'false') filter.isActive = false;

  const services = await Service.find(filter).sort({ name: 1 });
  res.status(200).json({ success: true, count: services.length, data: services });
});

const getService = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'service ID');
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);
  res.status(200).json({ success: true, data: service });
});

const createService = asyncHandler(async (req, res) => {
  assertJsonObject(req.body);
  const payload = pick(req.body, FIELDS);
  requireFields(payload, ['name', 'description', 'durationMinutes']);
  if (payload.isActive === undefined) payload.isActive = true;

  const service = await Service.create(payload);
  res.status(201).json({ success: true, data: service });
});

const updateService = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'service ID');
  assertJsonObject(req.body);

  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);

  const payload = pick(req.body, FIELDS);
  if (req.method === 'PUT') requireFields(payload, REQUIRED);
  if (Object.keys(payload).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  service.set(payload);
  await service.save();
  res.status(200).json({ success: true, data: service });
});

const deleteService = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, 'service ID');
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);

  const linked = await Appointment.countDocuments({ service: service._id });
  if (linked > 0) {
    throw new AppError('Cannot delete this service while appointments still reference it', 400);
  }

  await service.deleteOne();
  res.status(200).json({ success: true, message: 'Service deleted', data: service });
});

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
};
