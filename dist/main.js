import{LitElement,html,css,svg,unsafeCSS}from"lit-element";import{styleMap}from"lit-html/directives/style-map.js";import{unsafeSVG}from"lit-html/directives/unsafe-svg.js";import{ifDefined}from"lit-html/directives/if-defined.js";import{version}from"../package.json";import{SVG_DEFAULT_DIMENSIONS,SVG_VIEW_BOX,FONT_SIZE}from"./const";import Merge from"./merge";import Utils from"./utils";import Templates from"./templates";import Toolset from"./toolset";import Colors from"./colors";import{hs2rgb,rgb2hex,rgb2hsv,hsv2rgb}from"./frontend_mods/color/convert-color";import{rgbw2rgb,rgbww2rgb,temperature2rgb}from"./frontend_mods/color/convert-light-color";import{computeDomain}from"./frontend_mods/common/entity/compute_domain";console.info(`%c  SWISS-ARMY-KNIFE-CARD  
%c      Version ${version}      `,"color: yellow; font-weight: bold; background: black","color: white; font-weight: bold; background: dimgray");class SwissArmyKnifeCard extends LitElement{constructor(){if(super(),this.connected=!1,Colors.setElement(this),this.cardId=Math.random().toString(36).substr(2,9),this.entities=[],this.entitiesStr=[],this.attributesStr=[],this.secondaryInfoStr=[],this.iconStr=[],this.viewBoxSize=SVG_VIEW_BOX,this.viewBox={width:SVG_VIEW_BOX,height:SVG_VIEW_BOX},this.toolsets=[],this.tools=[],this.styles={},this.styles.card={},this.styles.card.default={},this.styles.card.light={},this.styles.card.dark={},this.entityHistory={},this.entityHistory.needed=!1,this.stateChanged=!0,this.entityHistory.updating=!1,this.entityHistory.update_interval=300,this.dev={},this.dev.debug=!1,this.dev.performance=!1,this.dev.m3=!1,this.configIsSet=!1,this.theme={},this.theme.checked=!1,this.theme.isLoaded=!1,this.theme.modeChanged=!1,this.theme.darkMode=!1,this.theme.light={},this.theme.dark={},this.isSafari=!!window.navigator.userAgent.match(/Version\/[\d\.]+.*Safari/),this.iOS=(/iPad|iPhone|iPod/.test(window.navigator.userAgent)||"MacIntel"===window.navigator.platform&&1<window.navigator.maxTouchPoints)&&!window.MSStream,this.isSafari14=this.isSafari&&/Version\/14\.[0-9]/.test(window.navigator.userAgent),this.isSafari15=this.isSafari&&/Version\/15\.[0-9]/.test(window.navigator.userAgent),this.isSafari16=this.isSafari&&/Version\/16\.[0-9]/.test(window.navigator.userAgent),this.isSafari16=this.isSafari&&/Version\/16\.[0-9]/.test(window.navigator.userAgent),this.isSafari14=this.isSafari14||/os 15.*like safari/.test(window.navigator.userAgent.toLowerCase()),this.isSafari15=this.isSafari15||/os 14.*like safari/.test(window.navigator.userAgent.toLowerCase()),this.isSafari16=this.isSafari16||/os 16.*like safari/.test(window.navigator.userAgent.toLowerCase()),this.lovelace=SwissArmyKnifeCard.lovelace,!this.lovelace)throw console.error("card::constructor - Can't get Lovelace panel"),Error("card::constructor - Can't get Lovelace panel");SwissArmyKnifeCard.colorCache||(SwissArmyKnifeCard.colorCache=[]),this.palette={},this.palette.light={},this.palette.dark={},this.dev.debug&&console.log("*****Event - card - constructor",this.cardId,(new Date).getTime())}static getSystemStyles(){return css`
      :host {
        cursor: default;
        font-size: ${FONT_SIZE}px;
        --sak-ref-palette-gray-platinum: #e9e9ea;
        --sak-ref-palette-gray-french-gray: #d1d1d6;
        --sak-ref-palette-gray-taupe-gray: #8e8e93;
        --sak-ref-palette-gray-cool-gray: #919bb4;

        --sak-ref-palette-yellow-sunglow: #F7ce46;
        --sak-ref-palette-yellow-jonquil: #ffcc01;
        --sak-ref-palette-yellow-Amber: #f6b90b;

        --sak-ref-palette-orange-xanthous: #F3b530;
        --sak-ref-palette-orange-princeton-orange: #ff9500;
        --sak-ref-palette-orange-orange : #F46c36;

        --sak-ref-palette-red-indian-red: #ed5254;
        --sak-ref-palette-red-japser: #d85140;
        --sak-ref-palette-red-cinnabar: #ff3b2f;

        --sak-ref-palette-purple-amethyst: #Af52de;
        --sak-ref-palette-purple-tropical-indigo: #8d82ef;
        --sak-ref-palette-purple-slate-blue: #5f5dd1;
      }

      /* Default settings for the card */
      /* - default cursor */
      /* - SVG overflow is not displayed, ie cutoff by the card edges */
      ha-card {
        cursor: default;
        overflow: hidden;
        
        -webkit-touch-callout: none;  
      }
      
      /* For disabled parts of tools/toolsets */
      /* - No input */
      ha-card.disabled {
        pointer-events: none;
        cursor: default;
      }

      .disabled {
        pointer-events: none !important;
        cursor: default !important;
      }

      /* For 'active' tools/toolsets */
      /* - Show cursor as pointer */
      .hover {
        cursor: pointer;
      }

      /* For hidden tools/toolsets where state for instance is undefined */
      .hidden {
        opacity: 0;
        visibility: hidden;
        transition: visibility 0s 1s, opacity 0.5s linear;
      }

      focus {
        outline: none;
      }
      focus-visible {
        outline: 3px solid blanchedalmond; /* That'll show 'em */
      }
      
      
      @media (print), (prefers-reduced-motion: reduce) {
        .animated {
          animation-duration: 1ms !important;
          transition-duration: 1ms !important;
          animation-iteration-count: 1 !important;
        }
      }

      
      /* Set default host font-size to 10 pixels.
       * In that case 1em = 10 pixels = 1% of 100x100 matrix used
       */
      @media screen and (min-width: 467px) {
        :host {
        font-size: ${FONT_SIZE}px;
        }
      }
      @media screen and (max-width: 466px) {
        :host {
        font-size: ${FONT_SIZE}px;
        }
      }

      :host ha-card {
            padding: 0px 0px 0px 0px;
      }

      .container {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .labelContainer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 65%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
      }

      .ellipsis {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }

      .state {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        max-width: 100%;
        min-width: 0px;
      }

      #label {
        display: flex;
        line-height: 1;
      }

      #label.bold {
        font-weight: bold;
      }

      #label, #name {
        margin: 3% 0;
      }

      .shadow {
        font-size: 30px;
        font-weight: 700;
        text-anchor: middle;
      }

      .card--dropshadow-5 {
        filter: drop-shadow(0 1px 0 #ccc)
               drop-shadow(0 2px 0 #c9c9c9)
               drop-shadow(0 3px 0 #bbb)
               drop-shadow(0 4px 0 #b9b9b9)
               drop-shadow(0 5px 0 #aaa)
               drop-shadow(0 6px 1px rgba(0,0,0,.1))
               drop-shadow(0 0 5px rgba(0,0,0,.1))
               drop-shadow(0 1px 3px rgba(0,0,0,.3))
               drop-shadow(0 3px 5px rgba(0,0,0,.2))
               drop-shadow(0 5px 10px rgba(0,0,0,.25))
               drop-shadow(0 10px 10px rgba(0,0,0,.2))
               drop-shadow(0 20px 20px rgba(0,0,0,.15));
      }
      .card--dropshadow-medium--opaque--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-heavy--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.3em 0.45em rgba(0,0,0,0.5))
                drop-shadow(0px 0.6em 0.07em rgba(0,0,0,0.3))
                drop-shadow(0px 1.2em 1.25em rgba(0,0,0,1))
                drop-shadow(0px 1.8em 1.6em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.0em rgba(0,0,0,0.1))
                drop-shadow(0px 3.0em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-heavy {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f22)
                drop-shadow(0.0em 0.07em 0px #b2a98f55)
                drop-shadow(0.0em 0.10em 0px #b2a98f88)
                drop-shadow(0px 0.3em 0.45em rgba(0,0,0,0.5))
                drop-shadow(0px 0.6em 0.07em rgba(0,0,0,0.3))
                drop-shadow(0px 1.2em 1.25em rgba(0,0,0,1))
                drop-shadow(0px 1.8em 1.6em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.0em rgba(0,0,0,0.1))
                drop-shadow(0px 3.0em 2.5em rgba(0,0,0,0.1));
      }

      .card--dropshadow-medium--sepia90 {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1))
                sepia(90%);
      }

      .card--dropshadow-medium {
        filter: drop-shadow(0.0em 0.05em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0.0em 0.15em 0px #b2a98f)
                drop-shadow(0px 0.6em 0.9em rgba(0,0,0,0.15))
                drop-shadow(0px 1.2em 0.15em rgba(0,0,0,0.1))
                drop-shadow(0px 2.4em 2.5em rgba(0,0,0,0.1));
      }

      .card--dropshadow-light--sepia90 {
        filter: drop-shadow(0px 0.10em 0px #b2a98f)
                drop-shadow(0.1em 0.5em 0.2em rgba(0, 0, 0, .5))
                sepia(90%);
      }

      .card--dropshadow-light {
        filter: drop-shadow(0px 0.10em 0px #b2a98f)
                drop-shadow(0.1em 0.5em 0.2em rgba(0, 0, 0, .5));
      }

      .card--dropshadow-down-and-distant {
        filter: drop-shadow(0px 0.05em 0px #b2a98f)
                drop-shadow(0px 14px 10px rgba(0,0,0,0.15))
                drop-shadow(0px 24px 2px rgba(0,0,0,0.1))
                drop-shadow(0px 34px 30px rgba(0,0,0,0.1));
      }
      
      .card--filter-none {
      }

      .horseshoe__svg__group {
        transform: translateY(15%);
      }

    `}static getUserStyles(){return this.userContent="",SwissArmyKnifeCard.lovelace.config.sak_user_templates&&SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_css_definitions&&(this.userContent=SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_css_definitions.reduce((e,t)=>e+t.content,"")),css`${unsafeCSS(this.userContent)}`}static getSakStyles(){return this.sakContent="",SwissArmyKnifeCard.lovelace.config.sak_sys_templates&&SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_css_definitions&&(this.sakContent=SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_css_definitions.reduce((e,t)=>e+t.content,"")),css`${unsafeCSS(this.sakContent)}`}static getSakSvgDefinitions(){SwissArmyKnifeCard.lovelace.sakSvgContent=null;let e="";SwissArmyKnifeCard.lovelace.config.sak_sys_templates&&SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_svg_definitions&&(e=SwissArmyKnifeCard.lovelace.config.sak_sys_templates.definitions.sak_svg_definitions.reduce((e,t)=>e+t.content,"")),SwissArmyKnifeCard.sakSvgContent=unsafeSVG(e)}static getUserSvgDefinitions(){SwissArmyKnifeCard.lovelace.userSvgContent=null;let e="";SwissArmyKnifeCard.lovelace.config.sak_user_templates&&SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_svg_definitions&&(e=SwissArmyKnifeCard.lovelace.config.sak_user_templates.definitions.user_svg_definitions.reduce((e,t)=>e+t.content,"")),SwissArmyKnifeCard.userSvgContent=unsafeSVG(e)}static get styles(){if(SwissArmyKnifeCard.lovelace||(SwissArmyKnifeCard.lovelace=Utils.getLovelace()),!SwissArmyKnifeCard.lovelace)throw console.error("SAK - Can't get reference to Lovelace"),Error("card::get styles - Can't get Lovelace panel");if(SwissArmyKnifeCard.lovelace.config.sak_sys_templates)return SwissArmyKnifeCard.lovelace.config.sak_user_templates||console.warning(version," - SAK - User Templates reference NOT defined. Did you NOT include them?"),SwissArmyKnifeCard.getSakSvgDefinitions(),SwissArmyKnifeCard.getUserSvgDefinitions(),css`
      ${SwissArmyKnifeCard.getSystemStyles()}
      ${SwissArmyKnifeCard.getSakStyles()}
      ${SwissArmyKnifeCard.getUserStyles()}
    `;throw console.error(version," - SAK - System Templates reference NOT defined."),Error(version," - card::get styles - System Templates reference NOT defined!")}set hass(s){var e,t,i;if(this.counter||(this.counter=0),this.counter+=1,this.theme.modeChanged=s.themes.darkMode!==this.theme.darkMode,this.theme.modeChanged&&(this.theme.darkMode=s.themes.darkMode,Colors.colorCache={}),this.theme.checked||(this.theme.checked=!0,this.config.theme&&s.themes.themes[this.config.theme]&&({themeLight:e,themeDark:t}=Colors.processTheme(s.themes.themes[this.config.theme]),this.theme.light=e,this.theme.dark=t,this.theme.isLoaded=!0),this.styles.card.light={...this.styles.card.default,...this.theme.light,...this.palette.light},this.styles.card.dark={...this.styles.card.default,...this.theme.dark,...this.palette.dark}),this.dev.debug&&console.log("*****Event - card::set hass",this.cardId,(new Date).getTime()),this._hass=s,this.connected||this.dev.debug&&console.log("set hass but NOT connected",this.cardId),this.config.entities){let r=!1,e,a=0,t=!1;let o=!1,n;var d;for(e of this.config.entities){if(this.entities[a]=s.states[this.config.entities[a].entity],(d=void 0===this.entities[a])&&console.error("SAK - set hass, entity undefined: ",this.config.entities[a].entity),this.config.entities[a].secondary_info&&(t=!0,i=d?void 0:this.entities[a][this.config.entities[a].secondary_info],(i=this._buildStateString(i,this.config.entities[a]))!==this.secondaryInfoStr[a])&&(this.secondaryInfoStr[a]=i,r=!0),this.config.entities[a].icon||(i=d?void 0:s.states[this.config.entities[a].entity].attributes.icon)!==this.iconStr[a]&&(this.iconStr[a]=i,r=!0),this.config.entities[a].attribute){let e=this.config.entities[a].attribute,t="",s="";var l,h=this.config.entities[a].attribute.indexOf("["),c=this.config.entities[a].attribute.indexOf(".");let i="";-1!==h?(e=this.config.entities[a].attribute.substr(0,h),l=(t=this.config.entities[a].attribute.substr(h,this.config.entities[a].attribute.length-h))[1],i=t.substr(4,t.length-4),s=this.entities[a].attributes[e][l][i]):-1!==c?(e=this.config.entities[a].attribute.substr(0,c),t=this.config.entities[a].attribute.substr(h,this.config.entities[a].attribute.length-h),i=t.substr(1,t.length-1),s=this.entities[a].attributes[e][i],console.log("set hass, attributes with map",this.config.entities[a].attribute,e,t)):s=this.entities[a].attributes[e],(n=this._buildStateString(s,this.config.entities[a]))!==this.attributesStr[a]&&(this.attributesStr[a]=n,r=!0),o=!0}o||t||((n=d?void 0:this._buildStateString(this.entities[a].state,this.config.entities[a]))!==this.entitiesStr[a]&&(this.entitiesStr[a]=n,r=!0),this.dev.debug&&console.log("set hass - attrSet=false",this.cardId,(new Date).getSeconds().toString()+"."+(new Date).getMilliseconds().toString(),n)),r||=o||t,a+=1,o=!1,t=!1}(r||this.theme.modeChanged)&&(this.toolsets&&this.toolsets.map(e=>(e.updateValues(),!0)),this.requestUpdate(),this.theme.modeChanged=!1,--this.counter)}}setConfig(g){if(this.dev.performance&&console.time(`--> ${this.cardId} PERFORMANCE card::setConfig`),this.dev.debug&&console.log("*****Event - setConfig",this.cardId,(new Date).getTime()),(g=JSON.parse(JSON.stringify(g))).dev&&(this.dev={...this.dev,...g.dev}),this.dev.debug&&console.log("setConfig",this.cardId),!g.layout)throw Error("card::setConfig - No layout defined");if(g.entities){var p=computeDomain(g.entities[0].entity);if("sensor"!==p&&g.entities[0].attribute&&!isNaN(g.entities[0].attribute))throw Error("card::setConfig - First entity or attribute must be a numbered sensorvalue, but is NOT")}p=Merge.mergeDeep(g);this.config=p,this.toolset=[];let i=this;function d(e,t){var s;return t?.template?((s=i.lovelace.config.sak_user_templates.templates[t.template.name])||console.error("Template not found...",t.template,s),s=Templates.replaceVariables3(t.template.variables,s),Merge.mergeDeep(s)):("template"===e&&console.log("findTemplate return key=template/value",e,void 0),t)}g=JSON.stringify(this.config,d);this.config.palette&&(this.config.palette=JSON.parse(g).palette,{paletteLight:p,paletteDark:_}=Colors.processPalette(this.config.palette),this.palette.light=p,this.palette.dark=_);let l=JSON.parse(g).layout.toolsets;if(this.config.layout.template&&(this.config.layout=JSON.parse(g).layout),this.config.layout.toolsets.map((a,o)=>{let n=null;this.toolsets||(this.toolsets=[]);{let r=!1,e=[];n=l[o].tools,a.tools&&a.tools.map((s,i)=>(l[o].tools.map((e,t)=>(s.id===e.id&&(a.template&&(this.config.layout.toolsets[o].position&&(l[o].position=Merge.mergeDeep(this.config.layout.toolsets[o].position)),n[t]=Merge.mergeDeep(n[t],s),n[t]=JSON.parse(JSON.stringify(n[t],d)),r=!0),this.dev.debug)&&console.log("card::setConfig - got toolsetCfg toolid",s,i,e,t,s),l[o].tools[t]=Templates.getJsTemplateOrValueConfig(l[o].tools[t],this.config.entities,Merge.mergeDeep(l[o].tools[t])),r)),r||(e=e.concat(a.tools[i])),r)),n=n.concat(e)}a=l[o];var e=new Toolset(this,a);return this.toolsets.push(e),!0}),this.dev.m3&&(console.log("*** M3 - Checking for m3.yaml template to convert..."),this.lovelace.config.sak_user_templates.templates.m3)){p=this.lovelace.config.sak_user_templates.templates.m3;console.log("*** M3 - Found. Material 3 conversion starting...");let t="",s="",i="",r="",a="",o="",n="",d="",l="",h="",c={};var f,u,m={},b={};p.entities.map(e=>(["ref.palette","sys.color","sys.color.light","sys.color.dark"].includes(e.category_id)&&!e.tags.includes("alias")&&(c[e.id]={value:e.value,tags:e.tags}),"ref.palette"===e.category_id&&(t+=e.id+`: '${e.value}'
`,"md.ref.palette.primary40"===e.id&&(o=e.value),"md.ref.palette.primary80"===e.id&&(l=e.value),"md.ref.palette.neutral40"===e.id&&(n=e.value),"md.ref.palette.neutral80"===e.id)&&(h=e.value),"sys.color"===e.category_id&&(s+=e.id+`: '${e.value}'
`),"sys.color.light"===e.category_id&&(i+=e.id+`: '${e.value}'
`,"md.sys.color.surface.light"===e.id)&&(a=e.value),"sys.color.dark"===e.category_id&&(r+=e.id+`: '${e.value}'
`,"md.sys.color.surface.dark"===e.id)&&(d=e.value),!0)),["primary","secondary","tertiary","error","neutral","neutral-variant"].forEach(t=>{[5,15,25,35,45,65,75,85].forEach(e=>{c["md.ref.palette."+t+e.toString()]={value:Colors.getGradientValue(c["md.ref.palette."+t+(e-5).toString()].value,c["md.ref.palette."+t+(e+5).toString()].value,.5),tags:[...c["md.ref.palette."+t+(e-5).toString()].tags]},c["md.ref.palette."+t+e.toString()].tags[3]=t+e.toString()}),c[`md.ref.palette.${t}7`]={value:Colors.getGradientValue(c[`md.ref.palette.${t}5`].value,c[`md.ref.palette.${t}10`].value,.5),tags:[...c[`md.ref.palette.${t}10`].tags]},c[`md.ref.palette.${t}7`].tags[3]=t+"7",c[`md.ref.palette.${t}92`]={value:Colors.getGradientValue(c[`md.ref.palette.${t}90`].value,c[`md.ref.palette.${t}95`].value,.5),tags:[...c[`md.ref.palette.${t}90`].tags]},c[`md.ref.palette.${t}92`].tags[3]=t+"92",c[`md.ref.palette.${t}97`]={value:Colors.getGradientValue(c[`md.ref.palette.${t}95`].value,c[`md.ref.palette.${t}99`].value,.5),tags:[...c[`md.ref.palette.${t}90`].tags]},c[`md.ref.palette.${t}97`].tags[3]=t+"97"});for([f,u]of Object.entries(c))m[f]=`theme-${u.tags[1]}-${u.tags[2]}-${u.tags[3]}: rgb(${v(u.value)})`,b[f]=`theme-${u.tags[1]}-${u.tags[2]}-${u.tags[3]}-rgb: `+v(u.value);function v(e){var t={},e=(t.r=Math.round(parseInt(e.substr(1,2),16)),t.g=Math.round(parseInt(e.substr(3,2),16)),t.b=Math.round(parseInt(e.substr(5,2),16)),t.r+`,${t.g},`+t.b);return e}function y(e,t,s,i,r){let a={},o={},n=(a.r=Math.round(parseInt(e.substr(1,2),16)),a.g=Math.round(parseInt(e.substr(3,2),16)),a.b=Math.round(parseInt(e.substr(5,2),16)),o.r=Math.round(parseInt(t.substr(1,2),16)),o.g=Math.round(parseInt(t.substr(3,2),16)),o.b=Math.round(parseInt(t.substr(5,2),16)),""),d,l,h;return s.forEach((e,t)=>{d=Math.round(e*o.r+(1-e)*a.r),l=Math.round(e*o.g+(1-e)*a.g),h=Math.round(e*o.b+(1-e)*a.b),n=(n+=`${i+(t+1).toString()}-${r}: rgb(${d},${l},${h})\n`)+`${i+(t+1).toString()}-${r}-rgb: ${d},${l},${h}\n`}),n}var w,S,_=[.03,.05,.08,.11,.15,.19,.24,.29,.35,.4],g=[.05,.08,.11,.15,.19,.24,.29,.35,.4,.45],p=y(a,n,_,"  theme-ref-elevation-surface-neutral","light"),x=c["md.ref.palette.neutral-variant40"].value,x=y(a,x,_,"  theme-ref-elevation-surface-neutral-variant","light"),k=y(a,o,_,"  theme-ref-elevation-surface-primary","light"),C=c["md.ref.palette.secondary40"].value,C=y(a,C,_,"  theme-ref-elevation-surface-secondary","light"),$=c["md.ref.palette.tertiary40"].value,$=y(a,$,_,"  theme-ref-elevation-surface-tertiary","light"),I=c["md.ref.palette.error40"].value,I=y(a,I,_,"  theme-ref-elevation-surface-error","light"),_=y(d,h,g,"  theme-ref-elevation-surface-neutral","dark"),M=c["md.ref.palette.neutral-variant80"].value,M=y(d,M,g,"  theme-ref-elevation-surface-neutral-variant","dark"),A=y(d,l,g,"  theme-ref-elevation-surface-primary","dark"),E=c["md.ref.palette.secondary80"].value,E=y(d,E,g,"  theme-ref-elevation-surface-secondary","dark"),D=c["md.ref.palette.tertiary80"].value,D=y(d,D,g,"  theme-ref-elevation-surface-tertiary","dark"),N=c["md.ref.palette.error80"].value,N=y(d,N,g,"  theme-ref-elevation-surface-error","dark");let e="";for([w,S]of Object.entries(m))"theme-ref"===S.substring(0,9)&&(e=(e+=`  ${S}
`)+`  ${b[w]}
`);console.log(p+x+k+C+$+I+_+M+A+E+D+N+e),console.log("*** M3 - Material 3 conversion DONE. You should copy the above output...")}this.aspectratio=(this.config.layout.aspectratio||this.config.aspectratio||"1/1").trim();g=this.aspectratio.split("/");this.viewBox||(this.viewBox={}),this.viewBox.width=g[0]*SVG_DEFAULT_DIMENSIONS,this.viewBox.height=g[1]*SVG_DEFAULT_DIMENSIONS,this.config.layout.styles?.card&&(this.styles.card.default=this.config.layout.styles.card),this.dev.debug&&console.log("Step 5: toolconfig, list of toolsets",this.toolsets),this.dev.debug&&console.log("debug - setConfig",this.cardId,this.config),this.dev.performance&&console.timeEnd(`--> ${this.cardId} PERFORMANCE card::setConfig`),this.configIsSet=!0}connectedCallback(){this.dev.performance&&console.time(`--> ${this.cardId} PERFORMANCE card::connectedCallback`),this.dev.debug&&console.log("*****Event - connectedCallback",this.cardId,(new Date).getTime()),this.connected=!0,super.connectedCallback(),this.entityHistory.update_interval&&(this.updateOnInterval(),clearInterval(this.interval),this.interval=setInterval(()=>this.updateOnInterval(),this._hass?1e3*this.entityHistory.update_interval:100)),this.dev.debug&&console.log("ConnectedCallback",this.cardId),this.requestUpdate(),this.dev.performance&&console.timeEnd(`--> ${this.cardId} PERFORMANCE card::connectedCallback`)}disconnectedCallback(){this.dev.performance&&console.time(`--> ${this.cardId} PERFORMANCE card::disconnectedCallback`),this.dev.debug&&console.log("*****Event - disconnectedCallback",this.cardId,(new Date).getTime()),this.interval&&(clearInterval(this.interval),this.interval=0),super.disconnectedCallback(),this.dev.debug&&console.log("disconnectedCallback",this.cardId),this.connected=!1,this.dev.performance&&console.timeEnd(`--> ${this.cardId} PERFORMANCE card::disconnectedCallback`)}firstUpdated(t){this.dev.debug&&console.log("*****Event - card::firstUpdated",this.cardId,(new Date).getTime()),this.toolsets&&this.toolsets.map(async e=>(e.firstUpdated(t),!0))}updated(t){this.dev.debug&&console.log("*****Event - Updated",this.cardId,(new Date).getTime()),this.toolsets&&this.toolsets.map(async e=>(e.updated(t),!0))}render(){if(this.dev.performance&&console.time(`--> ${this.cardId} PERFORMANCE card::render`),this.dev.debug&&console.log("*****Event - render",this.cardId,(new Date).getTime()),this.connected){let e;try{e=this.config.disable_card?html`
                  <div class="container" id="container">
                    ${this._renderSvg()}
                  </div>
                  `:html`
                  <ha-card style="${styleMap(this.styles.card.default)}">
                    <div class="container" id="container" 
                    >
                      ${this._renderSvg()}
                    </div>
                  </ha-card>
                  `}catch(e){console.error(e)}return this.dev.performance&&console.timeEnd(`--> ${this.cardId} PERFORMANCE card::render`),e}this.dev.debug&&console.log("render but NOT connected",this.cardId,(new Date).getTime())}_renderSakSvgDefinitions(){return svg`
    ${SwissArmyKnifeCard.sakSvgContent}
    `}_renderUserSvgDefinitions(){return svg`
    ${SwissArmyKnifeCard.userSvgContent}
    `}themeIsDarkMode(){return!0===this.theme.darkMode}themeIsLightMode(){return!1===this.theme.darkMode}_RenderToolsets(){return this.dev.debug&&console.log("all the tools in renderTools",this.tools),svg`
      <g id="toolsets" class="toolsets__group"
      >
        ${this.toolsets.map(e=>e.render())}
      </g>

      <defs>
        ${this._renderSakSvgDefinitions()}
        ${this._renderUserSvgDefinitions()}
      </defs>
    `}_renderCardAttributes(){var t,s=[];this._attributes="";for(let e=0;e<this.entities.length;e++)t=this.attributesStr[e]||this.secondaryInfoStr[e]||this.entitiesStr[e],s.push(t);return this._attributes=s}_renderSvg(){var e=this.config.card_filter||"card--filter-none",t=[],s=(this._renderCardAttributes(),this._RenderToolsets());return t.push(svg`
      <!-- SAK Card SVG Render -->
      <svg id="rootsvg" xmlns="http://www/w3.org/2000/svg" xmlns:xlink="http://www/w3.org/1999/xlink"
       class="${e}"
       style="${styleMap(this.themeIsDarkMode()?this.styles.card.dark:this.styles.card.light)}"
       data-entity-0="${this._attributes[0]}"
       data-entity-1="${ifDefined(this._attributes[1])}"
       data-entity-2="${ifDefined(this._attributes[2])}"
       data-entity-3="${ifDefined(this._attributes[3])}"
       data-entity-4="${ifDefined(this._attributes[4])}"
       data-entity-5="${ifDefined(this._attributes[5])}"
       data-entity-6="${ifDefined(this._attributes[6])}"
       data-entity-7="${ifDefined(this._attributes[7])}"
       data-entity-8="${ifDefined(this._attributes[8])}"
       data-entity-9="${ifDefined(this._attributes[9])}"
       viewBox="0 0 ${this.viewBox.width} ${this.viewBox.height}"
      >
        <g style="${styleMap(this.config.layout?.styles?.toolsets)}">
          ${s}
        </g>
      </svg>`),svg`${t}`}_buildUom(e,t,s){return e?.unit||s?.unit||t?.attributes.unit_of_measurement||""}toLocale(e,t="unknown"){var s=this._hass.selectedLanguage||this._hass.language,s=this._hass.resources[s];return s&&s[e]?s[e]:t}_buildStateString(s,i){if(void 0===s)return s;if(i.convert){var r=i.convert.match(/(^\w+)\((\d+)\)/);let e,t;switch(null===r?e=i.convert:3===r.length&&(e=r[1],t=Number(r[2])),e){case"brightness_pct":s="undefined"===s?"undefined":""+Math.round(s/255*100);break;case"multiply":s=""+Math.round(s*t);break;case"divide":s=""+Math.round(s/t);break;case"rgb_csv":case"rgb_hex":if(i.attribute){var a,o=this._hass.states[i.entity];switch(o.attributes.color_mode){case"unknown":case"onoff":case"brightness":break;case"color_temp":s=o.attributes.color_temp_kelvin?(d=temperature2rgb(o.attributes.color_temp_kelvin),(n=rgb2hsv(d))[1]<.4&&(n[1]<.1?n[2]=225:n[1]=.4),(d=hsv2rgb(n))[0]=Math.round(d[0]),d[1]=Math.round(d[1]),d[2]=Math.round(d[2]),"rgb_csv"===e?`${d[0]},${d[1]},`+d[2]:rgb2hex(d)):"rgb_csv"===e?"255,255,255":"#ffffff00";break;case"hs":var n=hs2rgb([o.attributes.hs_color[0],o.attributes.hs_color[1]/100]);n[0]=Math.round(n[0]),n[1]=Math.round(n[1]),n[2]=Math.round(n[2]),s="rgb_csv"===e?`${n[0]},${n[1]},`+n[2]:rgb2hex(n);break;case"rgb":var d=rgb2hsv(this.stateObj.attributes.rgb_color),n=(d[1]<.4&&(d[1]<.1?d[2]=225:d[1]=.4),hsv2rgb(d));s="rgb_csv"===e?n.toString():rgb2hex(n);break;case"rgbw":var d=rgbw2rgb(o.attributes.rgbw_color);d[0]=Math.round(d[0]),d[1]=Math.round(d[1]),d[2]=Math.round(d[2]),s="rgb_csv"===e?`${d[0]},${d[1]},`+d[2]:rgb2hex(d);break;case"rgbww":var n=rgbww2rgb(o.attributes.rgbww_color,o.attributes?.min_color_temp_kelvin,o.attributes?.max_color_temp_kelvin);n[0]=Math.round(n[0]),n[1]=Math.round(n[1]),n[2]=Math.round(n[2]),s="rgb_csv"===e?`${n[0]},${n[1]},`+n[2]:rgb2hex(n);break;case"white":break;case"xy":o.attributes.hs_color?(d=hs2rgb([o.attributes.hs_color[0],o.attributes.hs_color[1]/100]),(n=rgb2hsv(d))[1]<.4&&(n[1]<.1?n[2]=225:n[1]=.4),(d=hsv2rgb(n))[0]=Math.round(d[0]),d[1]=Math.round(d[1]),d[2]=Math.round(d[2]),s="rgb_csv"===e?`${d[0]},${d[1]},`+d[2]:rgb2hex(d)):o.attributes.color?({r:d,g:n,b:a}=((n={}).l=o.attributes.brightness,n.h=o.attributes.color.h||o.attributes.color.hue,n.s=o.attributes.color.s||o.attributes.color.saturation,Colors.hslToRgb(n)),s="rgb_csv"===e?d+`,${n},`+a:"#"+Colors.padZero(d.toString(16))+Colors.padZero(n.toString(16))+Colors.padZero(a.toString(16))):o.attributes.xy_color}}break;default:console.error(`Unknown converter [${e}] specified for entity [${i.entity}]!`)}}return void 0!==s?Number.isNaN(s)?s:s.toString():void 0}_computeEntity(e){return e.substr(e.indexOf(".")+1)}updateOnInterval(){this._hass?(this.updateData(),this.entityHistory.needed?(window.clearInterval(this.interval),this.interval=setInterval(()=>this.updateOnInterval(),1e3*this.entityHistory.update_interval)):this.interval&&(window.clearInterval(this.interval),this.interval=0)):this.dev.debug&&console.log("UpdateOnInterval - NO hass, returning")}async fetchRecent(e,t,s,i){let r="history/period";return t&&(r+="/"+t.toISOString()),r+="?filter_entity_id="+e,s&&(r+="&end_time="+s.toISOString()),i&&(r+="&skip_initial_state"),r+="&minimal_response",this._hass.callApi("GET",r)}async updateData(){this.entityHistory.updating=!0,this.dev.debug&&console.log("card::updateData - ENTRY",this.cardId);let o=[],n=0;this.toolsets.map((e,a)=>(e.tools.map((e,t)=>{if("bar"===e.type||"sparkline"===e.type){if("real_time"===e.tool.config?.period?.type)return!0;var s=new Date,i=new Date,r=("day"===e.tool.config.period?.calendar?.period?(i.setHours(0,0,0,0),i.setHours(i.getHours()+24*e.tool.config.period.calendar.offset),0!==e.tool.config.period.calendar.offset&&s.setHours(0,0,0,0)):i.setHours(s.getHours()-(e.tool.config.period?.rolling_window?.duration?.hour||e.tool.config.hours)),this.config.entities[e.tool.config.entity_index].attribute||null);o[n]={tsidx:a,entityIndex:e.tool.config.entity_index,entityId:this.entities[e.tool.config.entity_index].entity_id,attrId:r,start:i,end:s,type:e.type,idx:t},n+=1}return!0}),!0)),this.dev.debug&&console.log("card::updateData - LENGTH",this.cardId,o.length,o),this.stateChanged=!1,this.dev.debug&&console.log("card::updateData, entityList from tools",o);try{var e=o.map((e,t)=>this.updateEntity(e,t,e.start,e.end));await Promise.all(e)}finally{this.entityHistory.updating=!1}this.entityHistory.updating=!1}async updateEntity(t,e,s,i){var r=[];let a=await this.fetchRecent(t.entityId,s,i,!1);"sparkline"===t.type&&this.toolsets[t.tsidx].tools[t.idx].tool.processStateMap(a),a[0]&&0<a[0].length&&(t.attrId&&(s=this.entities[t.entityIndex].attributes[this.config.entities[t.entityIndex].attribute],t.state=s),a=(a=a[0].filter(e=>t.attrId?!isNaN(parseFloat(e.attributes[t.attrId])):!isNaN(parseFloat(e.state)))).map(e=>({last_changed:e.last_changed,state:t.attrId?Number(e.attributes[t.attrId]):Number(e.state)}))),r=[...r,...a],"sparkline"===t.type?(this.toolsets[t.tsidx].tools[t.idx].tool.data=t.entityIndex,this.toolsets[t.tsidx].tools[t.idx].tool.series=[...r],this.requestUpdate()):this.uppdate(t,r)}uppdate(e,t){if(t){let i=(new Date).getTime(),r=24,a=2;"bar"!==e.type&&"sparkline"!==e.type||(this.dev.debug&&console.log("entity.type == bar",e),r=this.toolsets[e.tsidx].tools[e.idx].tool.config.hours,a=this.toolsets[e.tsidx].tools[e.idx].tool.config.barhours);var s=t.reduce((e,t)=>{return e=e,t=t,s=(i-new Date(t.last_changed).getTime())/36e5/a-r/a,s=Math.floor(Math.abs(s)),e[s]||(e[s]=[]),e[s].push(t),e;var s},[]);if(s.length=Math.ceil(r/a),0!==Object.keys(s).length){t=Object.keys(s)[0];"0"!==t&&(s[0]=[],s[0].push(s[t][0]));for(let e=0;e<r/a;e++)s[e]||(s[e]=[],s[e].push(s[e-1][s[e-1].length-1]));t=(this.coords=s).map(e=>{return s="state",(e=e).reduce((e,t)=>e+Number(t[s]),0)/e.length;var s}),["bar"].includes(e.type)&&(this.toolsets[e.tsidx].tools[e.idx].tool.series=[...t]),this.requestUpdate()}}}getCardSize(){return 4}}customElements.define("swiss-army-knife-card",SwissArmyKnifeCard);