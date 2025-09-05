const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewsSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'the review is reuired'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    user: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: [true, 'the review must belong to a user'],
    },
    tour: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Tour',
      required: [true, 'the review must belong to a tour'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//to prevent duplicate reviews
reviewsSchema.index({ tour: 1, user: 1 }, { unique: true });
reviewsSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    { $match: { tour: tourId } },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewsSchema.post('save', function () {
  //this points to current review
  this.constructor.calcAverageRatings(this.tour);
});
//findByIdAndUpdate
//findByIdAndDelete
reviewsSchema.pre(/^findOneAnd/, async function (next) {
  //this contain the qury not the doument
  this.r = await this.findOne(); //will return the Doument before the udata/delet happen
  //we create proerty in the query and svae the douc
  // to user it later to know the tourId
  next();
});

reviewsSchema.post(/^findOneAnd/, async function () {
  if (!this.r) return;
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

reviewsSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});
const Review = mongoose.model('Review', reviewsSchema);
module.exports = Review;
