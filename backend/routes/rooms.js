const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
    createRoom, getRooms, getRoom, joinRoom, leaveRoom,
    updateRoom, removeParticipant, saveVersion, getVersions,
    restoreVersion, deleteRoom
} = require('../controllers/roomController');

router.post('/', protect, createRoom);
router.get('/', protect, getRooms);
router.get('/:roomId', protect, getRoom);
router.post('/:roomId/join', protect, joinRoom);
router.post('/:roomId/leave', protect, leaveRoom);
router.put('/:roomId', protect, updateRoom);
router.delete('/:roomId', protect, deleteRoom);
router.delete('/:roomId/participants/:userId', protect, removeParticipant);
router.post('/:roomId/versions', protect, saveVersion);
router.get('/:roomId/versions', protect, getVersions);
router.post('/:roomId/versions/:versionId/restore', protect, restoreVersion);

module.exports = router;
