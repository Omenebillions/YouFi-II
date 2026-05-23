import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are placeholders or missing
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your-project-url');
const isValidKey = supabaseAnonKey && supabaseAnonKey !== 'your-anon-key' && supabaseAnonKey.length > 50;

if (!isValidUrl || !isValidKey) {
  console.warn('Supabase credentials missing or invalid. Please follow these steps:');
  console.warn('1. Create a project at https://supabase.com');
  console.warn('2. Get your Project URL and Anon Key from Project Settings > API');
  console.warn('3. In AI Studio, go to Settings > Secrets and add:');
  console.warn('   VITE_SUPABASE_URL="..."');
  console.warn('   VITE_SUPABASE_ANON_KEY="..."');
}

// We use placeholders if keys are missing to prevent the client from throwing an error during initialization
export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://placeholder-ok.supabase.co',
  isValidKey ? supabaseAnonKey : 'placeholder-key-long-enough-to-not-fail-instantly-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
);
