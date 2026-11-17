const { randomBytes, scrypt: derive, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(derive);
exports.hash = async (password) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
};
exports.verify = async (password, stored) => {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const candidate = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};
