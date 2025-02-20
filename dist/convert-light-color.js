import{clamp}from"../number/clamp";let DEFAULT_MIN_KELVIN=2700,DEFAULT_MAX_KELVIN=6500,temperatureRed=e=>e<=66?255:clamp(329.698727446*(e-60)**-.1332047592,0,255),temperatureGreen=e=>{let r;return r=e<=66?99.4708025861*Math.log(e)-161.1195681661:288.1221695283*(e-60)**-.0755148492,clamp(r,0,255)},temperatureBlue=e=>66<=e?255:e<=19?0:(e=138.5177312231*Math.log(e-10)-305.0447927307,clamp(e,0,255)),temperature2rgb=e=>{e/=100;return[temperatureRed(e),temperatureGreen(e),temperatureBlue(e)]},matchMaxScale=(e,r)=>{var e=Math.max(...e),t=Math.max(...r);let a;return a=0===t?0:e/t,r.map(e=>Math.round(e*a))},mired2kelvin=e=>Math.floor(1e6/e),kelvin2mired=e=>Math.floor(1e6/e),rgbww2rgb=(e,r,t)=>{var[e,a,m,l,u]=e,r=kelvin2mired(r??DEFAULT_MIN_KELVIN),t=kelvin2mired(t??DEFAULT_MAX_KELVIN),r=r-t;let p;try{p=u/(l+u)}catch(e){p=.5}var t=t+p*r,r=t?mired2kelvin(t):0,[t,r,M]=temperature2rgb(r),n=Math.max(l,u)/255,t=[e+t*n,a+r*n,m+M*n];return matchMaxScale([e,a,m,l,u],t)},rgbw2rgb=e=>{var[e,r,t,a]=e,m=[e+a,r+a,t+a];return matchMaxScale([e,r,t,a],m)};export{temperature2rgb,rgbww2rgb,rgbw2rgb};