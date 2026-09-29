const circlesService = require('../services/circles.service');

async function getMembers(req, res) {
  const circleId = Number(req.params.id);

  if (!Number.isInteger(circleId) || circleId <= 0) {
    return res.status(400).json({
      error: 'Invalid circle id'
    });
  }

  try {
    const members = await circlesService.getMembers(circleId);

    return res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching members:', error);

    return res.status(500).json({
      error: 'Failed to fetch members'
    });
  }
}

async function getCycles(req, res) {
  const circleId = Number(req.params.id);

  if (!Number.isInteger(circleId) || circleId <= 0) {
    return res.status(400).json({
      error: 'Invalid circle id'
    });
  }

  try {
    const cycles = await circlesService.getCycles(circleId);

    return res.status(200).json(cycles);
  } catch (error) {
    console.error('Error fetching cycles:', error);

    return res.status(500).json({
      error: 'Failed to fetch cycles'
    });
  }
}

module.exports = {
  getMembers,
  getCycles
};