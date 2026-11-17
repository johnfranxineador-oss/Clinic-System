const redact = (value) =>
  String(value || '').replace(/mongodb(\+srv)?:\/\/\S+/gi, 'mongodb://[redacted]');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.name === 'AppError' && [400, 404].includes(err.statusCode)
    ? err.statusCode : 500;
  let message = statusCode === 500 ? 'Internal server error' : err.message;

  if (err.name === 'CastError') {
    statusCode = 400;
    const isId = err.kind === 'ObjectId' || err.path === '_id';
    message = isId ? 'Invalid ID format' : `Invalid value for ${err.path || 'field'}`;
  } else if (err.name === 'BSONError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((item) => item.name === 'CastError' ? 'Invalid field value' : item.message)
      .join('. ');
  } else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists`;
  } else if (['entity.too.large', 'encoding.unsupported', 'charset.unsupported', 'request.aborted', 'request.size.invalid'].includes(err.type)) {
    statusCode = 400;
    message = 'Invalid request body';
  } else if (err instanceof URIError) {
    statusCode = 400;
    message = 'Malformed request URL';
  } else if (
    err.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError && err.status === 400 && 'body' in err)
  ) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  if (statusCode >= 500) {
    console.error(redact(`${err.name || 'Error'}: ${err.message || 'Unexpected server error'}`));
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
