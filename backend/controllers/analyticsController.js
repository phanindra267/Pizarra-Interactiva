const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');
const File = require('../models/File');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getStats = catchAsync(async (req, res, next) => {
    const [totalUsers, activeRooms, totalRooms, totalMessages, totalFiles] = await Promise.all([
        User.countDocuments(),
        Room.countDocuments({ isActive: true }),
        Room.countDocuments(),
        Message.countDocuments(),
        File.countDocuments()
    ]);

    const storageStats = await File.aggregate([
        { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);

    const roomActivity = await Room.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
    ]);

    const recentRooms = await Room.find({ isActive: true })
        .populate('host', 'name')
        .sort({ updatedAt: -1 }).limit(10);

    const roomStats = await Room.aggregate([
        { $match: { isActive: true } },
        { $project: { participantCount: { $size: '$participants' } } },
        { $group: { _id: null, avgParticipants: { $avg: '$participantCount' }, maxParticipants: { $max: '$participantCount' } } }
    ]);

    res.json({
        stats: {
            totalUsers, activeRooms, totalRooms, totalMessages, totalFiles,
            totalStorage: storageStats[0]?.totalSize || 0,
            avgParticipants: roomStats[0]?.avgParticipants || 0,
            maxParticipants: roomStats[0]?.maxParticipants || 0,
            roomActivity
        },
        recentRooms
    });
});
