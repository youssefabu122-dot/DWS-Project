const express = require('express');
const controller = require('../controllers/circles.controller');

const router = express.Router();

router.get('/:id/members', controller.getMembers);
router.get('/:id/cycles', controller.getCycles);

module.exports = router;