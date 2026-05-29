# PRP 11: Authentication (WebAuthn/Passkeys)

## Feature Overview

Implement passwordless authentication using WebAuthn/Passkeys. Users register and log in using biometrics (fingerprint, Face ID) or a hardware security key. Sessions are maintained with JWT stored in HTTP-only cookies (7-day expiry). All protected routes redirect unauthenticated users to `/login`.

---

## User Stories

- **As a new user**, I want to register with a passkey (biometric/security key) so I don't need a password.
- **As a returning user**, I want to log in with my passkey quickly and securely.
- **As a user**, I want my session to persist for 7 days so I don't need to log in every day.
- **As a user**, I want to log out and have my session immediately invalidated.
- **As an unauthenticated visitor**, I want to be redirected to `/login` when I try to access protected pages.

---

## User Flow

### Registration
1. User navigates to `/login`
2. Enters a display name (username)
3. Clicks "Register with Passkey"
4. Browser prompts for biometric or security key interaction
5. On success, user is logged in and redirected to `/` (home)

### Login
1. User navigates to `/login`
2. Clicks "Login with Passkey"
3. Browser prompts for biometric or security key
4. On success, user is redirected to `/`

### Logout
1. User clicks the "Logout" button in the app header
2. Session cookie is deleted
3. User is redirected to `/login`

### Protected Route Access
1. Unauthenticated user navigates to `/` or `/calendar`
2. Middleware detects no valid session cookie
3. User is redirected to `/login?from=/` (preserves intended destination)
4. After login, user is redirected to the original intended path

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,    -- base64url encoded
  public_key TEXT NOT NULL,             -- base64url encoded COSE key
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,                       -- JSON array of transport strings
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_authenticators_user_id ON authenticators(user_id);
CREATE INDEX idx_authenticators_credential_id ON authenticators(credential_id);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register-options` | Get WebAuthn registration options |
| `POST` | `/api/auth/register-verify` | Verify registration response & create user |
| `POST` | `/api/auth/login-options` | Get WebAuthn authentication options |
| `POST` | `/api/auth/login-verify` | Verify login response & issue session |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/me` | Return current user info (requires auth) |

### Session Management: `lib/auth.ts`

```typescript
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
const SESSION_COOKIE = 'session';

export interface SessionPayload {
  userId: number;
  username: string;
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
```

### Middleware: `middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/', '/calendar'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(p =>
    pathname === p || pathname.startsWith(p + '/')
  );

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get('session')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/', '/calendar', '/calendar/:path*'],
};
```

### WebAuthn Registration Flow

```typescript
// Client: app/login/page.tsx
import { startRegistration } from '@simplewebauthn/browser';

