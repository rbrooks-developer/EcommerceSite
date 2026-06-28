"use client";

import Script from "next/script";

function sanitize(id: string) {
  return id.replace(/[^a-zA-Z0-9\-]/g, "");
}

interface TawkChatProps {
  propertyId: string;
  widgetId: string;
  visitor: { name: string; email: string };
}

// Inline SVG used as fallback when Tawk.to's S3 avatar returns 403.
// A simple white silhouette on a teal circle — neutral and chat-appropriate.
const FALLBACK_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E" +
  "%3Ccircle cx='20' cy='20' r='20' fill='%2303b2cb'/%3E" +
  "%3Ccircle cx='20' cy='15' r='7' fill='white'/%3E" +
  "%3Cellipse cx='20' cy='35' rx='12' ry='9' fill='white'/%3E" +
  "%3C/svg%3E";

export function TawkChat({ propertyId, widgetId, visitor }: TawkChatProps) {
  const pid = sanitize(propertyId);
  const wid = sanitize(widgetId);

  if (!pid || !wid) return null;

  const visitorJson = JSON.stringify({ name: visitor.name, email: visitor.email });

  return (
    <Script
      id="tawk-to"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API=Tawk_API||{};
          Tawk_API.visitor=${visitorJson};
          var Tawk_LoadStart=new Date();

          // Watch for Tawk.to's S3 avatar images being inserted into the DOM.
          // Their agent profile photos are stored as private S3 objects which
          // return 403 when loaded from external sites. Swap them for a fallback
          // before the browser shows the broken-image icon.
          (function(){
            var FALLBACK='${FALLBACK_AVATAR}';
            function patchImg(img){
              if(!img || img.dataset.tawkPatched) return;
              img.dataset.tawkPatched='1';
              img.addEventListener('error',function(){
                if(this.src.indexOf('s3.amazonaws.com')!==-1||
                   this.src.indexOf('tawk-to-pi')!==-1){
                  this.src=FALLBACK;
                }
              });
            }
            function scanImgs(root){
              var imgs=root.querySelectorAll?root.querySelectorAll('img'):[];
              for(var i=0;i<imgs.length;i++) patchImg(imgs[i]);
            }
            var obs=new MutationObserver(function(mutations){
              for(var i=0;i<mutations.length;i++){
                var added=mutations[i].addedNodes;
                for(var j=0;j<added.length;j++){
                  var n=added[j];
                  if(n.nodeType!==1) continue;
                  if(n.tagName==='IMG') patchImg(n);
                  else scanImgs(n);
                }
              }
            });
            obs.observe(document.body,{childList:true,subtree:true});
          })();

          (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/${pid}/${wid}';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
          })();
        `,
      }}
    />
  );
}
