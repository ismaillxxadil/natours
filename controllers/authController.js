const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const sendEmail = require('../utils/email');
const { formatDuration } = require('../utils/helpers');

const sendLockedEmail = async (user, time, message, next) => {
  user.lockUntil = Date.now() + time;
  await user.save({ validateBeforeSave: false });
  return next(new appError(message, 403));
};
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  //remove the password from the output
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};
exports.signup = catchAsync(async (req, res, next) => {
  //this code has security issue because the user can set the role to admin
  //v1
  //const newUser = await User.create(req.body);
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) Check if email and password exist
  if (!email || !password) {
    return next(new appError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select(
    '+password +loginAttempts +lockUntil'
  );

  if (!user) {
    return next(new appError('Incorrect email please try again', 401));
  }

  if (user.isLocked) {
    const remainingLockTime = user.lockUntil - Date.now();
    return next(
      new appError(
        `Your account is currently locked. Please try again after ${formatDuration(
          remainingLockTime
        )}.`,
        403
      )
    );
  }

  const isCorrect = await user.correctPassword(password, user.password);
  if (!isCorrect) {
    user.loginAttempts += 1;

    if (user.loginAttempts === 5) {
      return sendLockedEmail(
        user,
        2 * 60 * 1000,
        'Your account is locked for 2 minutes',
        next
      );
    } else if (user.loginAttempts === 10) {
      return sendLockedEmail(
        user,
        30 * 60 * 1000,
        'Your account is locked for 30 minutes',
        next
      );
    } else if (user.loginAttempts > 10) {
      return sendLockedEmail(
        user,
        24 * 60 * 60 * 1000,
        'Your account is locked for 24 hours',
        next
      );
    }
    await user.save({ validateBeforeSave: false });

    return next(new appError('Incorrect password, please try again', 401));
  }

  // ✅ reset after success
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  //if there is no token that meanr the user is not logg in
  if (!token) {
    return next(
      new appError('You are not logged in! Please log in to get access', 401)
    );
  }
  //2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3) Check if the user still exist
  const freashUser = await User.findById(decoded.id);
  if (!freashUser) {
    return next(
      new appError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  //4) Check if user changed password after the token was issued
  if (freashUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new appError('User recently changed password! Please log in again.', 401)
    );
  }

  //GRANT ACCESS TO PROTECTED ROUTE
  req.user = freashUser;

  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new appError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};
exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new appError('there is no user with this email address'), 404);
  }
  //2) Generate the random reset token
  const resetToken = user.createPasswordRestToken();
  await user.save({ validateBeforeSave: false });
  //3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;
  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    console.error('EMAIL SEND ERROR:', err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new appError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hasedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const user = await User.findOne({
    passwordResetToken: hasedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new appError('Token is invalid or has expired', 400));
  }
  //2) If token has not expired, and there is user, set the new password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  //3) Update changedPasswordAt property for the user

  //4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) get user from collection
  const user = await User.findById(req.user.id).select('+password');

  //2)check if the POSTed password is correct
  if (!(await user.correctPassword(req.body.password, user.password))) {
    return next(new appError('Your current password is wrong.', 401));
  }
  //3)if so, update the password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  await user.save();
  //4) log in ,and send jwt
  createSendToken(user, 200, res);
});
