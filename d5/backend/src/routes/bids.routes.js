const router = require('express').Router();
const controller = require('../controllers/bids.controller');
const {id,body} = require('../middleware/validate');
router.post('/:id/bids',id,body('bids'),controller.create);
router.get('/:id/bids/ranking',id,controller.ranking);
module.exports = router;
