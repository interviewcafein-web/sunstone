// Makes one AUTH_USERS entry: npm run hash-password -- <username> <password>
// Join several entries with commas in the AUTH_USERS environment variable on Vercel.

import { randomBytes, pbkdf2Sync } from 'node:crypto';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: npm run hash-password -- <username> <password>');
  process.exit(1);
}

const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
const b64url = (buffer) => buffer.toString('base64url');

console.log(
  `${username.trim().toLowerCase()}:pbkdf2.${iterations}.${b64url(salt)}.${b64url(hash)}`
);
