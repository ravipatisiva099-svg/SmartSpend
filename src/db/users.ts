import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullName = 'Alex Morgan'
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile with database.', {
      cause: error,
    });
  }
}
