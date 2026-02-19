/**
 * Authentication Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and password required'
      });
    }
    
    // Find user
    const result = await db.query(
      'SELECT id, username, password FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    const user = result.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }
    
    // Generate token
    const token = generateToken(user);
    
    res.json({
      status: 'ok',
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.json({
      status: 'ok',
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current and new password required'
      });
    }
    
    if (newPassword.length < 4) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 4 characters'
      });
    }
    
    // Get current user
    const result = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
    
    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await db.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );
    
    res.json({
      status: 'ok',
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// POST /api/auth/register (for initial setup only)
router.post('/register', async (req, res) => {
  try {
    const { username, password, setupKey } = req.body;
    
    // Only allow if setup key matches or no users exist
    const userCount = await db.query('SELECT COUNT(*) FROM users');
    
    if (parseInt(userCount.rows[0].count) > 0 && setupKey !== process.env.SETUP_KEY) {
      return res.status(403).json({
        status: 'error',
        message: 'Registration disabled'
      });
    }
    
    if (!username || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Username and password required'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await db.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    
    res.status(201).json({
      status: 'ok',
      message: 'User created',
      user: result.rows[0]
    });
    
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        status: 'error',
        message: 'Username already exists'
      });
    }
    console.error('Register error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = router;
