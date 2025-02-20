import{svg}from"lit-element";import{classMap}from"lit-html/directives/class-map";import{styleMap}from"lit-html/directives/style-map";import{SVGInjector}from"@tanem/svg-injector";import Merge from"./merge";import Utils from"./utils";import BaseTool from"./base-tool";import Templates from"./templates";export default class UserSvgTool extends BaseTool{constructor(t,i,s){super(t,Merge.mergeDeep({position:{cx:50,cy:50,height:50,width:50},options:{svginject:!0},styles:{usersvg:{},mask:{fill:"white"}}},i),s),this.images={},this.images=Object.assign({},...this.config.images),this.item={},this.item.image="default",this.imageCur="none",this.imagePrev="none",this.classes={},this.classes.tool={},this.classes.usersvg={},this.classes.mask={},this.styles={},this.styles.tool={},this.styles.usersvg={},this.styles.mask={},this.injector={},this.injector.svg=null,this.injector.cache=[],this.clipPath={},this.config.clip_path&&(this.svg.cp_cx=Utils.calculateSvgCoordinate(this.config.clip_path.position.cx||this.config.position.cx,0),this.svg.cp_cy=Utils.calculateSvgCoordinate(this.config.clip_path.position.cy||this.config.position.cy,0),this.svg.cp_height=Utils.calculateSvgDimension(this.config.clip_path.position.height||this.config.position.height),this.svg.cp_width=Utils.calculateSvgDimension(this.config.clip_path.position.width||this.config.position.width),t=Math.min(this.svg.cp_height,this.svg.cp_width)/2,this.svg.radiusTopLeft=+Math.min(t,Math.max(0,Utils.calculateSvgDimension(this.config.clip_path.position.radius.top_left||this.config.clip_path.position.radius.left||this.config.clip_path.position.radius.top||this.config.clip_path.position.radius.all)))||0,this.svg.radiusTopRight=+Math.min(t,Math.max(0,Utils.calculateSvgDimension(this.config.clip_path.position.radius.top_right||this.config.clip_path.position.radius.right||this.config.clip_path.position.radius.top||this.config.clip_path.position.radius.all)))||0,this.svg.radiusBottomLeft=+Math.min(t,Math.max(0,Utils.calculateSvgDimension(this.config.clip_path.position.radius.bottom_left||this.config.clip_path.position.radius.left||this.config.clip_path.position.radius.bottom||this.config.clip_path.position.radius.all)))||0,this.svg.radiusBottomRight=+Math.min(t,Math.max(0,Utils.calculateSvgDimension(this.config.clip_path.position.radius.bottom_right||this.config.clip_path.position.radius.right||this.config.clip_path.position.radius.bottom||this.config.clip_path.position.radius.all)))||0),this.dev.debug&&console.log("UserSvgTool constructor config, svg",this.toolId,this.config,this.svg)}set value(t){super.value=t}updated(t){var s=this;this.config.options.svginject&&!this.injector.cache[this.imageCur]&&(this.injector.elementsToInject=this._card.shadowRoot.getElementById("usersvg-".concat(this.toolId)).querySelectorAll("svg[data-src]:not(.injected-svg)"),0!==this.injector.elementsToInject.length)&&SVGInjector(this.injector.elementsToInject,{afterAll(t){setTimeout(()=>{s._card.requestUpdate()},0)},afterEach(t,i){if(t)throw s.injector.error=t,s.config.options.svginject=!1,t;s.injector.error="",s.injector.cache[s.imageCur]=i},beforeEach(t){t.removeAttribute("height"),t.removeAttribute("width")},cacheRequests:!1,evalScripts:"once",httpRequestWithCredentials:!1,renumerateIRIElements:!1})}_renderUserSvg(){this.MergeAnimationStyleIfChanged();var t=Templates.getJsTemplateOrValue(this,this._stateValue,Merge.mergeDeep(this.images));if(this.imagePrev=this.imageCur,this.imageCur=t[this.item.image],"none"===t[this.item.image])return svg``;var i=this.injector.cache[this.imageCur];let s=svg``,e="",h="";this.config.clip_path&&(e=`url(#clip-path-${this.toolId})`,h=`url(#mask-${this.toolId})`,s=svg`
        <defs>
          <path  id="path-${this.toolId}"
            d="
              M ${this.svg.cp_cx+this.svg.radiusTopLeft+(this.svg.width-this.svg.cp_width)/2} ${this.svg.cp_cy+(this.svg.height-this.svg.cp_height)/2}
              h ${this.svg.cp_width-this.svg.radiusTopLeft-this.svg.radiusTopRight}
              a ${this.svg.radiusTopRight} ${this.svg.radiusTopRight} 0 0 1 ${this.svg.radiusTopRight} ${this.svg.radiusTopRight}
              v ${this.svg.cp_height-this.svg.radiusTopRight-this.svg.radiusBottomRight}
              a ${this.svg.radiusBottomRight} ${this.svg.radiusBottomRight} 0 0 1 -${this.svg.radiusBottomRight} ${this.svg.radiusBottomRight}
              h -${this.svg.cp_width-this.svg.radiusBottomRight-this.svg.radiusBottomLeft}
              a ${this.svg.radiusBottomLeft} ${this.svg.radiusBottomLeft} 0 0 1 -${this.svg.radiusBottomLeft} -${this.svg.radiusBottomLeft}
              v -${this.svg.cp_height-this.svg.radiusBottomLeft-this.svg.radiusTopLeft}
              a ${this.svg.radiusTopLeft} ${this.svg.radiusTopLeft}  0 0 1 ${this.svg.radiusTopLeft} -${this.svg.radiusTopLeft}
              ">
          </path>
          <clipPath id="clip-path-${this.toolId}">
            <use href="#path-${this.toolId}"/>
          </clipPath>
          <mask id="mask-${this.toolId}">
            <use href="#path-${this.toolId}" style="${styleMap(this.styles.mask)}"/>
          </mask>
        </defs>
        `);var o=t[this.item.image].lastIndexOf(".");return"svg"!==t[this.item.image].substring(-1===o?1/0:o+1)?svg`
        <svg class="sak-usersvg__image" x="${this.svg.x}" y="${this.svg.y}"
          style="${styleMap(this.styles.usersvg)}">
          "${s}"
          <image 
            clip-path="${e}" mask="${h}"
            href="${t[this.item.image]}"
            height="${this.svg.height}" width="${this.svg.width}"
          />
        </svg>
        `:i&&this.config.options.svginject?(i.classList.remove("hidden"),svg`
        <svg x="${this.svg.x}" y="${this.svg.y}" style="${styleMap(this.styles.usersvg)}"
          height="${this.svg.height}" width="${this.svg.width}"
          clip-path="${e}"
          mask="${h}"
        >
          "${s}"
          ${i};
       </svg>
       `):svg`
        <svg class="sak-usersvg__image ${this.config.options.svginject?"hidden":""}"
          data-id="usersvg-${this.toolId}" data-src="${t[this.item.image]}"
          x="${this.svg.x}" y="${this.svg.y}"
          style="${this.config.options.svginject?"":styleMap(this.styles.usersvg)}">
          "${s}"
          <image
            clip-path="${e}"
            mask="${h}"
            href="${t[this.item.image]}"
            height="${this.svg.height}" width="${this.svg.width}"
          />
        </svg>
      `}render(){return svg`
      <g id="usersvg-${this.toolId}" overflow="visible"
        class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
        @click=${t=>this.handleTapEvent(t,this.config)}>
        ${this._renderUserSvg()}
      </g>
    `}}