const AppError = require('./AppError');

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

const isObjectId = (value) => typeof value === 'string' && OBJECT_ID.test(value);

const assertObjectId = (value, label = 'ID') => {
  if (!isObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
};

const pick = (source, keys) => {
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
};

const assertJsonObject = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be a JSON object', 400);
  }
};

const missingFields = (payload, fields) =>
  fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === '';
  });

const requireFields = (payload, fields) => {
  const missing = missingFields(payload, fields);
  if (missing.length) {
    throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400);
  }
};

const weekdayName = (date) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Manila',
  }).format(date);

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError('appointmentDate must be a YYYY-MM-DD date', 400);
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError('appointmentDate is not a real calendar date', 400);
  }

  const latest = new Date();
  latest.setUTCFullYear(latest.getUTCFullYear() + 1);
  if (date.getTime() > latest.getTime()) {
    throw new AppError('appointmentDate cannot be more than one year ahead', 400);
  }

  return date;
};

const formatDateOnly = (date) => {
  const value = new Date(date);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

module.exports = {
  isObjectId,
  assertObjectId,
  pick,
  assertJsonObject,
  requireFields,
  weekdayName,
  parseDateOnly,
  formatDateOnly,
};
