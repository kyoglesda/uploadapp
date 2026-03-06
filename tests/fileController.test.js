// Tests for pure functions and mocked endpoint logic in fileController

jest.mock('../src/services/googleDriveService');
jest.mock('../src/services/githubService');
jest.mock('get-audio-duration');
jest.mock('../src/feed');

const googleDriveService = require('../src/services/googleDriveService');
const githubService = require('../src/services/githubService');
const { getAudioDurationInSeconds } = require('get-audio-duration');
const { Feed } = require('../src/feed');

const { combinePath } = require('../src/controllers/fileController');

describe('combinePath', () => {
    test('joins two path segments', () => {
        expect(combinePath('/a/b', 'c.xml')).toBe('/a/b/c.xml');
    });

    test('removes trailing slash from first path', () => {
        expect(combinePath('/a/b/', 'c.xml')).toBe('/a/b/c.xml');
    });

    test('removes leading slash from second path', () => {
        expect(combinePath('/a/b', '/c.xml')).toBe('/a/b/c.xml');
    });

    test('handles both slashes present', () => {
        expect(combinePath('/repo/', '/feed.xml')).toBe('/repo/feed.xml');
    });

    test('handles no slashes between segments', () => {
        expect(combinePath('C:\\repo', 'rss_feed.xml')).toBe('C:\\repo/rss_feed.xml');
    });
});

describe('processRequest (via uploadAudio integration)', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        googleDriveService.authenticate.mockResolvedValue({});
        googleDriveService.uploadFile.mockResolvedValue('audio-file-id');
        googleDriveService.shareFile.mockResolvedValue('https://drive.google.com/uc?id=audio-file-id');
        googleDriveService.uploadPdf.mockResolvedValue('pdf-file-id');
        googleDriveService.sharePdf.mockResolvedValue({
            viewerLink: 'https://drive.google.com/file/d/pdf-file-id/view?usp=sharing',
            directLink: 'https://drive.google.com/uc?id=pdf-file-id',
        });

        githubService.fetchLatestChanges.mockResolvedValue();
        githubService.commitChanges.mockResolvedValue();
        githubService.pushChanges.mockResolvedValue();

        getAudioDurationInSeconds.mockResolvedValue(3600);

        const mockFeedInstance = {
            addEpisode: jest.fn().mockResolvedValue(),
        };
        Feed.fromFile.mockReturnValue(mockFeedInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns 400 when speaker is missing', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 1000, filepath: '/tmp/audio.mp3' };
        await processRequest(mockRes, audioFile, '', 'Title', 'Desc');
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when title is missing', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 1000, filepath: '/tmp/audio.mp3' };
        await processRequest(mockRes, audioFile, 'Speaker', '', 'Desc');
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('returns 400 when audio file is missing', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        await processRequest(mockRes, null, 'Speaker', 'Title', 'Desc');
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('uploads audio and returns 200 on success', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 5000000, filepath: '/tmp/audio.mp3' };
        await processRequest(mockRes, audioFile, 'John', 'Sermon', 'Description');

        expect(googleDriveService.uploadFile).toHaveBeenCalled();
        expect(googleDriveService.shareFile).toHaveBeenCalledWith({}, 'audio-file-id');
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('uploads PDF when provided and appends links to description', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 5000000, filepath: '/tmp/audio.mp3' };
        const pdfFile = { filepath: '/tmp/slides.pdf' };
        await processRequest(mockRes, audioFile, 'John', 'Sermon', 'Base description.', pdfFile);

        expect(googleDriveService.uploadPdf).toHaveBeenCalled();
        expect(googleDriveService.sharePdf).toHaveBeenCalledWith({}, 'pdf-file-id');

        // Verify the episode was created with HTML description containing PDF links
        const feedInstance = Feed.fromFile.mock.results[0].value;
        const addedEpisode = feedInstance.addEpisode.mock.calls[0][0];
        expect(addedEpisode.description).toContain('presentation slides on Google Drive');
        expect(addedEpisode.description).toContain('pdf-file-id');
    });

    test('does not upload PDF when not provided', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 5000000, filepath: '/tmp/audio.mp3' };
        await processRequest(mockRes, audioFile, 'John', 'Sermon', 'No PDF.');

        expect(googleDriveService.uploadPdf).not.toHaveBeenCalled();
    });

    test('description is plain text when no PDF provided', async () => {
        const { processRequest } = require('../src/controllers/fileController');
        const audioFile = { size: 5000000, filepath: '/tmp/audio.mp3' };
        await processRequest(mockRes, audioFile, 'John', 'Sermon', 'Plain desc.');

        const feedInstance = Feed.fromFile.mock.results[0].value;
        const addedEpisode = feedInstance.addEpisode.mock.calls[0][0];
        expect(addedEpisode.description).toBe('Plain desc.');
    });
});

