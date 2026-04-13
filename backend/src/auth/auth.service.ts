import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { User } from './user.schema';
import appleSigninAuth from 'apple-signin-auth';

async function verifyGoogleToken(idToken: string): Promise<{ sub: string; email: string; name: string }> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const data = await res.json() as Record<string, string>;
  if (!res.ok || data['error']) {
    throw { statusCode: 401, message: 'Invalid Google token' };
  }
  const allowedAudiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean);
  if (allowedAudiences.length > 0 && !allowedAudiences.includes(data['aud'])) {
    throw { statusCode: 401, message: 'Invalid Google token audience' };
  }
  return { sub: data['sub'], email: data['email'], name: data['name'] || '' };
}

async function verifyAppleToken(idToken: string): Promise<{ sub: string; email: string }> {
  try {
    const payload = await appleSigninAuth.verifyIdToken(idToken, {
      audience: process.env.APPLE_BUNDLE_ID || 'com.parkmark.app',
      ignoreExpiration: true,
    });
    return { sub: payload.sub, email: payload.email || '' };
  } catch {
    throw { statusCode: 401, message: 'Invalid Apple token' };
  }
}

export async function signup(
  app: FastifyInstance,
  data: { email: string; password: string; name: string },
) {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    throw { statusCode: 409, message: 'Email already registered' };
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    email: data.email.toLowerCase(),
    password: hashedPassword,
    name: data.name,
  });

  const token = app.jwt.sign(
    { sub: user._id.toString(), email: user.email },
    { expiresIn: '7d' },
  );

  console.log(`New user registered: ${user.email}`);
  return { token, user: { id: user._id.toString(), email: user.email, name: user.name } };
}

export async function login(
  app: FastifyInstance,
  data: { email: string; password: string },
) {
  const user = await User.findOne({ email: data.email.toLowerCase() });
  if (!user || !user.password) {
    throw { statusCode: 401, message: 'Invalid credentials' };
  }

  const isValid = await bcrypt.compare(data.password, user.password);
  if (!isValid) {
    throw { statusCode: 401, message: 'Invalid credentials' };
  }

  if ((user as any).banned) {
    throw { statusCode: 403, message: 'Account suspended' };
  }

  const token = app.jwt.sign(
    { sub: user._id.toString(), email: user.email },
    { expiresIn: '7d' },
  );

  console.log(`User logged in: ${user.email}`);
  return { token, user: { id: user._id.toString(), email: user.email, name: user.name } };
}

export async function oauthLogin(
  app: FastifyInstance,
  data: { provider: 'google' | 'apple'; idToken: string; name?: string },
) {
  let email: string;
  let providerId: string;
  let displayName: string;

  if (data.provider === 'google') {
    const google = await verifyGoogleToken(data.idToken);
    email = google.email;
    providerId = google.sub;
    displayName = data.name || google.name || email.split('@')[0];
  } else {
    const apple = await verifyAppleToken(data.idToken);
    email = apple.email;
    providerId = apple.sub;
    displayName = data.name || (email ? email.split('@')[0] : 'User');
  }

  const idField = data.provider === 'google' ? 'googleId' : 'appleId';

  // 1. Find by provider ID
  let user = await User.findOne({ [idField]: providerId });

  if (!user && email) {
    // 2. Find by email and link
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      (user as any)[idField] = providerId;
      await user.save();
    }
  }

  if (!user) {
    // 3. Create new OAuth user
    const safeEmail = email || `${data.provider}_${providerId}@parkmark.private`;
    user = await User.create({
      email: safeEmail.toLowerCase(),
      password: null,
      name: displayName,
      [idField]: providerId,
    });
  }

  const token = app.jwt.sign(
    { sub: user._id.toString(), email: user.email },
    { expiresIn: '7d' },
  );

  console.log(`OAuth login [${data.provider}]: ${user.email}`);
  return { token, user: { id: user._id.toString(), email: user.email, name: user.name } };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw { statusCode: 404, message: 'User not found' };
  }

  // Abonelik süresi dolmuşsa isSubscribed'ı güncelle (webhook gecikse bile doğru değer döner)
  const now = new Date();
  if (user.isSubscribed && user.subscriptionExpiresAt && user.subscriptionExpiresAt < now) {
    user.isSubscribed = false;
    user.subscriptionPlan = null;
    user.subscriptionExpiresAt = null;
    await user.save();
  }

  return { user };
}
