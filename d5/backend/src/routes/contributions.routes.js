const router = require('express').Router();
const controller = require('../controllers/contributions.controller');
const {id,body} = require('../middleware/validate');
const {requireRole,ownMemberId} = require('../middleware/auth');
const organizer = requireRole('organizer');
// D9 RBAC: members record and read only their own contributions; only the organizer edits or deletes.
router.get('/',controller.list);
router.post('/',body('contributions'),ownMemberId,controller.create);
router.get('/:id',id,controller.get);
router.put('/:id',id,organizer,body('contributions'),controller.update);
router.delete('/:id',id,organizer,controller.remove);
module.exports = router;
