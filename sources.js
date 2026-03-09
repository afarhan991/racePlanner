window.ULTRA_SOURCES = {
  official: [
    {
      key: 'race-organizer',
      label: 'Official race organizer data',
      use: 'Race distance, elevation gain, GPX, COP/COT, checkpoint definitions',
      tier: 'Tier 1',
      short: 'Official race docs / GPX'
    }
  ],
  guidelines: [
    {
      key: 'acsm-position-stand',
      label: 'ACSM Position Stand: Exercise and Fluid Replacement',
      use: 'Hydration range framing and sodium/fluid replacement principles for endurance exercise',
      tier: 'Tier 1',
      short: 'ACSM fluid replacement'
    },
    {
      key: 'acsm-and-position',
      label: 'Academy of Nutrition and Dietetics / Dietitians of Canada / ACSM Position Stand',
      use: 'Carbohydrate intake guidance for endurance sport and general sports nutrition framework',
      tier: 'Tier 1',
      short: 'AND/DC/ACSM sports nutrition'
    },
    {
      key: 'issn-position-stand',
      label: 'ISSN Position Stand: Nutrient Timing / Exercise Nutrition',
      use: 'Endurance carbohydrate strategy ranges and practical fueling structure',
      tier: 'Tier 1',
      short: 'ISSN exercise nutrition'
    },
    {
      key: 'ioc-consensus',
      label: 'IOC Consensus Statements on Sports Nutrition',
      use: 'Race-day nutrition framing and endurance-event fueling principles',
      tier: 'Tier 1',
      short: 'IOC sports nutrition'
    }
  ],
  model: [
    {
      key: 'naismith-derived',
      label: 'Distance + climb time model (Naismith-derived trail heuristic)',
      use: 'Projected segment split, pace estimate, cutoff buffer',
      tier: 'Tier 3',
      note: 'Useful for planning, but not a single gold-standard race predictor. Must stay clearly labeled as model output.',
      short: 'Naismith-derived model'
    }
  ]
};
