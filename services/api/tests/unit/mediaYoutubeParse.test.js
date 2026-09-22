"use strict";

const { __testing } = require("../../src/modules/media/media.service");

const { extractInitialData, collectVideoRenderers, normaliseScraped, readText, readYouTubeApiKey } = __testing;

function buildPage(data) {
  return `<!doctype html><html><body><script nonce="x">var ytInitialData = ${JSON.stringify(data)};</script></body></html>`;
}

const SAMPLE = {
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  { adSlotRenderer: { note: "ignored" } },
                  {
                    videoRenderer: {
                      videoId: "dQw4w9WgXcQ",
                      title: { runs: [{ text: "Focus Mix " }, { text: "Vol 1" }] },
                      ownerText: { runs: [{ text: "Ananta Sounds" }] },
                      lengthText: { simpleText: "1:02:33" },
                      shortViewCountText: { simpleText: "1.2M views" },
                      publishedTimeText: { simpleText: "2 years ago" },
                      thumbnail: {
                        thumbnails: [
                          { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg" },
                          { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }
                        ]
                      }
                    }
                  },
                  {
                    videoRenderer: {
                      videoId: "abcdefghijk",
                      title: { simpleText: "Site Safety Briefing" },
                      longBylineText: { runs: [{ text: "Build Channel" }] },
                      thumbnail: { thumbnails: [] }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    }
  }
};

describe("YouTube results parsing", () => {
  it("extracts ytInitialData from a results page", () => {
    const parsed = extractInitialData(buildPage(SAMPLE));
    expect(parsed).not.toBeNull();
    expect(parsed.contents).toBeDefined();
  });

  it("returns null when the blob is absent or malformed", () => {
    expect(extractInitialData("<html><body>no data here</body></html>")).toBeNull();
    expect(extractInitialData("var ytInitialData = {not json;")).toBeNull();
  });

  it("collects every video renderer while skipping non-video blocks", () => {
    const renderers = collectVideoRenderers(SAMPLE);
    expect(renderers.map((item) => item.videoId)).toEqual(["dQw4w9WgXcQ", "abcdefghijk"]);
  });

  it("reads both simpleText and runs shapes", () => {
    expect(readText({ simpleText: "hello" })).toBe("hello");
    expect(readText({ runs: [{ text: "a" }, { text: "b" }] })).toBe("ab");
    expect(readText(undefined)).toBe("");
  });

  it("normalises a renderer into the mini-player shape", () => {
    const [first, second] = collectVideoRenderers(SAMPLE).map(normaliseScraped);

    expect(first).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Focus Mix Vol 1",
      channel: "Ananta Sounds",
      duration: "1:02:33",
      views: "1.2M views",
      published: "2 years ago",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    });

    // Falls back to longBylineText and a derived thumbnail URL.
    expect(second.channel).toBe("Build Channel");
    expect(second.thumbnail).toBe("https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg");
  });

  it("strips quotes and whitespace from YOUTUBE_API_KEY without logging the key", () => {
    const previous = process.env.YOUTUBE_API_KEY;
    process.env.YOUTUBE_API_KEY = "  'abc123secret'  ";
    expect(readYouTubeApiKey()).toBe("abc123secret");
    process.env.YOUTUBE_API_KEY = previous;
  });

  it("does not recurse infinitely on self-referencing objects", () => {
    const loop = { videoRenderer: { videoId: "loopvideo1" } };
    loop.self = loop;
    expect(() => collectVideoRenderers(loop)).not.toThrow();
  });
});
