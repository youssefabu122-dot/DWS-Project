const router = require('express').Router();
const controller = require('../controllers/circles.controller');
const {id,body} = require('../middleware/validate');
const {requireRole,circleAccess} = require('../middleware/auth');
const organizer = requireRole('organizer');
// D9 RBAC: members read their own circles only; only the organizer changes circles or creates cycles.
router.get('/:id/members',id,circleAccess,controller.getMembers);
router.get('/:id/cycles',id,circleAccess,controller.getCycles);
router.post('/:id/cycles',id,organizer,controller.createCycle);
router.get('/:id/next-payout',id,circleAccess,require('../controllers/next-payout.controller').get);
router.get('/',controller.list);
router.post('/',organizer,body('circles'),controller.create);
router.get('/:id',id,circleAccess,controller.get);
router.put('/:id',id,organizer,body('circles'),controller.update);
router.delete('/:id',id,organizer,controller.remove);
module.exports = router;
