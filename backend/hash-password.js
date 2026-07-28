// Usage: node hash-password.js "MyPassword123"
// Prints a bcrypt hash to paste into column B of the "Users" sheet tab.
// This keeps real passwords out of the spreadsheet - only the hash is stored.
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node hash-password.js "YourPasswordHere"');
  process.exit(1);
}

bcrypt.hash(password, 10).then(hash => {
  console.log('\nPaste this into column B (password_hash) of the Users tab:\n');
  console.log(hash);
});
