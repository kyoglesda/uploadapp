// Tests for googleDriveService functions

jest.mock('googleapis');
jest.mock('google-auth-library');
jest.mock('fs');

const { google } = require('googleapis');
const fs = require('fs');

const MOCK_CREDENTIALS = JSON.stringify({
    installed: { client_id: 'id', client_secret: 'secret', redirect_uris: ['http://localhost'] },
});
const MOCK_TOKEN = JSON.stringify({ access_token: 'tok' });

function setupOAuth2Mock(overrides = {}) {
    const defaults = { setCredentials: jest.fn(), generateAuthUrl: jest.fn(), getToken: jest.fn() };
    const impl = { ...defaults, ...overrides };
    google.auth = { OAuth2: jest.fn().mockImplementation(() => impl) };
    return impl;
}

describe('authenticate', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns OAuth2 client with credentials when token exists', async () => {
        const { setCredentials } = setupOAuth2Mock();
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation(p =>
            p.includes('token.json') ? MOCK_TOKEN : MOCK_CREDENTIALS
        );

        const { authenticate } = require('../src/services/googleDriveService');
        const client = await authenticate();

        expect(setCredentials).toHaveBeenCalledWith({ access_token: 'tok' });
        expect(client).toBeDefined();
    });

    test('throws when no token file exists', async () => {
        setupOAuth2Mock();
        fs.existsSync.mockReturnValue(false);
        fs.readFileSync.mockReturnValue(MOCK_CREDENTIALS);

        const { authenticate } = require('../src/services/googleDriveService');
        await expect(authenticate()).rejects.toThrow('No token found');
    });
});

describe('generateAuthUrl', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns the URL from oAuth2Client.generateAuthUrl', async () => {
        const mockUrl = 'https://accounts.google.com/o/oauth2/auth?foo=bar';
        const { generateAuthUrl: mockGenerate } = setupOAuth2Mock({
            generateAuthUrl: jest.fn().mockReturnValue(mockUrl),
        });
        fs.readFileSync.mockReturnValue(MOCK_CREDENTIALS);

        const { generateAuthUrl } = require('../src/services/googleDriveService');
        const url = await generateAuthUrl();

        expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ access_type: 'offline' }));
        expect(url).toBe(mockUrl);
    });
});

describe('authenticateCallback', () => {
    afterEach(() => jest.clearAllMocks());

    test('exchanges code for token, sets credentials, and writes token to disk', async () => {
        const { setCredentials, getToken } = setupOAuth2Mock({
            getToken: jest.fn().mockResolvedValue({ tokens: { access_token: 'new-tok' } }),
        });
        fs.readFileSync.mockReturnValue(MOCK_CREDENTIALS);
        fs.writeFileSync = jest.fn();

        const { authenticateCallback } = require('../src/services/googleDriveService');
        await authenticateCallback('auth-code');

        expect(getToken).toHaveBeenCalledWith('auth-code');
        expect(setCredentials).toHaveBeenCalledWith({ access_token: 'new-tok' });
        expect(fs.writeFileSync).toHaveBeenCalled();
    });
});

describe('uploadFile', () => {
    afterEach(() => jest.clearAllMocks());

    test('calls drive.files.create with audio/mpeg mime type and returns file ID', async () => {
        fs.createReadStream = jest.fn().mockReturnValue('stream');
        const mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'audio-id' } });
        google.drive.mockReturnValue({ files: { create: mockFilesCreate } });

        const { uploadFile } = require('../src/services/googleDriveService');
        const id = await uploadFile({}, '/tmp/audio.mp3', 'Sermon.mp3');

        expect(id).toBe('audio-id');
        expect(mockFilesCreate).toHaveBeenCalledWith(expect.objectContaining({
            requestBody: expect.objectContaining({ mimeType: 'audio/mpeg' }),
            media: expect.objectContaining({ mimeType: 'audio/mpeg' }),
        }));
    });

    test('throws with "Error uploading file" on API error', async () => {
        fs.createReadStream = jest.fn().mockReturnValue('stream');
        google.drive.mockReturnValue({
            files: { create: jest.fn().mockRejectedValue(new Error('Network error')) },
        });

        const { uploadFile } = require('../src/services/googleDriveService');
        await expect(uploadFile({}, '/tmp/audio.mp3', 'file.mp3')).rejects.toThrow('Error uploading file');
    });
});

