// Wraps an async Express route handler so thrown errors / rejected promises
// are caught and turned into a proper JSON error response instead of an
// unhandled rejection (which would otherwise hang or crash the function).
function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    });
  };
}

module.exports = { ah };
