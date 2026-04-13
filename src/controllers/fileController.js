// FILE: /node-audio-upload-app/node-audio-upload-app/src/controllers/fileController.js

const {uploadFile, shareFile, uploadPdf, sharePdf, authenticate} = require('../services/googleDriveService');
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
        const form = new formidable.IncomingForm({ allowEmptyFiles: true, minFileSize: 0 });
        form.parse(req, async (err, fields, files) => {
            if (err != null) {
                console.error(err);
                return res.status(500).send('An error occurred while uploading the file. ' + err);
            }

            const pdfFile = (files.pdf?.[0]?.size > 0) ? files.pdf[0] : null;
            const audioFile = (files.audio?.[0]?.size > 0) ? files.audio[0] : null;
            await processRequest(res, audioFile, fields.speaker[0], fields.title[0], fields.description[0], pdfFile);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while uploading the file.');
    }
};

const processRequest = async (res, audioFile, speaker, sermonTitle, description, pdfFile = null) => {
    if (!speaker || !sermonTitle) {
        return res.status(400).send('Speaker and title are required.');
    }
    if (!audioFile) {
        return res.status(400).send('No file uploaded.');
    }
    const now = new Date();
    const datePart = `${now.getFullYear()}-${leftPad(now.getMonth() + 1, 2, '0')}-${leftPad(now.getDate(), 2, '0')}`;
    const newFileName = `${datePart} ${speaker} - ${sermonTitle}.mp3`;

    const auth = await authenticate();

    await fetchLatestChanges(appConfig.feedRepo);

    const size = audioFile.size;

    const duration = await getAudioDurationInSeconds(audioFile.filepath);

    // Upload the audio file to Google Drive
    const driveResponse = await uploadFile(auth, audioFile.filepath, newFileName);
    const shareLink = await shareFile(auth, driveResponse);

    // Optionally upload a PDF and append links to description
    let finalDescription = description || '';
    if (pdfFile) {
        const pdfFileName = `${datePart} ${speaker} - ${sermonTitle}.pdf`;
        const pdfFileId = await uploadPdf(auth, pdfFile.filepath, pdfFileName);
        const pdfLinks = await sharePdf(auth, pdfFileId);
        const pdfLinkText = `Please view the <a href="${pdfLinks.viewerLink}">presentation slides on Google Drive</a> or view the <a href="${pdfLinks.directLink}">PDF directly here</a>.`;
        finalDescription = finalDescription ? `${finalDescription} ${pdfLinkText}` : pdfLinkText;
    }

    const episodeTitle = `${speaker} - ${sermonTitle}`;
    const episode = new Episode(episodeTitle, finalDescription, shareLink, size, duration);
    const filePath = combinePath(appConfig.feedRepo, 'rss_feed.xml');
    const feed = Feed.fromFile(filePath);
    await feed.addEpisode(episode);

    const textToRemove = ' xmlns="http://www.w3.org/1999/xhtml"';
    await removeTextFromFile(filePath, textToRemove);

    await commitChanges(appConfig.feedRepo, episodeTitle);
    //await pushChanges(appConfig.feedRepo);

    console.log(`${new Date().toISOString()} File uploaded and RSS feed updated successfully.`);
    res.status(200).send('File uploaded and RSS feed updated successfully.');
};

exports.listEntries = async (req, res) => {
    try {
        await fetchLatestChanges(appConfig.feedRepo);
        const filePath = combinePath(appConfig.feedRepo, 'rss_feed.xml');
        const feed = Feed.fromFile(filePath);
        const episodes = await feed.getEpisodes();
        res.status(200).json(episodes);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while reading the feed.');
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const {guid} = req.params;
        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err != null) {
                console.error(err);
                return res.status(500).send('Error parsing form: ' + err);
            }
            const title = fields.title ? fields.title[0] : undefined;
            const description = fields.description !== undefined ? fields.description[0] : undefined;
            const pubDate = fields.pubDate ? fields.pubDate[0] : undefined;
            const pdfFile = (files.pdf?.[0]?.size > 0) ? files.pdf[0] : null;
            await processUpdate(res, guid, title, description, pdfFile, pubDate);
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while updating the entry.');
    }
};

const processUpdate = async (res, guid, title, description, pdfFile = null, pubDate = undefined) => {
    if (!title && description === undefined && !pdfFile && pubDate === undefined) {
        return res.status(400).send('At least one field (title, description, pubDate, or PDF) must be provided.');
    }

    let finalDescription = description;

    if (pdfFile) {
        const auth = await authenticate();
        const now = new Date();
        const datePart = `${now.getFullYear()}-${leftPad(now.getMonth() + 1, 2, '0')}-${leftPad(now.getDate(), 2, '0')}`;
        const pdfFileName = title ? `${datePart} ${title}.pdf` : `${datePart} ${guid}.pdf`;
        const pdfFileId = await uploadPdf(auth, pdfFile.filepath, pdfFileName);
        const pdfLinks = await sharePdf(auth, pdfFileId);
        const pdfLinkText = `Please view the <a href="${pdfLinks.viewerLink}">presentation slides on Google Drive</a> or view the <a href="${pdfLinks.directLink}">PDF directly here</a>.`;
        finalDescription = finalDescription !== undefined && finalDescription !== ''
            ? `${finalDescription} ${pdfLinkText}`
            : pdfLinkText;
    }

    const filePath = combinePath(appConfig.feedRepo, 'rss_feed.xml');
    const feed = Feed.fromFile(filePath);

    try {
        await fetchLatestChanges(appConfig.feedRepo);
        await feed.updateEpisode(guid, {title, description: finalDescription, pubDate});

        const textToRemove = ' xmlns="http://www.w3.org/1999/xhtml"';
        await removeTextFromFile(filePath, textToRemove);

        await commitChanges(appConfig.feedRepo, `Update entry: ${title || guid}`);
        await pushChanges(appConfig.feedRepo);

        res.status(200).send('Entry updated successfully.');
    } catch (error) {
        console.error(error);
        if (error.message && error.message.includes('not found')) {
            return res.status(404).send(error.message);
        }
        res.status(500).send('An error occurred while updating the entry.');
    }
};

const combinePath = (path1, path2) => {
    return path1.replace(/\/$/, '') + '/' + path2.replace(/^\//, '');
};

async function removeTextFromFile(filePath, textToRemove) {
    try {
        let data = await fs.readFile(filePath, 'utf8');
        const updatedData = data.replace(new RegExp(textToRemove, 'g'), '');
        await fs.writeFile(filePath, updatedData, 'utf8');
    } catch (err) {
        console.error(`Error reading file: ${err}`);
    }
}

module.exports.processRequest = processRequest;
module.exports.processUpdate = processUpdate;
module.exports.combinePath = combinePath;
