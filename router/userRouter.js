const express = require('express');
const {
  getAllUsers,
  getUser,
  createUser,
  deleteUser,
  updateUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
} = require('../controllers/userControllers');
const authController = require('../controllers/authController');
const route = express.Router();
const multer = require('multer');

const upload = multer({ dest: 'public/img/users' });

//foe everyone
route.post('/signup', authController.signup);
route.post('/login', authController.login);
route.post('/forgot-password', authController.forgotPassword);
route.post('/resetPassword/:token', authController.resetPassword);

//protect all routes after this middleware
//only for logged in users
route.use(authController.protect);

route.patch('/updateMyPassword', authController.updatePassword);
route.get('/me', getMe, getUser);
route.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);
route.delete('/deleteMe', deleteMe);

//only for admin
route.use(authController.restrictTo('admin'));

route.route('/').get(getAllUsers).post(createUser);
route.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);
module.exports = route;
