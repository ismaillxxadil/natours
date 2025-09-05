module.exports = (fn) => {
  //return a middleware
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
