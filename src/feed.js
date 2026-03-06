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

    /**
     * Returns all episodes in the feed as plain objects.
     * @returns {Promise<Array<{guid, title, description, pubDate, enclosureUrl, duration}>>}
     */
    async getEpisodes() {
        const feed = await JSDOM.fromFile(this.path);
        const items = feed.window.document.querySelectorAll('item');
        const episodes = [];
        items.forEach(item => {
            const guid = item.querySelector('guid')?.textContent?.trim() || '';
            const title = item.querySelector('title')?.textContent?.trim() || '';
            const descEl = item.querySelector('description');
            const description = descEl?.textContent?.trim() || '';
            const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
            const enclosure = item.querySelector('enclosure');
            const enclosureUrl = enclosure?.getAttribute('url') || '';
            const durationEls = item.getElementsByTagName('itunes:duration');
            const duration = durationEls.length > 0 ? durationEls[0].textContent.trim() : '';
            episodes.push({ guid, title, description, pubDate, enclosureUrl, duration });
        });
        return episodes;
    }

    /**
     * Updates an existing episode's title, description, and/or pubDate by GUID.
     * @param {string} guid - The GUID of the episode to update.
     * @param {{ title?: string, description?: string, pubDate?: string }} fields - Fields to update.
     * @returns {Promise<void>}
     */
    async updateEpisode(guid, { title, description, pubDate } = {}) {
        const feed = await JSDOM.fromFile(this.path);
        const items = feed.window.document.querySelectorAll('item');
        let found = false;
        items.forEach(item => {
            const itemGuid = item.querySelector('guid')?.textContent?.trim() || '';
            if (itemGuid !== guid) return;
            found = true;
            if (title !== undefined) {
                const titleEl = item.querySelector('title');
                if (titleEl) titleEl.textContent = title;
                const itunesTitleEls = item.getElementsByTagName('itunes:title');
                if (itunesTitleEls.length > 0) itunesTitleEls[0].textContent = title;
            }
            if (description !== undefined) {
                const descEl = item.querySelector('description');
                if (descEl) {
                    while (descEl.firstChild) descEl.removeChild(descEl.firstChild);
                    if (description.includes('<')) {
                        descEl.appendChild(feed.window.document.createCDATASection(description));
                    } else {
                        descEl.textContent = description;
                    }
                }
            }
            if (pubDate !== undefined) {
                const pubDateEl = item.querySelector('pubDate');
                if (pubDateEl) pubDateEl.textContent = pubDate;
            }
        });
        if (!found) {
            throw new Error(`Episode with GUID ${guid} not found.`);
        }
        await writeFile(this.path, pretty(feed.serialize()));
    }
}

module.exports = {Feed};