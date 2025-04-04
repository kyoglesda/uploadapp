// FILE: /node-audio-upload-app/node-audio-upload-app/src/controllers/fileController.js

const {uploadFile, shareFile, authenticate} = require('../services/googleDriveService');
const {fetchLatestChanges, commitChanges, pushChanges} = require('../services/githubService');
const appConfig = require('../../config/app.json');
const formidable = require('formidable');
const leftPad = require('left-pad');
const {Feed} = require('../feed');
const {Episode} = require('../episode');
const {getAudioDurationInSeconds} = require('get-audio-duration');
const fs = require('fs').promises;

exports.uploadAudio = async (req, res) => {
    try {
        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err != null) {
                console.error(err);
                return res.status(500).send('An error occurred while uploading the file. ' + err);
            }

            await processRequest(res, files.audio[0], fields.speaker[0], fields.title[0], fields.description[0]);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while uploading the file.');
    }
};

const processRequest = async (res, audioFile, speaker, sermonTitle, description) => {
    if (!speaker || !sermonTitle) {
        return res.status(400).send('Speaker and title are required.');
    }
    if (!audioFile) {
        return res.status(400).send('No file uploaded.');
    }
    const now = new Date();
    const newFileName = `${now.getFullYear()}-${leftPad(now.getMonth(), 2, '0')}-${leftPad(now.getDate(), 2, '0')} ${speaker} - ${sermonTitle}.mp3`;
    
    const auth = await authenticate();
    
    await fetchLatestChanges(appConfig.feedRepo);
    
    const size = audioFile.size;
    
    const duration = await getAudioDurationInSeconds(audioFile.filepath);
    
    // Upload the audio file to Google Drive
    const driveResponse = await uploadFile(auth, audioFile.filepath, newFileName);
    const shareLink = await shareFile(auth, driveResponse);
    const episodeTitle = `${speaker} - ${sermonTitle}`;
    const episode = new Episode(episodeTitle, description, shareLink, size, duration);
    const filePath = combinePath(appConfig.feedRepo, 'rss_feed.xml');
    const feed = Feed.fromFile(filePath);
    await feed.addEpisode(episode);

    const textToRemove = ' xmlns="http://www.w3.org/1999/xhtml"';
    await removeTextFromFile(filePath, textToRemove);

    await commitChanges(appConfig.feedRepo, episodeTitle);
    await pushChanges(appConfig.feedRepo);

    res.status(200).send('File uploaded and RSS feed updated successfully.');
};

const combinePath = (path1, path2) => {
    return path1.replace(/\/$/, '') + '/' + path2.replace(/^\//, '');
};

async function removeTextFromFile(filePath, textToRemove) {
    try {
        // Read the file content
        let data = await fs.readFile(filePath, 'utf8');

        // Remove all instances of the specified text
        const updatedData = data.replace(new RegExp(textToRemove, 'g'), '');

        // Write the updated content back to the file
        await fs.writeFile(filePath, updatedData, 'utf8');
    } catch (err) {
        console.error(`Error reading file: ${err}`);
    }
}
