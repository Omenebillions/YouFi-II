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
const client = createClient(
  isValidUrl ? supabaseUrl : 'https://placeholder-ok.supabase.co',
  isValidKey ? supabaseAnonKey : 'placeholder-key-long-enough-to-not-fail-instantly-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
);

// Apply monkey-patching to the client object to safely bridge table column schema differences (note vs description)
const originalFrom = client.from;
client.from = function(table: string) {
  const queryBuilder = originalFrom.call(this, table) as any;

  const originalInsert = queryBuilder.insert;
  const originalUpdate = queryBuilder.update;

  queryBuilder.insert = function(values: any, options?: any) {
    let processed = values;
    if (table === 'transactions') {
      if (Array.isArray(values)) {
        processed = values.map(v => {
          const { note, ...rest } = v;
          return { ...rest, description: note !== undefined ? note : v.description };
        });
      } else if (values && typeof values === 'object') {
        const { note, ...rest } = values;
        processed = { ...rest, description: note !== undefined ? note : values.description };
      }
    } else if (table === 'business_transactions') {
      if (Array.isArray(values)) {
        processed = values.map(({ note, description, ...rest }) => rest);
      } else if (values && typeof values === 'object') {
        const { note, description, ...rest } = values;
        processed = rest;
      }
    }
    return originalInsert.call(queryBuilder, processed, options);
  };

  queryBuilder.update = function(values: any, options?: any) {
    let processed = values;
    if (table === 'transactions') {
      if (Array.isArray(values)) {
        processed = values.map(v => {
          const { note, ...rest } = v;
          return { ...rest, description: note !== undefined ? note : v.description };
        });
      } else if (values && typeof values === 'object') {
        const { note, ...rest } = values;
        processed = { ...rest, description: note !== undefined ? note : values.description };
      }
    } else if (table === 'business_transactions') {
      if (Array.isArray(values)) {
        processed = values.map(({ note, description, ...rest }) => rest);
      } else if (values && typeof values === 'object') {
        const { note, description, ...rest } = values;
        processed = rest;
      }
    }
    return originalUpdate.call(queryBuilder, processed, options);
  };

  // Intercept reads to dynamically map 'description' field into 'note'
  const originalThen = queryBuilder.then;
  queryBuilder.then = function(onfulfilled: any, onrejected: any) {
    return originalThen.call(queryBuilder, (res: any) => {
      if (res && res.data) {
        if (table === 'transactions') {
          if (Array.isArray(res.data)) {
            res.data = res.data.map((tx: any) => ({
              ...tx,
              note: tx.note !== undefined ? tx.note : (tx.description || '')
            }));
          } else if (res.data && typeof res.data === 'object') {
            res.data.note = res.data.note !== undefined ? res.data.note : (res.data.description || '');
          }
        }
      }
      return onfulfilled ? onfulfilled(res) : res;
    }, onrejected);
  };

  return queryBuilder;
};

export const supabase = client;

