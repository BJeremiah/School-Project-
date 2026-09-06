require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const pool = require('./config/db');
const socket = require('./config/socket');
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const directorRoutes = require('./routes/director');
const studentsRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const assessmentRoutes = require('./routes/assessment');
const secretaryRoutes = require('./routes/secretary');
const accountantRoutes = require('./routes/accountant');
const reportCardsRoutes = require('./routes/reportcards');
const profileRoutes = require('./routes/profile');
const app = express();
const httpServer = http.createServer(app);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
app.use('/api/students', studentsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/secretary', secretaryRoutes);
app.use('/api/accountant', accountantRoutes);
app.use('/api/reportcards', reportCardsRoutes);
app.use('/api/profile', profileRoutes);
socket.init(httpServer);
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Socket.io live feed ready.');
});