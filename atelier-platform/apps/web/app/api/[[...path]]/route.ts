async function proxy(request:Request){
  const url=new URL(request.url);
  let response:Response;
  if(process.env.CLOUDFLARE_WORKER === "1"){
    const {env}=await import(/* webpackIgnore: true */ "cloudflare:workers");
    const headers=new Headers(request.headers);
    headers.set("x-etalier-client-ip",request.headers.get("cf-connecting-ip")||"0.0.0.0");
    response=await env.API.fetch(new Request("https://etalier-api.internal"+url.pathname+url.search,{...request,method:request.method,headers,redirect:"manual",body:["GET","HEAD"].includes(request.method)?undefined:request.body}));
  }else{
    const upstream=new Request((process.env.API_INTERNAL_URL||"http://127.0.0.1:4000").replace(/\/$/,"")+url.pathname+url.search,request);
    response=await fetch(new Request(upstream,{redirect:"manual"}));
  }
  // Framework middleware adds headers; upstream fetch responses have immutable headers.
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:new Headers(response.headers)});
}
export const GET=proxy,POST=proxy,PUT=proxy,PATCH=proxy,DELETE=proxy,OPTIONS=proxy,HEAD=proxy;
