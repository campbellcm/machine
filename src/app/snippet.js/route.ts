// No API key is exposed in browser code. Forms forward captured IDs to the customer's server/CRM.
export function GET() {
  return new Response(
    `(function(){var p=new URLSearchParams(location.search),id=p.get('cc_click');if(id&&/^[0-9a-f-]{36}$/i.test(id)){document.cookie='crewcast_click_id='+encodeURIComponent(id)+'; Max-Age=2592000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');}function fill(){var m=document.cookie.match(/(?:^|; )crewcast_click_id=([^;]+)/);if(!m)return;document.querySelectorAll('input[name="crewcast_click_id"]').forEach(function(e){e.value=decodeURIComponent(m[1]);});}fill();document.addEventListener('DOMContentLoaded',fill);document.addEventListener('submit',fill,true);})();`,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
