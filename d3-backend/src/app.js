const express = require('express');
const circlesRouter = require('./routes/circles.routes');

const app = express();

app.use(express.json());

app.use('/circles', circlesRouter);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

module.exports = app;