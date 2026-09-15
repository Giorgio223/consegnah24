const {createClient}=require('@supabase/supabase-js');
const ADMIN_EMAIL=String(process.env.ADMIN_EMAIL||'angiorgio6@gmail.com').trim().toLowerCase();
function adminClient(){return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}})}
function tokenFrom(req){const a=req.headers.authorization||'';return a.startsWith('Bearer ')?a.slice(7):''}
async function authUser(db,req){const token=tokenFrom(req);if(!token)return null;const{data,error}=await db.auth.getUser(token);return error?null:data?.user||null}
function norm(v){return String(v||'').trim().toLowerCase()}
async function findUserByEmail(db,email){const wanted=norm(email);for(let page=1;page<=50;page++){const{data,error}=await db.auth.admin.listUsers({page,perPage:1000});if(error)throw error;const users=data?.users||[],found=users.find(u=>norm(u.email)===wanted);if(found)return found;if(users.length<1000)break}return null}
function randomToken(){return require('crypto').randomBytes(24).toString('hex')}
module.exports={ADMIN_EMAIL,adminClient,authUser,norm,findUserByEmail,randomToken};
