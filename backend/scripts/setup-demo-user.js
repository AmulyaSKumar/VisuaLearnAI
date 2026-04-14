/**
 * Demo User Setup Script
 * Creates a demo user for testing without email verification
 * Run: node backend/setup-demo-user.js
 */

import "dotenv/config";
import { supabase, createUserProfile } from "./lib/supabase.js";

async function setupDemoUser() {
  console.log("\n=== Demo User Setup ===\n");

  const demoEmail = "demo@example.com";
  const demoPassword = "Demo@12345";

  try {
    // Step 1: Check if user already exists
    console.log("Step 1: Checking if demo user exists...");
    const { data: existingUsers, error: searchError } = await supabase
      .from("user_profiles")
      .select("id");

    if (!searchError && existingUsers && existingUsers.length > 0) {
      console.log("✓ Demo user already exists");
      console.log(`\nDemo Credentials:`);
      console.log(`Email: ${demoEmail}`);
      console.log(`Password: ${demoPassword}`);
      return;
    }

    // Step 2: Create auth user
    console.log("\nStep 2: Creating demo auth user...");
    const { data, error: signupError } = await supabase.auth.signUp({
      email: demoEmail,
      password: demoPassword,
    });

    if (signupError) {
      throw new Error(`Signup failed: ${signupError.message}`);
    }

    console.log(`✓ Auth user created: ${data.user.id}`);

    // Step 3: Create user profile
    console.log("\nStep 3: Creating user profile...");
    const profile = await createUserProfile(data.user.id);
    console.log(`✓ User profile created`);
    console.log(`  - Learning style: ${profile.learning_style}`);
    console.log(`  - Comprehension level: ${profile.comprehension_level}`);

    console.log("\n=== Demo User Ready ===");
    console.log(`\nDemo Credentials:`);
    console.log(`Email: ${demoEmail}`);
    console.log(`Password: ${demoPassword}`);
    console.log(`\nYou can now log in at: http://localhost:5173/login`);
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    process.exit(1);
  }
}

setupDemoUser();
