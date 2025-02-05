// This file contains functions for interacting with Google Drive, including authentication, uploading files, and sharing links.

const {google} = require('googleapis');
const fs = require('fs');
const path = require('path');
const {OAuth2Client} = require('google-auth-library');

// Load client secrets from a local file.
const CREDENTIALS_PATH = path.join(__dirname, '../../config/google_app.json');
const TOKEN_PATH = path.join(__dirname, '../../config/token.json');

async function authenticate() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
    } else {
        throw new Error('No token found. Please authenticate first.');
    }

    return oAuth2Client;
}

async function generateAuthUrl() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file']
    });

    return authUrl;
}

async function authenticateCallback(code) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const token = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(token.tokens);

    // Store the token to disk for later program executions
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token.tokens));
}

/**
 * Uploads a file to Google Drive.
 * @param {OAuth2Client} auth
 * @param {String} filePath
 * @returns file ID
 */
async function uploadFile(auth, filePath, fileName) {
    const drive = google.drive({version: 'v3', auth});
    const fileMetadata = {
        name: fileName,
        mimeType: 'audio/mpeg',
        parents: ['1eQYwSa8D7852nJG-LFVVAIGsiYU6ct0W']
    };
    const media = {
        mimeType: 'audio/mpeg',
        body: fs.createReadStream(filePath)
    };

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media
        });
        return response.data.id;
    } catch (error) {
        throw new Error('Error uploading file: ' + error.message);
    }
}

/**
 * Sets the sharing settings to public, anyone with the link can view.
 * @param {OAuth2Client} auth
 * @param {*} fileId
 * @returns The raw download link.
 */
async function shareFile(auth, fileId) {
    const drive = google.drive({version: 'v3', auth});
    const permission = {
        type: 'anyone',
        role: 'reader'
    };

    try {
        await drive.permissions.create({
            resource: permission,
            fileId: fileId
        });
        return `https://drive.google.com/uc?id=${fileId}`;
    } catch (error) {
        throw new Error('Error sharing file: ' + error.message);
    }
}

module.exports = {
    authenticate,
    generateAuthUrl,
    authenticateCallback,
    uploadFile,
    shareFile
};
