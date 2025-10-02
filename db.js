const mongoose = require("mongoose");

// Connect to Atlas cluster and explicitly specify the database name `quizzapp` in the path.
// Note: for security, move credentials to environment variables instead of hard-coding them.
const user = encodeURIComponent('MMean');
const password = encodeURIComponent('nghia1340');
const host = 'cluster0.yjkd2dq.mongodb.net';
const dbName = 'quizzapp';
const query = 'retryWrites=true&w=majority&appName=Cluster0';

mongoose
  .connect(`mongodb+srv://${user}:${password}@${host}/${dbName}?${query}`)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));
