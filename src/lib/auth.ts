import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function isAuthenticated() {
  const token = (await cookies()).get('auth_token')?.value;

  if (!token) {
    return false;
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch (error) {
    return false;
  }
}
