/** @param {string} comment */
const hasThrowsTag = comment =>
  comment.includes('@throws') ||
  comment.includes('@exception');

exports.hasThrowsTag = hasThrowsTag;
