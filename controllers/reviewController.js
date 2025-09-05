const Review = require('../model/reviewsModel');
const ApiFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const {
  deletOne,
  updateOne,
  createOne,
  getOne,
  getAll,
} = require('./handlerFactory');

exports.setTourUserIds = (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};

exports.getAllReview = getAll(Review);
exports.createReview = createOne(Review);
exports.getReview = getOne(Review);
exports.deleteReview = deletOne(Review);
exports.updateReview = updateOne(Review);
