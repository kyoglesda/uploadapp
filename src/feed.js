/**
 * @fileoverview Feed component
 * @module feed
 */
const {writeFile} = require('./services/fileService');
const {Episode} = require('./episode');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const pretty = require("pretty");

/**
 * Represents a feed of episodes.
 */
class Feed {
    /**
     * Loads a new feed.
     * @param {string} path - The path to the file containing the XML RSS feed.
     */
    constructor(path) {
        this.path = path;
    }

    static fromFile(path) {
        return new Feed(path);
    }

    /**
     * Adds a episode to the feed.
     * @param {Episode} episode - The episode to add.
     * @returns {Promise<void>}
     */
    async addEpisode(episode) {
        try {
            const feed = await JSDOM.fromFile(this.path);
            episode.appendToDom(feed);
            await writeFile(this.path, pretty(feed.serialize()));
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = {Feed};