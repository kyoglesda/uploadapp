const { JSDOM } = require('jsdom');
const { Episode } = require('../src/episode');

const makeMinimalFeedDom = () => {
    return new JSDOM(
        '<rss><channel><item><guid>existing</guid></item></channel></rss>',
        { contentType: 'text/xml' }
    );
};

describe('Episode constructor', () => {
    test('sets all properties', () => {
        const ep = new Episode('Speaker - Title', 'A description', 'https://example.com/audio.mp3', 5000000, 3600);
        expect(ep.title).toBe('Speaker - Title');
        expect(ep.itunes_title).toBe('Speaker - Title');
        expect(ep.description).toBe('A description');
        expect(ep.enclosure.url).toBe('https://example.com/audio.mp3');
        expect(ep.enclosure.type).toBe('audio/mpeg');
        expect(ep.enclosure.length).toBe(5000000);
        expect(ep.itunes_duration).toBe(3600);
        expect(ep.itunes_explicit).toBe(false);
        expect(ep.guid).toBeTruthy();
        expect(ep.pubDate).toBeInstanceOf(Date);
    });

    test('parses duration as integer', () => {
        const ep = new Episode('T', 'D', 'u', 0, 3600.9);
        expect(ep.itunes_duration).toBe(3600);
    });

    test('generates unique GUIDs', () => {
        const ep1 = new Episode('T', 'D', 'u', 0, 0);
        const ep2 = new Episode('T', 'D', 'u', 0, 0);
        expect(ep1.guid).not.toBe(ep2.guid);
    });
});

describe('Episode.convertPubDateToString', () => {
    test('returns date string with 11:00:00 time', () => {
        const ep = new Episode('T', 'D', 'u', 0, 0);
        const str = ep.convertPubDateToString();
        expect(str).toContain('11:00:00');
    });

    test('includes year from pubDate', () => {
        const ep = new Episode('T', 'D', 'u', 0, 0);
        ep.pubDate = new Date('2025-06-15T00:00:00Z');
        const str = ep.convertPubDateToString();
        expect(str).toContain('2025');
        expect(str).toMatch(/Jun/);
    });

    test('contains day of week abbreviation', () => {
        const ep = new Episode('T', 'D', 'u', 0, 0);
        ep.pubDate = new Date('2025-01-05T00:00:00Z'); // Sunday
        const str = ep.convertPubDateToString();
        expect(str).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/);
    });
});

describe('Episode.toDom', () => {
    test('creates item element with required children', () => {
        const dom = makeMinimalFeedDom();
        const ep = new Episode('My Title', 'Plain text', 'https://url.com', 1000, 60);
        ep.pubDate = new Date('2025-03-01');
        const item = ep.toDom(dom);

        expect(item.tagName.toLowerCase()).toBe('item');
        expect(item.querySelector('guid').textContent).toBe(ep.guid);
        expect(item.querySelector('title').textContent).toBe('My Title');

        const enclosure = item.querySelector('enclosure');
        expect(enclosure.getAttribute('url')).toBe('https://url.com');
        expect(enclosure.getAttribute('type')).toBe('audio/mpeg');
        expect(enclosure.getAttribute('length')).toBe('1000');

        const durationEls = item.getElementsByTagName('itunes:duration');
        expect(durationEls[0].textContent).toBe('60');

        const explicitEls = item.getElementsByTagName('itunes:explicit');
        expect(explicitEls[0].textContent).toBe('false');
    });

    test('uses textContent for plain-text description', () => {
        const dom = makeMinimalFeedDom();
        const ep = new Episode('T', 'Plain description', 'u', 0, 0);
        const item = ep.toDom(dom);
        const desc = item.querySelector('description');
        expect(desc.textContent).toBe('Plain description');
        const hasCdata = Array.from(desc.childNodes).some(n => n.nodeType === 4);
        expect(hasCdata).toBe(false);
    });

    test('uses CDATA section for HTML description', () => {
        const dom = makeMinimalFeedDom();
        const ep = new Episode('T', 'Click <a href="http://x.com">here</a>', 'u', 0, 0);
        const item = ep.toDom(dom);
        const desc = item.querySelector('description');
        const cdataNode = Array.from(desc.childNodes).find(n => n.nodeType === 4);
        expect(cdataNode).toBeTruthy();
        expect(cdataNode.data).toContain('<a href=');
    });

    test('empty description renders without error', () => {
        const dom = makeMinimalFeedDom();
        const ep = new Episode('T', undefined, 'u', 0, 0);
        const item = ep.toDom(dom);
        const desc = item.querySelector('description');
        expect(desc.textContent).toBe('');
    });
});

describe('Episode.appendToDom', () => {
    test('inserts new item before existing items', () => {
        const dom = makeMinimalFeedDom();
        const ep = new Episode('New Episode', 'Desc', 'http://url', 0, 0);
        ep.appendToDom(dom);

        const items = dom.window.document.querySelectorAll('item');
        expect(items.length).toBe(2);
        expect(items[0].querySelector('title').textContent).toBe('New Episode');
        expect(items[1].querySelector('guid').textContent).toBe('existing');
    });

    test('adds item to empty channel', () => {
        const dom = new JSDOM('<rss><channel></channel></rss>', { contentType: 'text/xml' });
        const ep = new Episode('Only Episode', 'Desc', 'http://url', 0, 0);
        ep.appendToDom(dom);

        const items = dom.window.document.querySelectorAll('item');
        expect(items.length).toBe(1);
        expect(items[0].querySelector('title').textContent).toBe('Only Episode');
    });
});
