import { MongoClient } from 'mongodb';
const URI = process.env.NODE_ENV === 'production' ? process.env.MONGO_ATLAS_URI : process.env.URI;
const client = new MongoClient(URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

export default async function connect() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('resources');
  } catch (err) {
    console.log(err.message, err.stack);
  }
}
