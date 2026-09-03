module.exports = (request, options) => {
  const { defaultResolver } = options;

  if (request.endsWith('.js') && !request.startsWith('node:')) {
    const withoutJs = request.slice(0, -3);

    try {
      return defaultResolver(withoutJs, options);
    } catch {}
  }

  return defaultResolver(request, options);
};
