const fs = require('fs');
const path = require('path');
const os = require('os');
const { Feed } = require('../src/feed');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'feed.xml');

function makeTempFeed() {
    const tmpPath = path.join(os.tmpdir(), `test-feed-${Date.now()}.xml`);
    fs.copyFileSync(FIXTURE_PATH, tmpPath);
    return tmpPath;
}

afterEach(() => {
    // Temp files are cleaned up by OS eventually; no explicit cleanup needed.
});

describe('Feed.fromFile', () => {
    test('creates a Feed instance with the given path', () => {
        const feed = Feed.fromFile('/some/path.xml');
        expect(feed).toBeInstanceOf(Feed);
        expect(feed.path).toBe('/some/path.xml');
    });
});

describe('Feed.getEpisodes', () => {
    test('returns all episodes from the feed', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);
        const episodes = await feed.getEpisodes();

        expect(episodes).toHaveLength(2);
        expect(episodes[0].guid).toBe('abc123-guid-1');
        expect(episodes[0].title).toBe('John Smith - The First Sermon');
        expect(episodes[0].description).toBe('First sermon description');
        expect(episodes[0].enclosureUrl).toBe('https://drive.google.com/uc?id=file1');
        expect(episodes[0].duration).toBe('3600');
    });

    test('includes CDATA description as text', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);
        const episodes = await feed.getEpisodes();

        expect(episodes[1].guid).toBe('def456-guid-2');
        expect(episodes[1].description).toContain('Second sermon');
    });

    test('returns empty array for feed with no items', async () => {
        const tmpPath = path.join(os.tmpdir(), `empty-feed-${Date.now()}.xml`);
        fs.writeFileSync(tmpPath, '<rss><channel><title>Empty</title></channel></rss>');
        const feed = Feed.fromFile(tmpPath);
        const episodes = await feed.getEpisodes();
        expect(episodes).toHaveLength(0);
    });
});

describe('Feed.updateEpisode', () => {
    test('updates title of an existing episode', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);

        await feed.updateEpisode('abc123-guid-1', { title: 'Updated Title' });

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        const ep = episodes.find(e => e.guid === 'abc123-guid-1');
        expect(ep.title).toBe('Updated Title');
    });

    test('updates description of an existing episode', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);

        await feed.updateEpisode('abc123-guid-1', { description: 'New description text' });

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        const ep = episodes.find(e => e.guid === 'abc123-guid-1');
        expect(ep.description).toBe('New description text');
    });

    test('updates both title and description', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);

        await feed.updateEpisode('def456-guid-2', { title: 'New Title', description: 'New Desc' });

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        const ep = episodes.find(e => e.guid === 'def456-guid-2');
        expect(ep.title).toBe('New Title');
        expect(ep.description).toBe('New Desc');
    });

    test('throws error for unknown GUID', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);
        await expect(feed.updateEpisode('nonexistent-guid', { title: 'X' }))
            .rejects.toThrow('not found');
    });

    test('updates pubDate of an existing episode', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);

        await feed.updateEpisode('abc123-guid-1', { pubDate: 'Mon, 6 Jan 2025 10:00:00 +1100' });

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        const ep = episodes.find(e => e.guid === 'abc123-guid-1');
        expect(ep.pubDate).toBe('Mon, 6 Jan 2025 10:00:00 +1100');
    });

    test('does not modify other episodes when updating one', async () => {
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);

        await feed.updateEpisode('abc123-guid-1', { title: 'Changed' });

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        const untouched = episodes.find(e => e.guid === 'def456-guid-2');
        expect(untouched.title).toBe('Jane Doe - The Second Sermon');
    });
});

describe('Feed.addEpisode', () => {
    test('prepends new episode to the feed', async () => {
        const { Episode } = require('../src/episode');
        const tmpPath = makeTempFeed();
        const feed = Feed.fromFile(tmpPath);
        const ep = new Episode('New Speaker - New Sermon', 'New desc', 'https://drive.google.com/uc?id=new', 500, 1000);

        await feed.addEpisode(ep);

        const updated = Feed.fromFile(tmpPath);
        const episodes = await updated.getEpisodes();
        expect(episodes.length).toBe(3);
        expect(episodes[0].title).toBe('New Speaker - New Sermon');
    });
});
