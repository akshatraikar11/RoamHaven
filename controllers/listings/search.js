/**
 * Search and filter utilities for listings
 */

function getSeasonalCollectionFilter(collection) {
  const month = new Date().getMonth() + 1;
  if (!collection) return null;

  const collections = {
    monsoon_getaways: {
      months: [6, 7, 8, 9],
      categories: ["mountains", "farms"],
    },
    winter_cabins: {
      months: [11, 12, 1, 2],
      categories: ["mountains", "castles"],
    },
    summer_beach: {
      months: [3, 4, 5, 6],
      categories: ["pools", "trending"],
    },
  };

  const cfg = collections[collection];
  if (!cfg || !cfg.months.includes(month)) return null;
  return { category: { $in: cfg.categories } };
}

module.exports = {
  getSeasonalCollectionFilter,
};
