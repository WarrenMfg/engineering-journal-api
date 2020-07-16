import { ObjectId } from 'mongodb';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// create headless browser
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
DOMPurify.setConfig({ ALLOWED_TAGS: [] });

// confirm password
const hasPassword = (req, res, next) => {
  if (req.params.password === process.env.PASSWORD) next();
  else res.status(401).json({ message: 'Unauthorized' });
};

export default (app, db) => {
  app.get('/api/resources/:password/:collection', hasPassword, async (req, res) => {
    try {
      let { collection } = req.params;

      // ensure clean param
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      collection = DOMPurify.sanitize(collection);

      if (!collection) return res.status(400).json({ message: 'Bad Request' });

      // find all from collection and send
      const docs = await db.collection(collection).find().sort('createdAt', -1).toArray();

      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => col.namespace.split('.')[1]);

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
      const namespaces = collections.map(col => col.namespace.split('.')[1]);

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

      // ensure clean param
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');

      // confirm type
      let { createdAt } = req.body;
      if (typeof createdAt !== 'number') return res.status(400).json({ message: 'Bad Request' });

      // sanitize
      collection = DOMPurify.sanitize(collection);
      let description = DOMPurify.sanitize(req.body.description);
      let link = DOMPurify.sanitize(req.body.link);
      let keywords = req.body.keywords.reduce((arr, keyword) => {
        keyword = DOMPurify.sanitize(keyword);
        if (keyword) arr.push(keyword);
        return arr;
      }, []);

      if (!collection || !description || !keywords.length || !link) {
        return res.status(400).json({ message: 'Bad Request' });
      }

      // insert doc
      const newDoc = await db
        .collection(collection)
        .insertOne({ description, keywords, link, createdAt });

      // send back new doc
      res.send(newDoc.ops[0]);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.post('/api/collection/:password', hasPassword, async (req, res) => {
    try {
      let { collection } = req.body;

      // ensure clean payload
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      collection = DOMPurify.sanitize(collection);

      if (!collection) return res.status(400).json({ message: 'Bad Request' });

      // create collection
      const newCollection = await db.createCollection(collection);
      const newNamespace = newCollection.namespace.split('.')[1];

      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => col.namespace.split('.')[1]);

      // send namespaces and template
      res.send({ newNamespace, namespaces });
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put('/api/resource/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');
      collection = DOMPurify.sanitize(collection);
      id = DOMPurify.sanitize(id);

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      // ensure body only contains sanitized description, keywords, and link
      const body = {
        description: DOMPurify.sanitize(req.body.description),
        keywords: req.body.keywords.reduce((arr, keyword) => {
          keyword = DOMPurify.sanitize(keyword);
          if (keyword) arr.push(keyword);
          return arr;
        }, []),
        link: DOMPurify.sanitize(req.body.link)
      };

      if (!body.description || !body.keywords.length || !body.link)
        return res.status(400).json({ message: 'Bad Request' });

      // find and update doc
      const updatedDoc = await db
        .collection(collection)
        .findOneAndUpdate(
          { _id: ObjectId.createFromHexString(id) },
          { $set: { ...body } },
          { returnOriginal: false }
        );

      if (!updatedDoc.value) {
        // no resource
        res.status(400).json({ message: 'Resource could not be found.' });
      } else {
        // send it back
        res.send(updatedDoc.value);
      }
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put('/api/resource/add-pin/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');
      collection = DOMPurify.sanitize(collection);
      id = DOMPurify.sanitize(id);

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      // query id and add isPinned: true
      const pinnedDoc = await db
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

      res.send(pinnedDoc.value);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put('/api/resource/remove-pin/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      let { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');
      collection = DOMPurify.sanitize(collection);
      id = DOMPurify.sanitize(id);

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      // query id and remove isPinned: true
      const unpinnedDoc = await db
        .collection(collection)
        .findOneAndUpdate(
          { _id: ObjectId.createFromHexString(id) },
          { $unset: { isPinned: true } },
          { returnOriginal: false }
        );

      // query meta and pull id from pins array
      await db.collection(collection).findOneAndUpdate({ meta: true }, { $pull: { pins: id } });

      res.send(unpinnedDoc.value);
    } catch (err) {
      console.log(err.message, err.stack);
      res.status(400).json({ message: 'Bad Request' });
    }
  });

  app.put(
    '/api/collection/:password/:fromCollection/:toCollection',
    hasPassword,
    async (req, res) => {
      try {
        let { fromCollection, toCollection } = req.params;

        // ensure clean params
        if (/^\$|/.test(fromCollection)) throw new Error('No topic with that name.');
        if (/^\$|/.test(toCollection)) throw new Error('Not a valid topic name.');
        fromCollection = DOMPurify.sanitize(fromCollection.trim());
        toCollection = DOMPurify.sanitize(toCollection.trim());

        if (!fromCollection || !toCollection) {
          return res.status(400).json({ message: 'Bad Request' });
        }

        // rename collection
        const updatedCollection = await db.renameCollection(fromCollection, toCollection);

        // get all namespaces
        const collections = await db.collections();
        const namespaces = collections.map(col => col.namespace.split('.')[1]);

        res.send({ updatedCollection: updatedCollection.namespace.split('.')[1], namespaces });
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
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');
      collection = DOMPurify.sanitize(collection);
      id = DOMPurify.sanitize(id);

      if (!collection || !id) return res.status(400).json({ message: 'Bad Request' });

      const deletedDoc = await db
        .collection(collection)
        .findOneAndDelete({ _id: ObjectId.createFromHexString(id) });

      if (!deletedDoc.value) {
        // no resource
        res.status(400).json({ message: 'Resource could not be found.' });
      } else {
        // query meta and pull id from pins array
        await db.collection(collection).findOneAndUpdate({ meta: true }, { $pull: { pins: id } });

        // send deleted doc back
        res.send(deletedDoc.value);
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
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      collection = DOMPurify.sanitize(collection);

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
