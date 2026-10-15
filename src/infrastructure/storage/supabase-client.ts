// src/infrastructure/storage/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jutylxwsrmpjsmuyesfy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JqA7aSgy6gxLFESv3wk6iA_kd9ehD20';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);