const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { getStats } = require('../controllers/analyticsController');

router.get('/', protect, getStats);

module.exports = router;
