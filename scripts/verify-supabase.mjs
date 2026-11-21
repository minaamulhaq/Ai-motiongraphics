import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { localSettings } from './supabase-local.mjs';
localSettings();
execFileSync('docker',['exec','-i','supabase_db_ai-vid-studio','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:readFileSync('supabase/tests/workspace.sql'),stdio:['pipe','inherit','inherit']});
console.log('Passed Clerk ownership, guest sharing, chat privacy and spoofing checks. Fixtures rolled back.');
