const express = require('express');
const {
  getActivityLogs,
  getActivityLog,
  createActivityLog,
} = require('../controllers/activityLogController');

const router = express.Router();

router.route('/').get(getActivityLogs).post(createActivityLog);
router.route('/:id').get(getActivityLog);

module.exports = router;
