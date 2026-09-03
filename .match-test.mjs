import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { register } from 'node:module'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^\uFEFF/,'').replace(/^"|"$/g,'')]}))
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const { data: students } = await a.from('students').select('id, full_name, email').eq('teacher_id','6c11988e-0e14-4035-871d-00f16947dce8').is('archived_at', null)
fs.writeFileSync('.roster.json', JSON.stringify(students))
console.log('roster written:', students.length)
