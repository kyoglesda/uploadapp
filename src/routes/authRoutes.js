// This file defines the routes for uploading audio files and authenticating with Google.

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route for authenticating with Google
router.get('/google', authController.authenticate);
router.get('/google/callback', authController.authenticateCallback);

module.exports = router;