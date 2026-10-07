// An error with an HTTP status, thrown by services when a business rule fails.
class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;
