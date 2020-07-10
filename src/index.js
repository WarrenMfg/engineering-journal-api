import express, { json } from 'express';
import connect from './db';
import morgan from 'morgan';
import cors from 'cors';
import { PORT } from './config/config';
import routes from './routes';

const app = express();
let db;

// middleware
app.use(morgan('dev'));
app.use(
  cors({
    origin: '*',
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 7200
  })
);
app.use(json());

// connections and api
(async () => {
  try {
    // mongodb
    db = await connect();
    // api
    routes(app, db);
    // express
    app.listen(PORT, () => console.log(`API listening ${PORT}`));
  } catch (err) {
    console.log(err.message, err.stack);
  }
})();
