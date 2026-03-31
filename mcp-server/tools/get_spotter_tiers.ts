export const getSpotterTiers = {
  name: "get_spotter_tiers",
  description: "Get Spotter membership tier comparison",
  inputSchema: {
    type: "object",
    properties: {}
  }
} as const;

export async function getSpotterTiersHandler() {
  const payload = {
    tiers: [
      {
        name: "FREE",
        price: "$0/month",
        features: [
          "Find up to 5 golf partners/month",
          "Join open rounds",
          "Basic course search",
          "Handicap tracking"
        ]
      },
      {
        name: "SELECT",
        price: "$9.99/month",
        features: [
          "Unlimited partner matches",
          "Priority round access",
          "Advanced course analytics",
          "Skill-based pairing"
        ]
      },
      {
        name: "SUMMIT",
        price: "$19.99/month",
        features: [
          "Everything in SELECT",
          "Exclusive tournaments",
          "Concierge round planning",
          "Premium course access"
        ]
      }
    ]
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
