const {v4: uuid} = require('uuid');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYSOFWEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
class Episode {
    /**
     * Creates a new episode.
     * @param {string} title - The title of the episode.
     * @param {string} description - The description of the episode.
     * @param {string} audioUrl - The URL of the audio file.
     * @param {number} size - The size of the audio file in bytes.
     * @param {number} duration - The length of the audio file in seconds.
     */
    constructor(title, description, audioUrl, size, duration) {
        this.title = title;
        this.itunes_title = title;
        this.description = description;
        this.enclosure = {url: audioUrl, type: 'audio/mpeg', length: size};
        this.guid = uuid();
        this.pubDate = this.createPubDate();
        this.itunes_duration = Number.parseInt(duration, 10);
    }

    /** Properties */
    title;
    description;
    guid;
    itunes_title;
    itunes_duration;
    itunes_explicit = false;
    enclosure;
    pubDate;
    a10_updated = new Date().toISOString();

    createPubDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const timezone = now.getTimezoneOffset();
        const dayOfWeek = DAYSOFWEEK[now.getDay()];
        return `${dayOfWeek}, ${day} ${MONTHS[month]} ${year} 11:00:00 ${timezone}`;
    }

    /**
     * Converts the episode to an XML string.
     * @returns {string} The episode as an XML string.
     */

    appendToDom(dom) {
        dom.window.document.querySelector('channel').appendChild(this.toDom(dom));
    }

    toDom(dom) {
        const item = dom.window.document.createElement('item');
        const guid = dom.window.document.createElement('guid');
        guid.setAttribute('isPermaLink', 'false');
        guid.textContent = this.guid;
        item.appendChild(guid);
        const title = dom.window.document.createElement('title');
        title.textContent = this.title;
        item.appendChild(title);
        const itunes_title = dom.window.document.createElement('itunes:title');
        itunes_title.textContent = this.itunes_title;
        item.appendChild(itunes_title);
        const description = dom.window.document.createElement('description');
        description.textContent = this.description;
        item.appendChild(description);
        const pubDate = dom.window.document.createElement('pubDate');
        pubDate.textContent = this.pubDate;
        item.appendChild(pubDate);
        const a10_updated = dom.window.document.createElement('a10:updated');
        a10_updated.textContent = this.a10_updated;
        item.appendChild(a10_updated);
        const enclosure = dom.window.document.createElement('enclosure');
        enclosure.setAttribute('url', this.enclosure.url);
        enclosure.setAttribute('type', this.enclosure.type);
        enclosure.setAttribute('length', this.enclosure.length);
        item.appendChild(enclosure);
        const itunes_duration = dom.window.document.createElement('itunes:duration');
        itunes_duration.textContent = this.itunes_duration;
        item.appendChild(itunes_duration);
        const itunes_explicit = dom.window.document.createElement('itunes:explicit');
        itunes_explicit.textContent = this.itunes_explicit;
        item.appendChild(itunes_explicit);
        return item;
    }
}

module.exports = {Episode};
