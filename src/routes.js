import { ObjectId } from 'mongodb';

const hasPassword = (req, res, next) => {
  if (req.params.password === process.env.PASSWORD) next();
  else res.status(401).json({ message: 'Unauthorized' });
};

export default (app, db) => {
  app.get('/api/resources/:password/:collection', hasPassword, async (req, res) => {
    try {
      const { collection } = req.params;

      // ensure clean param
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');

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
    }
  });

  app.post('/api/resource/:password/:collection', hasPassword, async (req, res) => {
    try {
      const { collection } = req.params;

      // ensure clean param
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');

      let { description, keywords, link, createdAt } = req.body;

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
      // create collection
      await db.createCollection(req.body.collection);

      // make template

      // get all collection names
      const collections = await db.collections();
      const namespaces = collections.map(col => col.namespace.split('.')[1]);

      // send namespaces and template
      res.send({ namespaces });
    } catch (err) {
      console.log(err.message, err.stack);
    }
  });

  app.put('/api/resource/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      const { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');

      // ensure body only contains description, keywords, and link
      const body = {
        description: req.body.description,
        keywords: req.body.keywords,
        link: req.body.link
      };

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
      const { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');

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
    }
  });

  app.put('/api/resource/remove-pin/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      const { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');

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
    }
  });

  app.delete('/api/resource/:password/:collection/:id', hasPassword, async (req, res) => {
    try {
      const { collection, id } = req.params;

      // ensure clean params
      if (/^\$/.test(collection)) throw new Error('No topic with that name.');
      if (/^\$/.test(id)) throw new Error('No resource with that id.');

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
};

function wait() {
  return new Promise(resolve => setTimeout(() => resolve(), 2000));
}
