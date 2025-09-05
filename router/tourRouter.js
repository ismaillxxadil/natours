const express = require('express');
const route = express.Router();
const reviewRouter = require('./reviewRouter');
const {
  getAllTours,
  getTour,
  createTour,
  deleteTour,
  updateTour,
  alaias,
  getTourStats,
  getMonthlyPlan,
  getToursWithin,
  getDistances,
  uploadTourImages,
  resizeTourImages,
} = require('../controllers/tourControllers');
const { protect, restrictTo } = require('../controllers/authController');
const { createReview } = require('../controllers/reviewController');

route.use('/:tourId/reviews', reviewRouter);
/* route.param('id', checkID);
 */ //this is wrong because it will run for every request
/* route.use(checkBody); */
route
  .route('/monthly-plan/:year')
  .get(protect, restrictTo('admin', 'lead-guide', 'guide'), getMonthlyPlan);

route
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(getToursWithin);
route.route('/distances/:latlng/unit/:unit').get(getDistances);
route.route('/tour-stats').get(getTourStats);
route.route('/top-5-cheap').get(alaias, getAllTours);
route
  .route('/:id')
  .get(getTour)
  .delete(protect, restrictTo('admin', 'lead-guide'), deleteTour)
  .patch(
    protect,
    restrictTo('admin', 'lead-guide'),
    uploadTourImages,
    resizeTourImages,
    updateTour
  );
route.route('/').get(getAllTours).post(createTour);

//there is problem with this approach
//route.route('/:tourId/reviews').post(protect, restrictTo('user'), createReview);

module.exports = route;
