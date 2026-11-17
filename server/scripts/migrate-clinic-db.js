// One-time, non-destructive copy. Stop the API before running to avoid concurrent writes.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  try {
    await require('../config/db')();
    const client = mongoose.connection.getClient();
    const source = client.db('cvsu_infirmary');
    const target = client.db('clinic_db');
    const collections = await source.listCollections({ type: 'collection' }).toArray();
    if (!collections.length) throw new Error('Source database has no collections');
    if ((await target.listCollections().toArray()).length)
      throw new Error('clinic_db is not empty; refusing to overwrite existing data');
    for (const collection of collections) {
      const from = source.collection(collection.name);
      await target.createCollection(collection.name, collection.options || {});
      const to = target.collection(collection.name);
      for await (const document of from.find()) await to.insertOne(document);
      for (const index of await from.indexes()) {
        if (index.name === '_id_') continue;
        const { key, v, ns, ...options } = index;
        await to.createIndex(key, options);
      }
      const count = await to.countDocuments();
      if (count !== await from.countDocuments())
        throw new Error('Source changed during copy; stop the API and inspect both databases');
      console.log(`${collection.name}: ${count} documents copied`);
    }
    console.log('Copy verified. cvsu_infirmary is preserved as a backup.');
  } catch (error) {
    console.error('Migration did not complete. No source records were deleted. Inspect clinic_db before retrying.');
    // Do not print connection strings or driver diagnostics.
    if (['Source database has no collections', 'clinic_db is not empty; refusing to overwrite existing data',
      'Source changed during copy; stop the API and inspect both databases'].includes(error.message))
      console.error(error.message);
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
})();
