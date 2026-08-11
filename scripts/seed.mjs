// Creates the first Owner login + a couple of demo Delivery Boy logins.
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
  console.log("Seeding Evergreen Plus Water logins...\n");
  await upsertUser({ email: "owner@evergreenplus.pk", password: "Evergreen@123", full_name: "Hanif (Owner)", role: "owner" });
  await upsertUser({ email: "manager@evergreenplus.pk", password: "Evergreen@123", full_name: "Operations Manager", role: "manager" });
  await upsertUser({ email: "accountant@evergreenplus.pk", password: "Evergreen@123", full_name: "Accountant", role: "accountant" });
  const boy = await upsertUser({ email: "faisal@evergreenplus.pk", password: "Evergreen@123", full_name: "Faisal Nadeem", role: "delivery_boy" });

  if (boy) {
    const { data: existingEmp } = await admin.from("employees").select("id").eq("user_id", boy.id).maybeSingle();
    if (!existingEmp) {
      await admin.from("employees").insert({ user_id: boy.id, name: "Faisal Nadeem", phone: "03001234567", role: "Delivery Boy", status: "Active" });
      console.log("Linked employee record for Faisal Nadeem");
    }
  }

  console.log("\nDone. Login with:");
  console.log("  owner@evergreenplus.pk / Evergreen@123");
  console.log("  manager@evergreenplus.pk / Evergreen@123");
  console.log("  accountant@evergreenplus.pk / Evergreen@123");
  console.log("  faisal@evergreenplus.pk / Evergreen@123  (Delivery Boy)");
  console.log("\n⚠ Change these passwords immediately after first login.");
}

main();
