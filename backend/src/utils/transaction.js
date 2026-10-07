// Runs a group of database writes as one unit: either all of them save, or none do.
// This replaces LockService + manual rollback from the Apps Script version.
const mongoose = require('mongoose');

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
