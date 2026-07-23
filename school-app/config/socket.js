let ioInstance = null;

function init(server) {
  const { Server } = require('socket.io');
  ioInstance = new Server(server, {
    cors: { origin: '*' },
  });

  ioInstance.on('connection', (socket) => {
    console.log('Client connected to live feed:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized yet. Call init(server) first.');
  }
  return ioInstance;
}

module.exports = { init, getIO };
