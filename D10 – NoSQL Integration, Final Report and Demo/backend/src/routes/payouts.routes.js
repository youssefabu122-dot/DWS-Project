const router = require('express').Router();
const controller = require('../controllers/payouts.controller');
const {id,body} = require('../middleware/validate');
const {requireRole} = require('../middleware/auth');
// D9 RBAC: payout records are organizer-only (members see payouts on the dashboard).
router.use(requireRole('organizer'));
router.get('/',controller.list);
router.post('/',body('payouts'),controller.create);
router.get('/:id',id,controller.get);
router.put('/:id',id,body('payouts'),controller.update);
router.delete('/:id',id,controller.remove);
module.exports = router;
