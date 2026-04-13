jest.mock('fs');
const fs = require('fs');

describe('fileService.readFile', () => {
    afterEach(() => jest.clearAllMocks());

    test('resolves with file contents on success', async () => {
        fs.readFile.mockImplementation((path, encoding, callback) => {
            callback(null, 'file content');
        });

        const { readFile } = require('../src/services/fileService');
        const result = await readFile('/some/path.txt');
        expect(result).toBe('file content');
    });

    test('rejects with error message on read error', async () => {
        fs.readFile.mockImplementation((path, encoding, callback) => {
            callback(new Error('ENOENT: no such file'), null);
        });

        const { readFile } = require('../src/services/fileService');
        await expect(readFile('/missing.txt')).rejects.toMatch('Error reading file: ENOENT: no such file');
    });
});

describe('fileService.writeFile', () => {
    afterEach(() => jest.clearAllMocks());

    test('resolves on successful write', async () => {
        fs.writeFile.mockImplementation((path, data, encoding, callback) => {
            callback(null);
        });

        const { writeFile } = require('../src/services/fileService');
        await expect(writeFile('/some/path.txt', 'data')).resolves.toBeUndefined();
    });

    test('rejects with error message on write error', async () => {
        fs.writeFile.mockImplementation((path, data, encoding, callback) => {
            callback(new Error('EACCES: permission denied'));
        });

        const { writeFile } = require('../src/services/fileService');
        await expect(writeFile('/readonly.txt', 'data')).rejects.toMatch('Error writing file: EACCES: permission denied');
    });
});
