// This file contains functions for interacting with the local Git repository.
// It includes methods for fetching the latest changes, committing updates, and pushing to GitHub.

const simpleGit = require('simple-git');

const githubService = {
    fetchLatestChanges: async cwd => {
        const git = simpleGit(cwd);
        try {
            await git.checkout('master');
            await git.reset('hard');
            const result = await git.pull();
            return result;
        } catch (error) {
            throw new Error(`Error fetching changes: ${error.message}`);
        }
    },

    commitChanges: async (cwd, message) => {
        const git = simpleGit(cwd);
        try {
            await git.add('.');
            const result = await git.commit(message);
            return result;
        } catch (error) {
            throw new Error(`Error committing changes: ${error.message}`);
        }
    },

    pushChanges: async cwd => {
        const git = simpleGit(cwd);
        try {
            const result = await git.push();
            return result;
        } catch (error) {
            throw new Error(`Error pushing changes: ${error.message}`);
        }
    }
};

module.exports = githubService;