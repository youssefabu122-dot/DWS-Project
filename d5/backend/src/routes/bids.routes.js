const router = require('express').Router();
const controller = require('../controllers/bids.controller');
const {id,body} = require('../middleware/validate');
const {cycleAccess,ownMemberId} = require('../middleware/auth');
// D9 RBAC: a member bids only for themselves, only in their own circle.
router.post('/:id/bids',id,cycleAccess,body('bids'),ownMemberId,controller.create);
router.get('/:id/bids/ranking',id,cycleAccess,controller.ranking);
module.exports = router;
