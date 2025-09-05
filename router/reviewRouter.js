const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');
const express = require('express');
const route = express.Router({ mergeParams: true });

route.use(authController.protect);
route
  .route('/')
  .get(reviewController.getAllReview)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

route
  .route('/:id')
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview
  );

module.exports = route;
