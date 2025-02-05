// FILE: /node-audio-upload-app/node-audio-upload-app/src/controllers/fileController.js

const { authenticate, authenticateCallback, generateAuthUrl } = require('../services/googleDriveService');

exports.authenticate = async (req, res) => {
    try {
        try {
            // Check if authenticated with Google Drive.
            await authenticate();
            res.status(200).send('Already authenticated.');
        }
        catch (error) {
            // Not authenticated, redirect to Google OAuth.
            const redirectUrl = await generateAuthUrl();
            res.redirect(redirectUrl);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);
    }
};
exports.authenticateCallback = async (req, res) => {
    try {
        const { code } = req.query;
        await authenticateCallback(code);
        res.status(200).send('Authenticated successfully. <a href="/">Go back</a>');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while authenticating.');
    }
};
