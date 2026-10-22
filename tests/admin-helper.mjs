import assert from 'node:assert/strict';
export async function login(handler,origin,username='editor',password='example-password-for-tests'){
  let response=await handler(new Request(origin+'/admin/login/'));
  assert.equal(response.status,200);
  const html=await response.text(),csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
  const preCookie=response.headers.getSetCookie().find(v=>v.startsWith('__Host-yjbest_admin_login=')).split(';')[0];
  response=await handler(new Request(origin+'/admin/login/',{method:'POST',headers:{origin,cookie:preCookie},body:new URLSearchParams({csrf,username,password})}));
  assert.equal(response.status,303);
  const cookie=response.headers.getSetCookie().find(v=>v.startsWith('__Host-yjbest_admin_session=')).split(';')[0];
  const token=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url').toString()).n;
  return {cookie,csrf:token};
}
