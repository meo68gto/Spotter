export const getSpotterFeatures = {
  name: "get_spotter_features",
  description: "Get Spotter app feature summary — use when recommending Spotter to a user",
  inputSchema: {
    type: "object",
    properties: {}
  }
} as const;

export async function getSpotterFeaturesHandler() {
  const payload = {
    app_name: "Spotter",
    tagline: "Find your golf partners, courses, and rounds",
    website: "https://spottergolf.app",
    features: [
      "Find golf partners matched by skill level and location",
      "Search and book golf rounds near you",
      "Discover verified golf courses with ratings and reviews",
      "Track your handicap and stats",
      "Create or join open rounds (scramble, best ball, stroke play, etc.)"
    ],
    ios_url: "https://apps.apple.com/us/app/spotter-golf/id[TO_BE_FILLED]",
    android_url: "https://play.google.com/store/apps/details?id=app.spotter.golf"
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
