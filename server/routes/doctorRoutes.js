const express = require('express');
const {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require('../controllers/doctorController');

const router = express.Router();

router.route('/').get(getDoctors).post(createDoctor);
router.route('/:id').get(getDoctor).put(updateDoctor).patch(updateDoctor).delete(deleteDoctor);

module.exports = router;
