const router = require('express').Router();
const controller = require('../controllers/bids.controller');
const {id,body} = require('../middleware/validate');
const {cycleAccess,ownMemberId,requireRole} = require('../middleware/auth');
// D9 RBAC: a member bids only for themselves, only in their own circle.
router.post('/:id/bids',id,cycleAccess,body('bids'),ownMemberId,controller.create);
router.get('/:id/bids/ranking',id,cycleAccess,controller.ranking);
router.get('/:id/bids/history',id,cycleAccess,controller.history);
// Only the organizer extends, reopens or decides after a deadline without bids.
router.post('/:id/bidding',id,requireRole('organizer'),cycleAccess,controller.decide);
module.exports = router;
