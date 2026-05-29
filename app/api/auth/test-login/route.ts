import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';
import { userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const normalizedUsername = username.trim();
    const user = userDB.findByUsername(normalizedUsername) ?? userDB.create(normalizedUsername);

    await createSession(user.id, user.username);

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json({ error: 'Failed to create test session' }, { status: 500 });
  }
}
