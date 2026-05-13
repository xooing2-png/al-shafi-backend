import { Router } from 'express';
import { pool } from '@/config/database';
import { authMiddleware } from '@/middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ==========================================
// NOTIFICATIONS
// ==========================================

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { userId, title, body, type, data } = req.body;
    const notificationId = uuidv4();

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO notifications (id, user_id, title, body, type, \`data\`, \`read\`, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW(3))`,
        [notificationId, userId, title, body, type || 'system', JSON.stringify(data ?? {})],
      );
      res.status(201).json({ id: notificationId });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    const currentUserId = req.user!.userId;
    
    // Users can only see their own notifications unless admin
    const targetUserId = (userId as string) || currentUserId;
    
    const connection = await pool.getConnection();
    try {
      const [notifications] = await connection.execute(
        `SELECT id, user_id, title, body, type, \`data\`, \`read\`, created_at
         FROM notifications 
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [targetUserId, parseInt(limit as string) || 50],
      );
      res.json(notifications);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.query;
    
    const connection = await pool.getConnection();
    try {
      await connection.execute(`UPDATE notifications SET \`read\` = 1 WHERE user_id = ?`, [
        (userId as string) || req.user!.userId,
      ]);
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.patch('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const connection = await pool.getConnection();
    try {
      await connection.execute(`UPDATE notifications SET \`read\` = 1 WHERE id = ?`, [notificationId]);
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.put('/:userId/push-token', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fcmToken, platform } = req.body;
    
    const connection = await pool.getConnection();
    try {
      // Upsert push token
      await connection.execute(
        `INSERT INTO user_tokens (user_id, fcm_token, platform, updated_at)
         VALUES (?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE fcm_token = VALUES(fcm_token), platform = VALUES(platform), updated_at = NOW(3)`,
        [userId, fcmToken, platform || 'android']
      );
      res.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Save push token error:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

export default router;
