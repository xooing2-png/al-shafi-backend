import os from 'os';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from '@/config/database';
import { runMigrations } from '@/scripts/migrate';

import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import appointmentRoutes from '@/routes/appointments';
import clinicRoutes from '@/routes/clinics';
import notificationRoutes from '@/routes/notifications';
import labRoutes from '@/routes/labs';
import pharmacyRoutes from '@/routes/pharmacies';
import nurseRoutes from '@/routes/nurses';
import hospitalRoutes from '@/routes/hospitals';
import serviceRoutes from '@/routes/services';
import docStoreRoutes from '@/routes/docStore';
import fileRoutes from '@/routes/files';

dotenv.config();

function logLanApiBases(port: number): void {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const n of list) {
      if (n.family === 'IPv4' && !n.internal && n.address) ips.push(n.address);
    }
  }
  if (ips.length === 0) return;
  console.log('📡 من الهاتف استخدم أحد العناوين (مع /api):');
  for (const ip of ips) {
    console.log(`   http://${ip}:${port}/api`);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
// TRIGGER-DEPLOY-TEST
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    codeVersion: 'v5-test',
    timestamp: new Date().toISOString() 
  });
});

// Debug endpoint - check if code is updated
app.get('/debug', (req, res) => {
  res.json({ 
    codeVersion: 'v3', 
    time: new Date().toISOString(),
    message: 'This endpoint was added to test if code is updated' 
  });
});

// Diagnostic endpoint
app.get('/api/diag', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Check if clinics table exists
      const [tables] = await connection.execute(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
      );
      const tableNames = (tables as { TABLE_NAME: string }[]).map((t) => t.TABLE_NAME);
      
      // Check if users table has data
      const [userCount] = await connection.execute('SELECT COUNT(*) as c FROM users');
      const usersCount = Number((userCount as { c: number }[])[0]?.c ?? 0);
      
      // Check if clinics table has data
      const [clinicCount] = await connection.execute('SELECT COUNT(*) as c FROM clinics');
      const clinicsCount = Number((clinicCount as { c: number }[])[0]?.c ?? 0);
      
      res.json({
        tables: tableNames,
        usersCount,
        clinicsCount,
        status: 'ok',
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Diagnostic failed', detail: message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/nurses', nurseRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/doc-store', docStoreRoutes);
app.use('/api/files', fileRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('Cannot start server without database connection');
      process.exit(1);
    }

    // Run migrations to ensure schema is up to date
    console.log('Running database migrations...');
    await runMigrations();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT} (all interfaces)`);
      logLanApiBases(PORT);
      console.log(`📝 Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;