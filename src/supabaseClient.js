import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vzalryuhmzdwvptlfvrc.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YWxyeXVobXpkd3ZwdGxmdnJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4MjgyODUsImV4cCI6MjExMDQwNDI4NX0.881-XjmtrOIORIDxnH_nzakzN9p5V8jmscGZWscDIBQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
