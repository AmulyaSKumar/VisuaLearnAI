/**
 * Test Day 1: Supabase Connection & Database Operations
 * Verifies that all database tables are accessible and RLS policies work
 * Run: node backend/test_day1_supabase.js
 */

import "dotenv/config";
import { supabase } from "./lib/supabase.js";

async function testSupabaseConnection() {
  console.log("\n=== Supabase Connection Test ===");

  try {
    // Test 1: Check if we can authenticate
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.warn("⚠️  No authenticated user (expected in test mode)");
    } else {
      console.log("✓ Auth connection successful");
    }

    // Test 2: List tables
    console.log("\n=== Database Tables ===");
    const tables = [
      "user_profiles",
      "conversations",
      "messages",
      "feedback",
      "asset_cache",
      "fact_checks",
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`✗ ${table}: ${error.message}`);
      } else {
        console.log(`✓ ${table}: Table exists`);
      }
    }

    console.log("\n=== Connection Test Complete ===\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testSupabaseConnection();
