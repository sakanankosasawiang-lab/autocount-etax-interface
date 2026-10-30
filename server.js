const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./server/routes');
const { startScheduler } = require('./server/scheduler');
const { ensureCompanyFolders } = require('./server/processor');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ and frontend/
app.use(express.static(path.join(__dirname, 'public')));
app.use('/autocount-poc', express.static(path.join(__dirname, 'frontend')));

// API Routes
app.use('/api', apiRoutes);

// Fallback for SPA navigation
app.use((req, res) => {
  if (req.path.startsWith('/autocount-poc')) {
    return res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start scheduler and server safely
try {
  ensureCompanyFolders();
} catch (e) {
  console.warn('ensureCompanyFolders warning:', e.message);
}

try {
  startScheduler();
} catch (e) {
  console.warn('startScheduler warning:', e.message);
}

if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Flex Interface e-Tax (Autocount >> iNet One.th)`);
    console.log(` Running at: http://localhost:${PORT}`);
    console.log(` AutoCount POC at: http://localhost:${PORT}/autocount-poc`);
    console.log(`====================================================`);
  });
}

module.exports = app;
