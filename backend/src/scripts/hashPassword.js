// Turns a password into a bcrypt hash for ADMIN_PASSWORD_HASH.
// Usage: npm run hash-password -- "MyStrongPassword"
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Please use a password of at least 8 characters.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log('\nCopy this line into backend/.env (and into Render later):\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
