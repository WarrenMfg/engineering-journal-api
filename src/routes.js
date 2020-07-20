import { ObjectId } from 'mongodb';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import validator from 'validator';

// create headless browser
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
DOMPurify.setConfig({ ALLOWED_TAGS: [] });

// confirm password
const hasPassword = (req, res, next) => {
  if (req.params.password === process.env.PASSWORD) next();
  else res.status(401).json({ message: 'Unauthorized' });
};

// utility
// escape
const escape = input => input.replace(/\./g, '\uFF0E').replace(/\$/g, '\uFF04');
// unescape
const unescape = input => input.replace(/\uFF0E/g, '.').replace(/\uFF04/g, '$');
// unescape all docs
const unescapeDocs = array => {
  array.forEach(doc => {
    // don't escape meta doc; only resource docs
    if (!doc.meta) {
      doc.description = unescape(doc.description);
      doc.keywords = doc.keywords.map(keyword => unescape(keyword));
      doc.link = unescape(doc.link);
    }
  });
  return array;
};

export default (app, db) => {
  app.get('/api/resources/:password/:collection', hasPassword, async (req, res) => {
    try {
      let { collection } = req.params;

      // ensure clean param
      collection = escape(DOMPurify.sanitize(collection));

      if (!collection) return res.status(400).json({ message: 'Bad Request' });

      // find all from collection and send
      let docs = await db.collection(collection).find().sort('createdAt', -1).toArray();
      docs = unescapeDocs(docs);

      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => unescape(col.namespace.split('.')[1]));

      // send docs and namespaces
      res.send({ docs, namespaces });
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.get('/api/collections/:password', hasPassword, async (req, res) => {
    try {
      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => unescape(col.namespace.split('.')[1]));

      // send namespaces and template
      res.send({ namespaces });
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.post('/api/resource/:password/:collection', hasPassword, async (req, res) => {
    try {
      let { collection } = req.params;

      // confirm type
      let { createdAt, keywords } = req.body;
      if (typeof createdAt !== 'number' || !Array.isArray(keywords)) {
        return res.status(400).json({ message: 'Bad Request' });
      }

      // sanitize
      collection = escape(DOMPurify.sanitize(collection));
      let description = escape(DOMPurify.sanitize(req.body.description));
      let link = DOMPurify.sanitize(req.body.link);
      keywords = req.body.keywords.reduce((arr, keyword) => {
        keyword = escape(DOMPurify.sanitize(keyword));
        if (keyword) arr.push(keyword);
        return arr;
      }, []);

      if (!collection || !description || !keywords.length || !validator.isURL(link)) {
        return res.status(400).json({ message: 'Bad Request' });
      }

      // insert doc
      let newDoc = await db
        .collection(collection)
        .insertOne({ description, keywords, link: escape(link), createdAt });

      // unescape
      newDoc = unescapeDocs(newDoc.ops);

      // send back new doc
      res.send(newDoc[0]);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.post('/api/collection/:password', hasPassword, async (req, res) => {
    try {
      let { collection } = req.body;

      // ensure clean payload
      collection = escape(DOMPurify.sanitize(collection));

      if (!collection) return res.status(400).json({ message: 'Bad Request' });

      // create collection
      const newCollection = await db.createCollection(collection);
      const newNamespace = unescape(newCollection.namespace.split('.')[1]);

      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => unescape(col.namespace.split('.')[1]));

      // send namespaces and template
      res.send({ newNamespace, namespaces });
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put('/api/resource/add-pin/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      collection = escape(DOMPurify.sanitize(collection));
      id = escape(DOMPurify.sanitize(id));

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      // query id and add isPinned: true
      let pinnedDoc = await db
        .collection(collection)
        .findOneAndUpdate(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { isPinned: true } },
          { returnOriginal: false }
        );

      // query meta and push id to pins array
      await db
        .collection(collection)
        .findOneAndUpdate({ meta: true }, { $push: { pins: id } }, { upsert: true });

      // unescape
      pinnedDoc = unescapeDocs([ pinnedDoc.value ]);

      // send it back
      res.send(pinnedDoc[0]);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put('/api/resource/remove-pin/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      collection = escape(DOMPurify.sanitize(collection));
      id = escape(DOMPurify.sanitize(id));

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      // query id and remove isPinned: true
      let unpinnedDoc = await db
        .collection(collection)
        .findOneAndUpdate(
          { _id: ObjectId.createFromHexString(id) },
          { $unset: { isPinned: true } },
          { returnOriginal: false }
        );

      // query meta and pull id from pins array
      await db.collection(collection).findOneAndUpdate({ meta: true }, { $pull: { pins: id } });

      // unescape
      unpinnedDoc = unescapeDocs([ unpinnedDoc.value ]);

      // send it back
      res.send(unpinnedDoc[0]);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put(
    '/api/resource/:password/:fromCollection/:toCollection/:id',
    hasPassword,
    async (req, res) => {
      try {
        let { fromCollection, toCollection, id } = req.params;

        // ensure clean params
        fromCollection = escape(DOMPurify.sanitize(fromCollection));
        toCollection = escape(DOMPurify.sanitize(toCollection));
        id = escape(DOMPurify.sanitize(id));

        if (!fromCollection || !toCollection || !id || !Array.isArray(req.body.keywords)) {
          return res.status(400).json({ message: 'Bad Request' });
        }

        // ensure body only contains sanitized description, keywords, and link
        const description = escape(DOMPurify.sanitize(req.body.description));
        const keywords = req.body.keywords.reduce((arr, keyword) => {
          keyword = escape(DOMPurify.sanitize(keyword));
          if (keyword) arr.push(keyword);
          return arr;
        }, []);
        const link = DOMPurify.sanitize(req.body.link);

        if (!description || !keywords.length || !validator.isURL(link)) {
          return res.status(400).json({ message: 'Bad Request' });
        }

        // if fromCollection and toCollection are equal
        if (fromCollection === toCollection) {
          // find and update doc
          let updatedDoc = await db
            .collection(fromCollection)
            .findOneAndUpdate(
              { _id: ObjectId.createFromHexString(id) },
              { $set: { description, keywords, link: escape(link) } },
              { returnOriginal: false }
            );

          if (!updatedDoc.value) {
            // no resource
            res.status(400).json({ message: 'Resource could not be found.' });
          } else {
            // unescape
            updatedDoc = unescapeDocs([ updatedDoc.value ]);
            // send it back
            res.send(updatedDoc[0]);
          }

          // otherwise, delete doc fromCollection and insert toCollection
        } else {
          // delete doc from fromCollection
          let deletedDoc = await db
            .collection(fromCollection)
            .findOneAndDelete({ _id: ObjectId.createFromHexString(id) });

          if (!deletedDoc.value) {
            // no resource
            res.status(400).json({ message: 'Resource could not be found.' });
          }

          if (deletedDoc.value.isPinned) {
            // query meta and pull id from pins array
            await db
              .collection(fromCollection)
              .findOneAndUpdate({ meta: true }, { $pull: { pins: id } });
          }

          // insert doc in toCollection
          let newDoc = await db.collection(toCollection).insertOne(deletedDoc.value);

          if (deletedDoc.value.isPinned) {
            await db
              .collection(toCollection)
              .findOneAndUpdate({ meta: true }, { $push: { pins: id } }, { upsert: true });
          }

          // unescape
          newDoc = unescapeDocs(newDoc.ops);

          // send back new doc
          res.send(newDoc[0]);
        }
      } catch (err) {
        console.log(err.message, err.stack);
        res.status(400).json({ message: 'Bad Request' });
      }
    }
  );

  app.put(
    '/api/collection/:password/:fromCollection/:toCollection',
    hasPassword,
    async (req, res) => {
      try {
        let { fromCollection, toCollection } = req.params;

        // ensure clean params
        fromCollection = escape(DOMPurify.sanitize(fromCollection));
        toCollection = escape(DOMPurify.sanitize(toCollection));

        if (!fromCollection || !toCollection) {
          return res.status(400).json({ message: 'Bad Request' });
        }

        // rename collection
        const updatedCollection = await db.renameCollection(fromCollection, toCollection);

        // get all namespaces
        const collections = await db.collections();
        const namespaces = collections.map(col => unescape(col.namespace.split('.')[1]));

        res.send({
          updatedCollection: unescape(updatedCollection.namespace.split('.')[1]),
          namespaces
        });
      } catch (err) {
        console.log(err.message, err.stack);
        res.status(400).json({ message: 'Bad Request' });
      }
    }
  );

  app.delete('/api/resource/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      collection = escape(DOMPurify.sanitize(collection));
      id = escape(DOMPurify.sanitize(id));

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      let deletedDoc = await db
        .collection(collection)
        .findOneAndDelete({ _id: ObjectId.createFromHexString(id) });

      if (!deletedDoc.value) {
        // no resource
        res.status(400).json({ message: 'Resource could not be found.' });
      } else {
        // query meta and pull id from pins array
        await db.collection(collection).findOneAndUpdate({ meta: true }, { $pull: { pins: id } });

        // unescape
        deletedDoc = unescapeDocs([ deletedDoc.value ]);
        // send deleted doc back
        res.send(deletedDoc[0]);
      }
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.delete('/api/collection/:password/:collection', hasPassword, async (req, res) => {
    try {
      let { collection } = req.params;

      // ensure clean param
      collection = escape(DOMPurify.sanitize(collection));

      if (!collection) return res.status(400).json({ message: 'Bad Request' });

      // drop collection
      const dropped = await db.dropCollection(collection);

      // if not found, send message
      if (!dropped) return res.status(404).json({ message: 'Not Found' });
      // otherwise, send it
      res.send({ dropped });
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });
};

function wait() {
  return new Promise(resolve => setTimeout(() => resolve(), 2000));
}
