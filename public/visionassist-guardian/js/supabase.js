// VisionAssist Guardian Portal - Supabase Client Setup
const SUPABASE_URL = "https://ryunlxxgmfwfnjcpovwg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dW5seHhnbWZ3Zm5qY3BvdndnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMzc2NjAsImV4cCI6MjA5OTYxMzY2MH0.gfT7cgf67KBEP1zYlWzHgS14369fgbS46ipHpL4eyjE";

// Initialize Supabase Client
let supabaseClient = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;

  // Check if Supabase CDN has loaded
  if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
  }

  console.error("Supabase JS library not loaded. Ensure the CDN script tag is placed BEFORE this script.");
  return null;
}

// Demo mode is permanently disabled — always uses live database
function isDemoMode() {
  return false;
}
