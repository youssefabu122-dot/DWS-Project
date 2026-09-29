const circlesRepository = require('../db/circles.repository');

async function getMembers(circleId) {
  return circlesRepository.getMembersByCircle(circleId);
}

async function getCycles(circleId) {
  return circlesRepository.getCyclesByCircle(circleId);
}

module.exports = {
  getMembers,
  getCycles
};