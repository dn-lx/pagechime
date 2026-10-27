import { createReaderApi, restDatabase } from '../../../server/reader-api.ts';
const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const handler = createReaderApi(restDatabase(url,secret),secret);
Deno.serve((req:Request)=>handler(req,req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown'));
