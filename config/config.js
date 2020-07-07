const URI = require('./URI');
const env = process.env.NODE_ENV || 'development';

const config = {
  URI: env === 'production' ? URI : `mongodb://localhost:27017/resources`,
  PORT: env === 'production' ? process.env.PORT : 50000
};

module.exports = config;