describe('listEntries', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns JSON list of episodes', async () => {
        const mockEpisodes = [
            { guid: 'g1', title: 'T1', description: 'D1', pubDate: 'P1', enclosureUrl: 'U1', duration: '60' }
        ];
        const mockFeedInstance = { getEpisodes: jest.fn().mockResolvedValue(mockEpisodes) };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { listEntries } = require('../src/controllers/fileController');
        await listEntries(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(mockEpisodes);
    });

    test('returns 500 on error', async () => {
        Feed.fromFile.mockImplementation(() => {
            throw new Error('File not found');
        });

        const { listEntries } = require('../src/controllers/fileController');
        await listEntries(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
    });
});

describe('processUpdate', () => {
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        googleDriveService.authenticate.mockResolvedValue({});
        googleDriveService.uploadPdf.mockResolvedValue('edit-pdf-id');
        googleDriveService.sharePdf.mockResolvedValue({
            viewerLink: 'https://drive.google.com/file/d/edit-pdf-id/view?usp=sharing',
            directLink: 'https://drive.google.com/uc?id=edit-pdf-id',
        });

        githubService.fetchLatestChanges.mockResolvedValue();
        githubService.commitChanges.mockResolvedValue();
        githubService.pushChanges.mockResolvedValue();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns 400 when no fields provided', async () => {
        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'some-guid', undefined, undefined, null);
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('updates entry and returns 200 on success', async () => {
        const mockFeedInstance = { updateEpisode: jest.fn().mockResolvedValue() };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'abc-123', 'New Title', 'New Desc', null);

        expect(mockFeedInstance.updateEpisode).toHaveBeenCalledWith('abc-123', {
            title: 'New Title',
            description: 'New Desc',
            pubDate: undefined,
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('returns 404 when episode not found', async () => {
        const mockFeedInstance = {
            updateEpisode: jest.fn().mockRejectedValue(new Error('Episode with GUID abc not found.')),
        };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'abc', 'X', 'Y', null);

        expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    test('uploads PDF when provided and appends links to description', async () => {
        const mockFeedInstance = { updateEpisode: jest.fn().mockResolvedValue() };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        const pdfFile = { filepath: '/tmp/slides.pdf' };
        await processUpdate(mockRes, 'abc-123', 'My Title', 'Existing description.', pdfFile);

        expect(googleDriveService.uploadPdf).toHaveBeenCalled();
        expect(googleDriveService.sharePdf).toHaveBeenCalledWith({}, 'edit-pdf-id');

        const updateCall = mockFeedInstance.updateEpisode.mock.calls[0];
        const updatedDescription = updateCall[1].description;
        expect(updatedDescription).toContain('Existing description.');
        expect(updatedDescription).toContain('presentation slides on Google Drive');
        expect(updatedDescription).toContain('edit-pdf-id');
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('builds description from PDF links alone when description is empty', async () => {
        const mockFeedInstance = { updateEpisode: jest.fn().mockResolvedValue() };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        const pdfFile = { filepath: '/tmp/slides.pdf' };
        await processUpdate(mockRes, 'abc-123', 'My Title', '', pdfFile);

        const updateCall = mockFeedInstance.updateEpisode.mock.calls[0];
        const updatedDescription = updateCall[1].description;
        expect(updatedDescription).not.toMatch(/^\s/);
        expect(updatedDescription).toContain('presentation slides on Google Drive');
    });

    test('does not upload PDF when not provided', async () => {
        const mockFeedInstance = { updateEpisode: jest.fn().mockResolvedValue() };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'abc-123', 'Title', 'Desc', null);

        expect(googleDriveService.uploadPdf).not.toHaveBeenCalled();
    });

    test('updates pubDate when provided', async () => {
        const mockFeedInstance = { updateEpisode: jest.fn().mockResolvedValue() };
        Feed.fromFile.mockReturnValue(mockFeedInstance);

        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'abc-123', 'Title', 'Desc', null, 'Mon, 6 Jan 2025 10:00:00 +1100');

        expect(mockFeedInstance.updateEpisode).toHaveBeenCalledWith('abc-123', {
            title: 'Title',
            description: 'Desc',
            pubDate: 'Mon, 6 Jan 2025 10:00:00 +1100',
        });
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('returns 400 when no fields provided (including no pubDate)', async () => {
        const { processUpdate } = require('../src/controllers/fileController');
        await processUpdate(mockRes, 'some-guid', undefined, undefined, null, undefined);
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });
});
