// Creates the first Owner login from environment variables.
// Run: npm run seed
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
env.split("\n").forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
});

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertUser({ email, password, full_name, role }) {
  const { data: existing } = await admin.auth.admin.listUsers();
  let user = existing?.users?.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) { console.error("Failed to create", email, error.message); return null; }
    user = data.user;
    console.log("Created auth user:", email);
  } else {
    console.log("Already exists:", email);
  }
  const { error: profileErr } = await admin.from("profiles").upsert({ id: user.id, full_name, role, status: "Active" });
  if (profileErr) console.error("Profile error for", email, profileErr.message);
  return user;
}

async function main() {
  const email = process.env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_OWNER_PASSWORD;
  const fullName = process.env.INITIAL_OWNER_NAME?.trim() || "Evergreen Water Owner";

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Set a valid INITIAL_OWNER_EMAIL in .env.local");
  }
  if (!password || password.length < 12) {
    throw new Error("INITIAL_OWNER_PASSWORD must contain at least 12 characters");
  }

  console.log("Creating the initial Evergreen Water owner account...");
  const owner = await upsertUser({ email, password, full_name: fullName, role: "owner" });
  if (!owner) process.exitCode = 1;
  else console.log(`Owner account is ready: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
