import { MongoClient } from 'mongodb';
import { URI } from './config/config';
const client = new MongoClient(URI, { useNewUrlParser: true, useUnifiedTopology: true });

export default async function connect() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('resources');
  } catch (err) {
    console.log(err.message, err.stack);
  }
}
