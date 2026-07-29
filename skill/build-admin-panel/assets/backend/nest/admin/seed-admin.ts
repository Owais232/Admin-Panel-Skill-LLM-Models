import 'reflect-metadata';
import '../config/load-env'; // ADAPT: whatever loads .env in this codebase
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { getBcryptRounds } from '../common/utils/password.util';
import { Profile, ProfileSchema } from '../modules/user/profile.schema';
import { User, UserSchema } from '../modules/user/user.schema';

/**
 * Creates (or repairs) an administrator account.
 *
 * THIS IS THE STEP EVERYONE FORGETS. A fresh database has zero users, so
 * there is no way to log into the panel until this has run against that
 * specific database. It is easy to skip because it sits outside the normal
 * edit/build/test loop, and after a deploy it presents as "incorrect email
 * or password", which reads like a broken auth flow rather than an empty
 * table. Deploying code never creates rows.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='...' npm run seed:admin
 *   npm run seed:admin -- --email admin@example.com --name 'Ops Admin'
 *   npm run seed:admin -- --email admin@example.com --reset-password
 *
 * Env is preferred over --password: argv is visible in `ps` and lands in
 * shell history.
 *
 * Idempotent by design, re-running never allocates a second sequence number,
 * never duplicates the profile, and never rotates an existing password unless
 * --reset-password is passed. Idempotence matters because this gets run
 * against production more than once, usually by someone unsure whether the
 * first run worked.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Suppress echo so the password is not printed while typing.
    const original = (
      rl as unknown as { _writeToOutput?: (value: string) => void }
    )._writeToOutput;
    (
      rl as unknown as { _writeToOutput: (value: string) => void }
    )._writeToOutput = function writeMasked(value: string) {
      process.stdout.write(value.includes(question) ? question : '*');
    };

    rl.question(question, (answer) => {
      (
        rl as unknown as { _writeToOutput?: (value: string) => void }
      )._writeToOutput = original;
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });

    rl.on('error', reject);
  });
}

async function seedAdmin() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      name: { type: 'string' },
      'reset-password': { type: 'boolean' },
    },
    allowPositionals: false,
  });

  const email = (values.email ?? process.env.ADMIN_EMAIL ?? '')
    .trim()
    .toLowerCase();
  let password = values.password ?? process.env.ADMIN_PASSWORD ?? '';
  const name = (values.name ?? process.env.ADMIN_NAME ?? 'Administrator').trim();
  const resetPassword = values['reset-password'] === true;

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('A valid --email (or ADMIN_EMAIL) is required');
  }

  if (!password) {
    password = await promptHidden('Admin password: ');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'app_db';

  if (!mongoUri) throw new Error('MONGO_URI is not set');

  await mongoose.connect(mongoUri, { dbName });

  // ORDER MATTERS. If the user schema has a `pre(/^find/)` hook that
  // auto-populates a related document, that related model must be registered
  // BEFORE the first user query or mongoose throws MissingSchemaError. In the
  // app this never happens, because the Nest DI container registers every
  // model at boot, a standalone script does not.
  const ProfileModel =
    mongoose.models[Profile.name] ?? mongoose.model(Profile.name, ProfileSchema);
  const UserModel =
    mongoose.models[User.name] ?? mongoose.model(User.name, UserSchema);

  const existing = await UserModel.findOne({ email }).select('+password').exec();

  let userId: mongoose.Types.ObjectId;
  let created = false;
  let passwordWritten = false;

  // ADAPT: this $set must satisfy EVERY precondition the login path checks.
  // Read AuthService.login and mirror its guards, an account that is missing
  // `isEmailVerified` will be created successfully and then refuse to log in,
  // which is a genuinely confusing failure.
  const activationFields = {
    role: 'admin',
    isEmailVerified: true,
    isActive: true,
    isBlocked: false,
    isDeleted: false,
  };

  if (existing) {
    const shouldWritePassword = resetPassword || !existing.password;
    const $set: Record<string, unknown> = { ...activationFields };

    if (shouldWritePassword) {
      $set.password = await bcrypt.hash(password, getBcryptRounds());
      $set.passwordChangedAt = new Date();
      passwordWritten = true;
    }

    await UserModel.updateOne(
      { _id: existing._id },
      {
        $set,
        // Clear anything that would block login on a repaired account.
        $unset: {
          blockedAt: 1,
          blockedReason: 1,
          deletedAt: 1,
          emailVerificationToken: 1,
          resetPasswordToken: 1,
        },
      },
    ).exec();

    userId = existing._id;
  } else {
    const doc = await UserModel.create({
      email,
      password: await bcrypt.hash(password, getBcryptRounds()),
      passwordChangedAt: new Date(),
      ...activationFields,
    });

    userId = doc._id;
    created = true;
    passwordWritten = true;
  }

  // ADAPT / DELETE if this codebase has no separate profile document.
  const profile = await ProfileModel.findOne({ user: userId }).exec();
  if (profile) {
    await ProfileModel.updateOne({ _id: profile._id }, { $set: { name } }).exec();
  } else {
    await ProfileModel.create({ user: userId, name });
  }

  console.log(
    `${created ? 'Created' : 'Updated'} admin in ${dbName}: email=${email} ` +
      `id=${userId.toString()} password=${
        passwordWritten
          ? 'written'
          : 'left unchanged (pass --reset-password to rotate)'
      }`,
  );
  // The password itself is deliberately never printed.
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(
      `Failed to seed admin: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
