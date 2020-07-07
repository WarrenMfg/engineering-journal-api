const express = require('express');
const app = express();
const { connect } = require('./db');
const { ObjectId } = require('mongodb');
const morgan = require('morgan');
const cors = require('cors');
const { PORT } = require('./config/config');
let db;

// middleware
app.use(morgan('dev'));
app.use(
  cors({
    origin: '*',
    methods: 'GET,POST,DELETE,OPTIONS',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 7200
  })
);
app.use(express.json());

// api
app.get('/api/resources/:collection', async (req, res) => {
  try {
    // find all from collection and send
    const docs = await db.collection(req.params.collection).find().toArray();
    // send docs
    res.send(docs);
  } catch (err) {
    console.log(err.message, err.stack);
    res.status(400).json({ message: 'Bad Request' });
  }
});

app.post('/api/resource', async (req, res) => {
  try {
    let { collection, description, keywords, resource } = req.body;
    // split on commas and remove white space
    keywords = keywords.split(',').reduce((arr, keyword) => {
      if (keyword) arr.push(keyword.trim());
      return arr;
    }, []);
    // insert doc
    const newDoc = await db.collection(collection).insertOne({ description, keywords, resource });
    // send back new doc
    res.send(newDoc);
  } catch (err) {
    console.log(err.message, err.stack);
    res.status(400).json({ message: 'Bad Request' });
  }
});

app.put('/api/resource/:collection/:id', async (req, res) => {
  try {
    const { collection, id } = req.params;

    // find and update doc
    const updatedDoc = await db
      .collection(collection)
      .findOneAndUpdate(
        { _id: ObjectId.createFromHexString(id) },
        { $set: { ...req.body } },
        { returnOriginal: false }
      );
    // send it back
    res.send(updatedDoc);
  } catch (err) {
    console.log(err.message, err.stack);
    res.send(400).json({ message: 'Bad Request' });
  }
});

// connections
(async () => {
  try {
    // mongodb
    db = await connect();
    // express
    app.listen(PORT, () => console.log(`API listening ${PORT}`));
  } catch (err) {
    console.log(err.message, err.stack);
  }
})();
