// --- Supabase Configuration ---
// Make sure this file is loaded AFTER the Supabase CDN script in your HTML files.

const supabaseUrl = 'https://pepssguwzodytdxhgzmq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlcHNzZ3V3em9keXRkeGhnem1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNDM2NjksImV4cCI6MjA4NjcxOTY2OX0.Y8UQrDU2QGqoj-9gRjnX2VZaTdDO8jL9ejFo4wrcMpo';

// Initialize the Supabase client and attach it to the window object so other scripts can use it
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

console.log('Supabase Initialized', window.supabaseClient);
