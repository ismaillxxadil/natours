const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
//create userSchema scheman
const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: [true, 'The user name is require'],
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'The email is require'],
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    min: 6,
    required: [true, 'the password is require'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'the password confirm is require'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'Password are not the same',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: Date,
});

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre('save', async function (next) {
  //if the pasword is not midifed reutrn
  if (!this.isModified('password')) return next();
  //hase the password
  this.password = await bcrypt.hash(this.password, 10);

  //set the passconf = undefind
  this.passwordConfirm = undefined;

  next();
});

userSchema.pre(/^find/, function (next) {
  //this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  //false means not changed
  return false;
};
userSchema.methods.createPasswordRestToken = function () {
  //create the token that will be sent to the user
  const resetToken = crypto.randomBytes(32).toString('hex');
  //we dont save the token in the db
  //frist we hash it then save it
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
