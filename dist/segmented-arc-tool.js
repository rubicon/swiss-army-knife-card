import{svg}from"lit-element";import{classMap}from"lit-html/directives/class-map.js";import{styleMap}from"lit-html/directives/style-map.js";import Merge from"./merge";import BaseTool from"./base-tool";import Utils from"./utils";export default class SegmentedArcTool extends BaseTool{constructor(s,t,e){super(s,Merge.mergeDeep({position:{cx:50,cy:50,radius:45,width:3,margin:1.5},color:"var(--primary-color)",classes:{tool:{},foreground:{},background:{}},styles:{foreground:{},background:{}},segments:{},colorstops:[],scale:{min:0,max:100,width:2,offset:-3.5},show:{style:"fixedcolor",scale:!1},isScale:!1,animation:{duration:1.5}},t),e),this.dev.performance&&console.time(`--> ${this.toolId} PERFORMANCE SegmentedArcTool::constructor`),this.svg.radius=Utils.calculateSvgDimension(t.position.radius),this.svg.radiusX=Utils.calculateSvgDimension(t.position.radius_x||t.position.radius),this.svg.radiusY=Utils.calculateSvgDimension(t.position.radius_y||t.position.radius),this.svg.segments={},this.svg.segments.gap=Utils.calculateSvgDimension(this.config.segments.gap),this.svg.scale_offset=Utils.calculateSvgDimension(this.config.scale.offset),this._firstUpdatedCalled=!1,this._stateValue=null,this._stateValuePrev=null,this._stateValueIsDirty=!1,this._renderFrom=null,this._renderTo=null,this.rAFid=null,this.cancelAnimation=!1,this.arcId=null,this._cache=[],this._segmentAngles=[],this._segments={},this._arc={},this._arc.size=Math.abs(this.config.position.end_angle-this.config.position.start_angle),this._arc.clockwise=this.config.position.end_angle>this.config.position.start_angle,this._arc.direction=this._arc.clockwise?1:-1;if(this.config.segments.colorlist?.template&&(s=this.config.segments.colorlist,this._card.lovelace.config.sak_user_templates.templates[s.template.name])&&(this.dev.debug&&console.log("SegmentedArcTool::constructor - templates colorlist found",s.template.name),t=Templates.replaceVariables2(s.template.variables,this._card.lovelace.config.sak_user_templates.templates[s.template.name]),this.config.segments.colorlist=t),"fixedcolor"!==this.config.show.style)if("colorlist"===this.config.show.style){this._segments.count=this.config.segments.colorlist.colors.length,this._segments.size=this._arc.size/this._segments.count,this._segments.gap="undefined"!==this.config.segments.colorlist.gap?this.config.segments.colorlist.gap:1,this._segments.sizeList=[];for(var i=0;i<this._segments.count;i++)this._segments.sizeList[i]=this._segments.size;for(var o=0,i=0;i<this._segments.count;i++)this._segmentAngles[i]={boundsStart:this.config.position.start_angle+o*this._arc.direction,boundsEnd:this.config.position.start_angle+(o+this._segments.sizeList[i])*this._arc.direction,drawStart:this.config.position.start_angle+o*this._arc.direction+this._segments.gap*this._arc.direction,drawEnd:this.config.position.start_angle+(o+this._segments.sizeList[i])*this._arc.direction-this._segments.gap*this._arc.direction},o+=this._segments.sizeList[i];this.dev.debug&&console.log("colorstuff - COLORLIST",this._segments,this._segmentAngles)}else if("colorstops"===this.config.show.style){this._segments.colorStops={},Object.keys(this.config.segments.colorstops.colors).forEach(s=>{s>=this.config.scale.min&&s<=this.config.scale.max&&(this._segments.colorStops[s]=this.config.segments.colorstops.colors[s])}),this._segments.sortedStops=Object.keys(this._segments.colorStops).map(s=>Number(s)).sort((s,t)=>s-t),void 0===this._segments.colorStops[this.config.scale.max]&&(this._segments.colorStops[this.config.scale.max]=this._segments.colorStops[this._segments.sortedStops[this._segments.sortedStops.length-1]],this._segments.sortedStops=Object.keys(this._segments.colorStops).map(s=>Number(s)).sort((s,t)=>s-t)),this._segments.count=this._segments.sortedStops.length-1,this._segments.gap="undefined"!==this.config.segments.colorstops.gap?this.config.segments.colorstops.gap:1;let s=this.config.scale.min;var n=this.config.scale.max-this.config.scale.min;this._segments.sizeList=[];for(i=0;i<this._segments.count;i++){var r=this._segments.sortedStops[i+1]-s,r=(s+=r,r/n),r=r*this._arc.size;this._segments.sizeList[i]=r}for(o=0,i=0;i<this._segments.count;i++)this._segmentAngles[i]={boundsStart:this.config.position.start_angle+o*this._arc.direction,boundsEnd:this.config.position.start_angle+(o+this._segments.sizeList[i])*this._arc.direction,drawStart:this.config.position.start_angle+o*this._arc.direction+this._segments.gap*this._arc.direction,drawEnd:this.config.position.start_angle+(o+this._segments.sizeList[i])*this._arc.direction-this._segments.gap*this._arc.direction},o+=this._segments.sizeList[i],this.dev.debug&&console.log("colorstuff - COLORSTOPS++ segments",o,this._segmentAngles[i]);this.dev.debug&&console.log("colorstuff - COLORSTOPS++",this._segments,this._segmentAngles,this._arc.direction,this._segments.count)}else this.config.show.style;if(this.config.isScale?this._stateValue=this.config.scale.max:this.config.show.scale?((s=Merge.mergeDeep(this.config)).id+="-scale",s.show.scale=!1,s.isScale=!0,s.position.width=this.config.scale.width,s.position.radius=this.config.position.radius-this.config.position.width/2+s.position.width/2+this.config.scale.offset,s.position.radius_x=(this.config.position.radius_x||this.config.position.radius)-this.config.position.width/2+s.position.width/2+this.config.scale.offset,s.position.radius_y=(this.config.position.radius_y||this.config.position.radius)-this.config.position.width/2+s.position.width/2+this.config.scale.offset,this._segmentedArcScale=new SegmentedArcTool(this,s,e)):this._segmentedArcScale=null,this.skipOriginal="colorstops"===this.config.show.style||"colorlist"===this.config.show.style,this.skipOriginal&&(this.config.isScale&&(this._stateValuePrev=this._stateValue),this._initialDraw=!1),this._arc.parts=Math.floor(this._arc.size/Math.abs(this.config.segments.dash)),this._arc.partsPartialSize=this._arc.size-this._arc.parts*this.config.segments.dash,this.skipOriginal)this._arc.parts=this._segmentAngles.length,this._arc.partsPartialSize=0;else{for(i=0;i<this._arc.parts;i++)this._segmentAngles[i]={boundsStart:this.config.position.start_angle+i*this.config.segments.dash*this._arc.direction,boundsEnd:this.config.position.start_angle+(i+1)*this.config.segments.dash*this._arc.direction,drawStart:this.config.position.start_angle+i*this.config.segments.dash*this._arc.direction+this.config.segments.gap*this._arc.direction,drawEnd:this.config.position.start_angle+(i+1)*this.config.segments.dash*this._arc.direction-this.config.segments.gap*this._arc.direction};0<this._arc.partsPartialSize&&(this._segmentAngles[i]={boundsStart:this.config.position.start_angle+i*this.config.segments.dash*this._arc.direction,boundsEnd:this.config.position.start_angle+(i+0)*this.config.segments.dash*this._arc.direction+this._arc.partsPartialSize*this._arc.direction,drawStart:this.config.position.start_angle+i*this.config.segments.dash*this._arc.direction+this.config.segments.gap*this._arc.direction,drawEnd:this.config.position.start_angle+(i+0)*this.config.segments.dash*this._arc.direction+this._arc.partsPartialSize*this._arc.direction-this.config.segments.gap*this._arc.direction})}this.starttime=null,this.dev.debug&&console.log("SegmentedArcTool constructor coords, dimensions",this.coords,this.dimensions,this.svg,this.config),this.dev.debug&&console.log("SegmentedArcTool - init",this.toolId,this.config.isScale,this._segmentAngles),this.dev.performance&&console.timeEnd(`--> ${this.toolId} PERFORMANCE SegmentedArcTool::constructor`)}get objectId(){return this.toolId}set value(s){return this.dev.debug&&console.log("SegmentedArcTool - set value IN"),!this.config.isScale&&this._stateValue!==s&&(super.value=s)}firstUpdated(s){this.dev.debug&&console.log("SegmentedArcTool - firstUpdated IN with _arcId/id",this._arcId,this.toolId,this.config.isScale),this._arcId=this._card.shadowRoot.getElementById("arc-".concat(this.toolId)),this._firstUpdatedCalled=!0,this._segmentedArcScale?.firstUpdated(s),this.skipOriginal&&(this.dev.debug&&console.log("RENDERNEW - firstUpdated IN with _arcId/id/isScale/scale/connected",this._arcId,this.toolId,this.config.isScale,this._segmentedArcScale,this._card.connected),this.config.isScale||(this._stateValuePrev=null),this._initialDraw=!0,this._card.requestUpdate())}updated(s){this.dev.debug&&console.log("SegmentedArcTool - updated IN")}render(){return this.dev.debug&&console.log("SegmentedArcTool RENDERNEW - Render IN"),svg`
      <g "" id="arc-${this.toolId}" class="arc">
        <g >
          ${this._renderSegments()}
          </g>
        ${this._renderScale()}
      </g>
    `}_renderScale(){if(this._segmentedArcScale)return this._segmentedArcScale.render()}_renderSegments(){if(this.skipOriginal){const d=this.svg.width,m=this.svg.radiusX,_=this.svg.radiusY;let h;this.dev.debug&&console.log("RENDERNEW - IN _arcId, firstUpdatedCalled",this._arcId,this._firstUpdatedCalled);var s=Utils.calculateValueBetween(this.config.scale.min,this.config.scale.max,this._stateValue),t=Utils.calculateValueBetween(this.config.scale.min,this.config.scale.max,this._stateValuePrev);!this.dev.debug||this._stateValuePrev||console.log("*****UNDEFINED",this._stateValue,this._stateValuePrev,t),s!==t&&this.dev.debug&&console.log("RENDERNEW _renderSegments diff value old new",this.toolId,t,s),s=s*this._arc.size*this._arc.direction+this.config.position.start_angle,t=t*this._arc.size*this._arc.direction+this.config.position.start_angle;const i=[];if(!this.config.isScale)for(let s=0;s<this._segmentAngles.length;s++)h=this.buildArcPath(this._segmentAngles[s].drawStart,this._segmentAngles[s].drawEnd,this._arc.clockwise,this.svg.radiusX,this.svg.radiusY,this.svg.width),i.push(svg`<path id="arc-segment-bg-${this.toolId}-${s}" class="sak-segarc__background"
                              style="${styleMap(this.config.styles.background)}"
                              d="${h}"
                              />`);if(this._firstUpdatedCalled){this.dev.debug&&console.log("RENDERNEW _arcId DOES exist",this._arcId,this.toolId,this._firstUpdatedCalled),this._cache.forEach((s,t)=>{if(h=s,this.config.isScale){let s=this.config.color;"colorlist"===this.config.show.style&&(s=this.config.segments.colorlist.colors[t]),"colorstops"===this.config.show.style&&(s=this._segments.colorStops[this._segments.sortedStops[t]]),this.styles.foreground[t]||(this.styles.foreground[t]=Merge.mergeDeep(this.config.styles.foreground)),this.styles.foreground[t].fill=s}i.push(svg`<path id="arc-segment-${this.toolId}-${t}" class="sak-segarc__foreground"
                            style="${styleMap(this.styles.foreground[t])}"
                            d="${h}"
                            />`)});const f={};const e=this;!0===this._card.connected&&this._renderTo!==this._stateValue&&(this._renderTo=this._stateValue,this.rAFid&&cancelAnimationFrame(this.rAFid),f.fromAngle=t,f.toAngle=s,f.runningAngle=t,f.duration=Math.min(Math.max(this._initialDraw?100:500,this._initialDraw?16:1e3*this.config.animation.duration),5e3),f.startTime=null,this.dev.debug&&console.log("RENDERNEW - tween",this.toolId,f),this.rAFid=requestAnimationFrame(s=>{!function t(s,e){let i;var s=s||(new Date).getTime(),s=(f.startTime||(f.startTime=s,f.runningAngle=f.fromAngle),e.debug&&console.log("RENDERNEW - in animateSegmentsNEW",e.toolId,f),s-f.startTime),o=(f.progress=Math.min(s/f.duration,1),f.progress=(s=f.progress,(--s)**5+1),e._arc.clockwise?f.toAngle>f.fromAngle:f.fromAngle>f.toAngle);f.frameAngle=f.fromAngle+(f.toAngle-f.fromAngle)*f.progress,-1===e._segmentAngles.findIndex((s,t)=>e._arc.clockwise?f.frameAngle<=s.boundsEnd&&f.frameAngle>=s.boundsStart:f.frameAngle<=s.boundsStart&&f.frameAngle>=s.boundsEnd)&&(console.log("RENDERNEW animateSegments frameAngle not found",f,e._segmentAngles),console.log("config",e.config)),i=e._segmentAngles.findIndex((s,t)=>e._arc.clockwise?f.runningAngle<=s.boundsEnd&&f.runningAngle>=s.boundsStart:f.runningAngle<=s.boundsStart&&f.runningAngle>=s.boundsEnd);do{var n=e._segmentAngles[i].drawStart,r=e._arc.clockwise?Math.min(e._segmentAngles[i].boundsEnd,f.frameAngle):Math.max(e._segmentAngles[i].boundsEnd,f.frameAngle),a=e._arc.clockwise?Math.min(e._segmentAngles[i].drawEnd,f.frameAngle):Math.max(e._segmentAngles[i].drawEnd,f.frameAngle),n=(h=e.buildArcPath(n,a,e._arc.clockwise,m,_,d),e.myarc||(e.myarc={}),e.as||(e.as={}),"arc-segment-".concat(e.toolId).concat("-").concat(i));if(e.as[i]||(e.as[i]=e._card.shadowRoot.getElementById(n)),a=e.as[i],e.myarc[i]=n,a&&(a.setAttribute("d",h),"colorlist"===e.config.show.style&&(a.style.fill=e.config.segments.colorlist.colors[i],e.styles.foreground[i].fill=e.config.segments.colorlist.colors[i]),e.config.show.lastcolor)){var l,n=e._arc.clockwise?e._segmentAngles[i].drawStart:e._segmentAngles[i].drawEnd,c=e._arc.clockwise?e._segmentAngles[i].drawEnd:e._segmentAngles[i].drawStart,c=Math.min(Math.max(0,(r-n)/(c-n)),1);if("colorstops"===e.config.show.style?l=e._card._getGradientValue(e._segments.colorStops[e._segments.sortedStops[i]],e._segments.colorStops[e._segments.sortedStops[i]],c):"colorlist"===e.config.show.style&&(l=e.config.segments.colorlist.colors[i]),e.styles.foreground[0].fill=l,e.as[0].style.fill=l,0<i)for(let s=i;0<=s;s--)e.styles.foreground[s].fill!==l&&(e.styles.foreground[s].fill=l,e.as[s].style.fill=l),e.styles.foreground[s].fill=l,e.as[s].style.fill=l}e._cache[i]=h,f.frameAngle!==r&&(r+=1e-6*e._arc.direction);var g=i;i=e._segmentAngles.findIndex((s,t)=>e._arc.clockwise?r<=s.boundsEnd&&r>=s.boundsStart:r<=s.boundsStart&&r>=s.boundsEnd),o||g!==i&&(e.debug&&console.log("RENDERNEW movit - remove path",e.toolId,g),e._arc.clockwise,a.removeAttribute("d"),e._cache[g]=null),f.runningAngle=r,e.debug&&console.log("RENDERNEW - animation loop tween",e.toolId,f,i,g)}while(f.runningAngle!==f.frameAngle);1!==f.progress?e.rAFid=requestAnimationFrame(s=>{t(s,e)}):(f.startTime=null,e.debug&&console.log("RENDERNEW - animation loop ENDING tween",e.toolId,f,i,g))}(s,e)}),this._initialDraw=!1)}else{this.dev.debug&&console.log("RENDERNEW _arcId does NOT exist",this._arcId,this.toolId);for(let e=0;e<this._segmentAngles.length;e++){h=this.buildArcPath(this._segmentAngles[e].drawStart,this._segmentAngles[e].drawEnd,this._arc.clockwise,this.svg.radiusX,this.svg.radiusY,this.config.isScale?this.svg.width:0),this._cache[e]=h;let t=this.config.color;if("colorlist"===this.config.show.style&&(t=this.config.segments.colorlist.colors[e]),"colorstops"===this.config.show.style&&(t=this._segments.colorStops[this._segments.sortedStops[e]]),this.styles.foreground||(this.styles.foreground={}),this.styles.foreground[e]||(this.styles.foreground[e]=Merge.mergeDeep(this.config.styles.foreground)),this.styles.foreground[e].fill=t,this.config.show.lastcolor&&0<e)for(let s=e-1;0<s;s--)this.styles.foreground[s].fill=t;i.push(svg`<path id="arc-segment-${this.toolId}-${e}" class="arc__segment"
                            style="${styleMap(this.styles.foreground[e])}"
                            d="${h}"
                            />`)}this.dev.debug&&console.log("RENDERNEW - svgItems",i,this._firstUpdatedCalled)}return svg`${i}`}}polarToCartesian(s,t,e,i,o){o=(o-90)*Math.PI/180;return{x:s+e*Math.cos(o),y:t+i*Math.sin(o)}}buildArcPath(s,t,e,i,o,n){var r=this.polarToCartesian(this.svg.cx,this.svg.cy,i,o,t),a=this.polarToCartesian(this.svg.cx,this.svg.cy,i,o,s),l=Math.abs(t-s)<=180?"0":"1",e=e?"0":"1",c=i-n,n=o-n,t=this.polarToCartesian(this.svg.cx,this.svg.cy,c,n,t),s=this.polarToCartesian(this.svg.cx,this.svg.cy,c,n,s);return["M",r.x,r.y,"A",i,o,0,l,e,a.x,a.y,"L",s.x,s.y,"A",c,n,0,l,"0"===e?"1":"0",t.x,t.y,"Z"].join(" ")}}