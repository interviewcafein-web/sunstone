// Copies coding usernames from the Google Form sheet onto students, matched by email.
//   npm run db:sync-sheet            (DATABASE_URL and SHEET_ID from .env.local)
//   npm run db:sync-sheet -- --dry   (report only)
//   npm run db:sync-sheet -- --unmatched   (also list the sheet entries with no student)

import { syncSheet } from '../api/_sheet-sync';

const dryRun = process.argv.includes('--dry');
const result = await syncSheet({ dryRun });

console.log(`Sheet entries:                      ${result.sheetEntries}
Matched to a student by email:      ${result.matched}
Updated in the database:            ${dryRun ? '(dry run)' : result.updated}
No student with that email:         ${result.unmatched.length}`);

if (process.argv.includes('--unmatched')) {
  for (const entry of result.unmatched) {
    console.log(`  ${entry.name} · ${entry.email} · ${entry.campus}`);
  }
}
