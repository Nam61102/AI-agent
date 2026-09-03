const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const supabase = require('./src/config/supabase');
const whatsappRoutes = require('./src/routes/whatsapp.routes');
const extractionsRoutes = require('./src/routes/extractions.routes');
const whatsappClient = require('./src/whatsapp/whatsapp.client');
const messageProcessor = require('./src/services/message-processor.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Attach Socket.IO to WhatsApp client
whatsappClient.setSocketIO(io);

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, '../frontend')));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NRYN backend is running',
    database: 'connected',
    whatsapp: whatsappClient.getStatus()
  });
});

const aiRoutes = require('./src/routes/ai.routes');

// WhatsApp API endpoints
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/extractions', extractionsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', aiRoutes);

// Handle server errors gracefully (e.g. EADDRINUSE)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use by an existing backend process.`);
    console.error(`Automated fix: Freeing port ${PORT}...\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

async function startServer() {
  await supabase.query('SELECT 1');
  console.log('Supabase database connected successfully');

  // Attempt auto-reconnect if session exists
  await whatsappClient.initOnStartup();

  server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    messageProcessor.processPendingMessages();
  });
}

startServer().catch((error) => {
  console.error('Supabase database connection failed:', error.message);
  process.exit(1);
});
