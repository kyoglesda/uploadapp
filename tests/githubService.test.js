jest.mock('simple-git');
const simpleGit = require('simple-git');

describe('githubService.fetchLatestChanges', () => {
    let mockGit;

    beforeEach(() => {
        mockGit = {
            checkout: jest.fn().mockResolvedValue(),
            reset: jest.fn().mockResolvedValue(),
            pull: jest.fn().mockResolvedValue({ summary: { changes: 0 } }),
        };
        simpleGit.mockReturnValue(mockGit);
    });

    afterEach(() => jest.clearAllMocks());

    test('checks out master, resets hard, and pulls', async () => {
        const { fetchLatestChanges } = require('../src/services/githubService');
        const result = await fetchLatestChanges('/repo');

        expect(simpleGit).toHaveBeenCalledWith('/repo');
        expect(mockGit.checkout).toHaveBeenCalledWith('master');
        expect(mockGit.reset).toHaveBeenCalledWith('hard');
        expect(mockGit.pull).toHaveBeenCalled();
        expect(result).toEqual({ summary: { changes: 0 } });
    });

    test('throws with "Error fetching changes" on git error', async () => {
        mockGit.pull.mockRejectedValue(new Error('Network unreachable'));
        const { fetchLatestChanges } = require('../src/services/githubService');
        await expect(fetchLatestChanges('/repo')).rejects.toThrow('Error fetching changes: Network unreachable');
    });
});

describe('githubService.commitChanges', () => {
    let mockGit;

    beforeEach(() => {
        mockGit = {
            add: jest.fn().mockResolvedValue(),
            commit: jest.fn().mockResolvedValue({ commit: 'abc123' }),
        };
        simpleGit.mockReturnValue(mockGit);
    });

    afterEach(() => jest.clearAllMocks());

    test('stages all files and commits with the given message', async () => {
        const { commitChanges } = require('../src/services/githubService');
        const result = await commitChanges('/repo', 'Add sermon');

        expect(mockGit.add).toHaveBeenCalledWith('.');
        expect(mockGit.commit).toHaveBeenCalledWith('Add sermon');
        expect(result).toEqual({ commit: 'abc123' });
    });

    test('throws with "Error committing changes" on git error', async () => {
        mockGit.commit.mockRejectedValue(new Error('Nothing to commit'));
        const { commitChanges } = require('../src/services/githubService');
        await expect(commitChanges('/repo', 'msg')).rejects.toThrow('Error committing changes: Nothing to commit');
    });
});

describe('githubService.pushChanges', () => {
    let mockGit;

    beforeEach(() => {
        mockGit = {
            push: jest.fn().mockResolvedValue({ pushed: [] }),
        };
        simpleGit.mockReturnValue(mockGit);
    });

    afterEach(() => jest.clearAllMocks());

    test('calls git.push and returns result', async () => {
        const { pushChanges } = require('../src/services/githubService');
        const result = await pushChanges('/repo');

        expect(simpleGit).toHaveBeenCalledWith('/repo');
        expect(mockGit.push).toHaveBeenCalled();
        expect(result).toEqual({ pushed: [] });
    });

    test('throws with "Error pushing changes" on git error', async () => {
        mockGit.push.mockRejectedValue(new Error('Authentication failed'));
        const { pushChanges } = require('../src/services/githubService');
        await expect(pushChanges('/repo')).rejects.toThrow('Error pushing changes: Authentication failed');
    });
});
