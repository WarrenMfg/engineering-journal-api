import MONGO_ATLAS_URI from './URI';
const env = process.env.NODE_ENV || 'development';

export const URI = env === 'production' ? MONGO_ATLAS_URI : 'mongodb://localhost:27017/resources';
export const PORT = env === 'production' ? process.env.PORT : 50000;
