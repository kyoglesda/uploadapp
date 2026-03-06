// This file defines the routes for uploading audio files and authenticating with Google.

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

// Route for uploading audio files (and optional PDF attachment)
router.post('/upload', fileController.uploadAudio);

// Route for listing all feed entries
router.get('/entries', fileController.listEntries);

// Route for updating an existing feed entry by GUID
router.put('/entries/:guid', fileController.updateEntry);

module.exports = router;
