// Helper function to convert a string to snake case
const toSnakeCase = (str) => {
  return str.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
};

// Helper function to convert object keys to snake case
exports.convertKeysToSnakeCase = (obj) => {
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = toSnakeCase(key);
      result[snakeKey] = obj[key];
    }
  }
  return result;
};
