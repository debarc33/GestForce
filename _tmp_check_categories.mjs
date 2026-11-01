import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
console.log('url present:', !!url, 'key present:', !!key)

const supabase = createClient(url, key)
const { data, error } = await supabase.from('categories').select('*').limit(1)
console.log('error:', JSON.stringify(error))
console.log('sample row keys:', data && data[0] ? Object.keys(data[0]) : data)