describe('shareFile', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns a direct Google Drive download URL', async () => {
        const mockPermissionsCreate = jest.fn().mockResolvedValue({});
        google.drive.mockReturnValue({
            permissions: { create: mockPermissionsCreate },
        });

        // Patch token and credentials reads
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.includes('token.json')) {
                return JSON.stringify({ access_token: 'tok' });
            }
            return JSON.stringify({
                installed: {
                    client_id: 'id',
                    client_secret: 'secret',
                    redirect_uris: ['http://localhost:3000/callback'],
                },
            });
        });

        // mock OAuth2 client
        const mockSetCredentials = jest.fn();
        google.auth = {
            OAuth2: jest.fn().mockImplementation(() => ({
                setCredentials: mockSetCredentials,
                generateAuthUrl: jest.fn(),
            })),
        };

        const { shareFile } = require('../src/services/googleDriveService');
        const auth = {};
        const link = await shareFile(auth, 'some-file-id');

        expect(link).toBe('https://drive.google.com/uc?id=some-file-id');
        expect(mockPermissionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({ fileId: 'some-file-id' })
        );
    });

    test('throws on API error', async () => {
        const mockPermissionsCreate = jest.fn().mockRejectedValue(new Error('API error'));
        google.drive.mockReturnValue({
            permissions: { create: mockPermissionsCreate },
        });

        const { shareFile } = require('../src/services/googleDriveService');
        await expect(shareFile({}, 'bad-id')).rejects.toThrow('Error sharing file');
    });
});

describe('sharePdf', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns viewerLink and directLink for a PDF', async () => {
        const mockPermissionsCreate = jest.fn().mockResolvedValue({});
        google.drive.mockReturnValue({
            permissions: { create: mockPermissionsCreate },
        });

        const { sharePdf } = require('../src/services/googleDriveService');
        const result = await sharePdf({}, 'pdf-file-id');

        expect(result.viewerLink).toBe('https://drive.google.com/file/d/pdf-file-id/view?usp=sharing');
        expect(result.directLink).toBe('https://drive.google.com/uc?id=pdf-file-id');
    });

    test('sets permission type=anyone role=reader', async () => {
        const mockPermissionsCreate = jest.fn().mockResolvedValue({});
        google.drive.mockReturnValue({
            permissions: { create: mockPermissionsCreate },
        });

        const { sharePdf } = require('../src/services/googleDriveService');
        await sharePdf({}, 'any-id');

        expect(mockPermissionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: { type: 'anyone', role: 'reader' },
                fileId: 'any-id',
            })
        );
    });

    test('throws on API error', async () => {
        const mockPermissionsCreate = jest.fn().mockRejectedValue(new Error('Drive error'));
        google.drive.mockReturnValue({
            permissions: { create: mockPermissionsCreate },
        });

        const { sharePdf } = require('../src/services/googleDriveService');
        await expect(sharePdf({}, 'id')).rejects.toThrow('Error sharing PDF');
    });
});

describe('uploadPdf', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('calls drive.files.create with PDF mime type and returns file ID', async () => {
        fs.createReadStream = jest.fn().mockReturnValue('stream');
        const mockFilesCreate = jest.fn().mockResolvedValue({ data: { id: 'new-pdf-id' } });
        google.drive.mockReturnValue({
            files: { create: mockFilesCreate },
        });

        const { uploadPdf } = require('../src/services/googleDriveService');
        const id = await uploadPdf({}, '/tmp/file.pdf', 'My Slides.pdf');

        expect(id).toBe('new-pdf-id');
        expect(mockFilesCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                requestBody: expect.objectContaining({ mimeType: 'application/pdf' }),
                media: expect.objectContaining({ mimeType: 'application/pdf' }),
            })
        );
    });

    test('throws on upload error', async () => {
        fs.createReadStream = jest.fn().mockReturnValue('stream');
        const mockFilesCreate = jest.fn().mockRejectedValue(new Error('Upload failed'));
        google.drive.mockReturnValue({
            files: { create: mockFilesCreate },
        });

        const { uploadPdf } = require('../src/services/googleDriveService');
        await expect(uploadPdf({}, '/tmp/file.pdf', 'file.pdf')).rejects.toThrow('Error uploading PDF');
    });
});
