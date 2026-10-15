const router = require('express').Router();
const controller = require('../controllers/payouts.controller');
const {id,body} = require('../middleware/validate');
router.get('/',controller.list);
router.post('/',body('payouts'),controller.create);
router.get('/:id',id,controller.get);
router.put('/:id',id,body('payouts'),controller.update);
router.delete('/:id',id,controller.remove);
module.exports = router;
