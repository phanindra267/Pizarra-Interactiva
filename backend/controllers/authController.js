const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const generateTokens = (userId) => {
    const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });
    const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });
    return { accessToken, refreshToken };
};

exports.register = catchAsync(async (req, res, next) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return next(new AppError('Please provide name, email and password', 400));
    if (password.length < 6) return next(new AppError('Password must be at least 6 characters', 400));

    const exists = await User.findOne({ email });
    if (exists) return next(new AppError('Email already registered', 400));

    const user = await User.create({ name, email, passwordHash: password });
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });

    res.status(201).json({ user, token: accessToken });
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Please provide email and password', 400));

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    user.lastActive = Date.now();
    await user.save();

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });

    res.json({ user, token: accessToken });
});

exports.refresh = catchAsync(async (req, res, next) => {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if (!token) return next(new AppError('No refresh token provided', 401));

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== token) {
        return next(new AppError('Invalid or expired refresh token', 401));
    }

    const { accessToken, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken; // Token rotation
    await user.save();

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });

    res.json({ token: accessToken });
});

exports.logout = catchAsync(async (req, res, next) => {
    if (req.user) {
        req.user.refreshToken = '';
        await req.user.save();
    }
    res.clearCookie('refreshToken');
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

exports.getMe = (req, res, next) => {
    try {
        res.json({ user: req.user });
    } catch (err) {
        console.error('getMe ERROR 💥:', err);
        next(err);
    }
};

exports.updateProfile = catchAsync(async (req, res, next) => {
    const { name, themePreference } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError('User not found', 404));

    if (name) user.name = name;
    if (themePreference) user.themePreference = themePreference;
    await user.save();
    res.json({ user });
});

exports.googleCallback = catchAsync(async (req, res, next) => {
    const { accessToken, refreshToken } = generateTokens(req.user._id);
    req.user.refreshToken = refreshToken;
    await req.user.save();

    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('token', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });

    let frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
        frontendUrl = `${req.protocol}://${req.get('host')}`;
    }
    res.redirect(`${frontendUrl}/auth/success`);
});


