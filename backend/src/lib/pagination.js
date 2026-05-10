const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const getPagination = (query, defaults = {}) => {
  const defaultLimit = defaults.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = defaults.maxLimit || MAX_LIMIT;
  const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      Number.parseInt(query.limit || String(defaultLimit), 10) || defaultLimit,
    ),
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

export const countMatchingDocuments = async (model, filter) => {
  if (typeof model.countDocuments === "function") {
    return model.countDocuments(filter);
  }

  const rows = await model.find(filter).lean();
  return rows.length;
};