async function register(username: string) {
  // 1. Get options from server
  const optRes = await fetch('/api/auth/register-options', {
    method: 'POST',
    body: JSON.stringify({ username }),
    headers: { 'Content-Type': 'application/json' },
  });
  const options = await optRes.json();

  // 2. Prompt user for biometric/key
  const credential = await startRegistration(options);

  // 3. Verify with server
  const verRes = await fetch('/api/auth/register-verify', {
    method: 'POST',
    body: JSON.stringify({ username, credential }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (verRes.ok) router.push('/');
}
```

### WebAuthn Login Flow

```typescript
// Client: app/login/page.tsx
import { startAuthentication } from '@simplewebauthn/browser';

async function login(username: string) {
  // 1. Get challenge from server
  const optRes = await fetch('/api/auth/login-options', {
    method: 'POST',
    body: JSON.stringify({ username }),
    headers: { 'Content-Type': 'application/json' },
  });
  const options = await optRes.json();

  // 2. Prompt user
  const assertion = await startAuthentication(options);

  // 3. Verify
  const verRes = await fetch('/api/auth/login-verify', {
    method: 'POST',
    body: JSON.stringify({ username, assertion }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (verRes.ok) router.push(searchParams.get('from') ?? '/');
}
```

### Key Library Notes

- Use `@simplewebauthn/server` and `@simplewebauthn/browser` for all WebAuthn operations
- **Always use `authenticator.counter ?? 0`** when accessing the counter field to handle undefined
- Use `isoBase64URL` from `@simplewebauthn/server/helpers` for `credential_id` encoding
- Store challenge in an in-memory or DB cache; validate within a short window (5 minutes)
- `RP_ID`: hostname only (e.g., `localhost` or `your-app.vercel.app`)
- `RP_ORIGIN`: full URL (e.g., `http://localhost:3000` or `https://your-app.vercel.app`)

### Environment Variables

```env
JWT_SECRET=your-random-32-plus-character-secret-here
RP_ID=localhost
RP_NAME=Todo App
RP_ORIGIN=http://localhost:3000
```

---

## UI Components

### Login Page: `app/login/page.tsx`

```tsx
export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-gray-800 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Todo App</h1>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="input w-full mb-4"
        />
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button onClick={() => login(username)} className="btn-primary w-full mb-3">
          🔑 Login with Passkey
        </button>
        <button onClick={() => register(username)} className="btn-secondary w-full">
          ✨ Register with Passkey
        </button>
      </div>
    </div>
  );
}
```

### Logout Button (App Header)

```tsx
<button onClick={logout} className="btn-secondary text-sm">
  Logout
</button>

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  router.push('/login');
}
```

---

## Edge Cases

- **Username not found on login**: Return `400` — "Username not found"
- **Username already taken on register**: Return `409` — "Username already taken"
- **Challenge expired**: Return `400` — "Challenge expired. Please try again."
- **WebAuthn not supported** (old browser): Show fallback message "Your browser does not support passkeys"
- **Counter mismatch**: May indicate cloned authenticator — return `401`, do not update counter
- **Cookie missing on protected route**: Middleware redirects to `/login`
- **Expired JWT**: `jwt.verify` throws; `getSession` returns `null`; middleware redirects
- **Multiple authenticators per user**: Schema supports multiple rows in `authenticators` per `user_id`
- **Mobile browsers**: WebAuthn works in Chrome for Android and Safari iOS 16+; test specifically

---

## Acceptance Criteria

- [ ] Registration works with a passkey (browser biometric or security key)
- [ ] Login works with the registered passkey
- [ ] Session persists for 7 days (JWT expiry)
- [ ] Logout clears the session cookie immediately
- [ ] Protected routes (`/` and `/calendar`) redirect to `/login` when unauthenticated
- [ ] `/login` redirects to `/` when already authenticated
- [ ] JWT stored in HTTP-only cookie (not accessible to JavaScript)
- [ ] Secure flag enabled in production (HTTPS)
- [ ] `counter ?? 0` used to prevent undefined counter errors

---

## Testing Requirements

### E2E Tests (Playwright with Virtual Authenticator)

```typescript
// tests/11-authentication.spec.ts
// Configure virtual WebAuthn authenticator in playwright.config.ts:
// use: { launchOptions: { args: ['--enable-virtual-authenticator-environment'] } }

test('Register new user with passkey')
test('Login with registered passkey')
test('Logout clears session - redirected to /login')
test('Access / without auth - redirected to /login')
test('Access /calendar without auth - redirected to /login')
test('/login redirects authenticated user to /')
test('After login, redirected to original intended path (from param)')
```

### Unit Tests

```typescript
// tests/unit/auth.test.ts
test('createSession creates valid JWT with 7-day expiry')
test('getSession returns payload for valid JWT')
test('getSession returns null for expired JWT')
test('getSession returns null for tampered JWT')
test('deleteSession removes cookie')
```

---

## Out of Scope

- Traditional username/password authentication
- OAuth (Google, GitHub sign-in)
- Email/magic link authentication
- Multi-factor authentication (MFA) beyond WebAuthn
- Password reset flow
- Account deletion
- Multiple devices per account (one authenticator per registration supported in MVP)

---

## Success Metrics

- Registration and login complete in < 2 seconds (excluding biometric prompt time)
- Session validated in < 10ms (JWT decode is synchronous)
- Zero session leakage between users (userId scoped to all DB queries)
- Protected routes inaccessible without valid session (verified in E2E tests)
- JWT stored only in HTTP-only cookie (not in localStorage or sessionStorage)
