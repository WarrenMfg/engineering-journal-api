const MongoClient = require('mongodb').MongoClient;
const { URI } = require('./config/config');
const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });

module.exports.connect = async () => {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('resources');
  } catch (err) {
    console.log(err.message, err.stack);
  }
};
