const express = require('express');
const tourRouter = require('./router/tourRouter');
const userRouter = require('./router/userRouter');
const reviewRouter = require('./router/reviewRouter');
const appError = require('./utils/appError');
const app = express();
const globalErrorHandler = require('./controllers/errorController');
const morgan = require('morgan');
const { default: rateLimit } = require('express-rate-limit');
const { default: helmet } = require('helmet');
const ExpressMongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
app.use(
  cors({
    origin: 'http://localhost:9000', // مكان الفرونت
    credentials: true, // لو بتستخدم كوكيز
  })
);

//global middlewares
//set security http headers
app.use(helmet());

//development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//set rate limt
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

//
app.use(express.json({ limit: '10kb' }));

//data sanitization against NoSQL query injection
app.use(ExpressMongoSanitize());

//data sanitization against XSS
app.use(xss());

//prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/review', reviewRouter);

//handel undefined routes
app.all('*', (req, res, next) => {
  next(new appError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//Error handling middleware
//when we pass 4 arguments express will understand that this is an error handling middleware
app.use(globalErrorHandler);

module.exports = app;
