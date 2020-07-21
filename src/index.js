import express, { json } from 'express';
import connect from './db';
// import morgan from 'morgan';
import cors from 'cors';
import routes from './routes';
import { resolve } from 'path';

const app = express();
app.disable('x-powered-by');
let db;

// middleware
// app.use(morgan('dev'));
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
app.use(express.static(resolve(__dirname, '../client')));

// connections and api
(async () => {
  try {
    // mongodb
    db = await connect();
    // api
    routes(app, db);
    // express
    app.listen(process.env.PORT, () => console.log(`API listening ${process.env.PORT}`));
  } catch (err) {
    console.log(err.message, err.stack);
  }
})();
