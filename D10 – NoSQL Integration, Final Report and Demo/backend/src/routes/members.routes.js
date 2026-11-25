const router = require('express').Router();
const controller = require('../controllers/members.controller');
const {id,body} = require('../middleware/validate');
const {requireRole,selfOrOrganizer} = require('../middleware/auth');
// D9 RBAC: contact data is confidential; members only see and edit themselves.
router.get('/',requireRole('organizer'),controller.list);
router.post('/',requireRole('organizer'),body('members'),controller.create);
router.get('/:id',id,selfOrOrganizer,controller.get);
router.put('/:id',id,selfOrOrganizer,body('memberUpdate'),controller.update);
router.delete('/:id',id,requireRole('organizer'),controller.remove);
module.exports = router;
