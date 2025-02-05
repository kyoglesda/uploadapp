/**
 * This module contains functions for interacting with the local file system.
 */

const fs = require('fs');

const fileService = {

    /**
     * Reads the contents of a file.
     * @param {string} path - The path to the file.
     * @returns {Promise<string>} The contents of the file.
     */
    readFile: (path) => {
        return new Promise((resolve, reject) => {
            fs.readFile(path, 'utf8', (error, data) => {
                if (error) {
                    return reject(`Error reading file: ${error.message}`);
                }
                resolve(data);
            });
        });
    },

    /**
     * Writes data to a file.
     */

    writeFile: (path, data) => {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, data, 'utf8', (error) => {
                if (error) {
                    return reject(`Error writing file: ${error.message}`);
                }
                resolve();
            });
        });
    }
};

module.exports = fileService;