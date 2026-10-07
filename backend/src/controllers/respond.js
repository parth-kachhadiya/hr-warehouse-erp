// Every successful response looks like: { success: true, data: ... }
const send = (res, data, status = 200) => res.status(status).json({ success: true, data });

module.exports = { send };
