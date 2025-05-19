
// PocketBase handles password hashing and verification.
// These bcrypt functions are no longer needed for the core auth flow.

export function generateReferralCode(length: number = 8): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Removed lowercase for simpler codes
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result.toUpperCase();
}
