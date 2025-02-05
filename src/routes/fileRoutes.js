// This file defines the routes for uploading audio files and authenticating with Google.

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

// Route for uploading audio files
router.post('/upload', fileController.uploadAudio);

module.exports = router;