require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const pool = require('./config/db');
const socket = require('./config/socket');

const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const directorRoutes = require('./routes/director');

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/director', directorRoutes);

socket.init(httpServer);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Socket.io live feed ready.');
});
