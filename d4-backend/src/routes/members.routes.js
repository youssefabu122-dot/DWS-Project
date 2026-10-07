const router = require('express').Router();
const controller = require('../controllers/members.controller');
const {id,body} = require('../middleware/validate');
router.get('/',controller.list);
router.post('/',body('members'),controller.create);
router.get('/:id',id,controller.get);
router.put('/:id',id,body('members'),controller.update);
router.delete('/:id',id,controller.remove);
module.exports = router;
