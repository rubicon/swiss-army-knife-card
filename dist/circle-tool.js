import{svg}from"lit-element";import{classMap}from"lit-html/directives/class-map.js";import{styleMap}from"lit-html/directives/style-map.js";import Merge from"./merge";import Utils from"./utils";import BaseTool from"./base-tool";export default class CircleTool extends BaseTool{constructor(s,e,t){super(s,Merge.mergeDeep({position:{cx:50,cy:50,radius:50},classes:{tool:{"sak-circle":!0,hover:!0},circle:{"sak-circle__circle":!0}},styles:{tool:{},circle:{}}},e),t),this.EnableHoverForInteraction(),this.svg.radius=Utils.calculateSvgDimension(e.position.radius),this.classes.tool={},this.classes.circle={},this.styles.tool={},this.styles.circle={},this.dev.debug&&console.log("CircleTool constructor config, svg",this.toolId,this.config,this.svg)}set value(s){super.value=s}_renderCircle(){return this.MergeAnimationClassIfChanged(),this.MergeAnimationStyleIfChanged(),this.MergeColorFromState(this.styles.circle),svg`
      <circle class="${classMap(this.classes.circle)}"
        cx="${this.svg.cx}"% cy="${this.svg.cy}"% r="${this.svg.radius}"
        style="${styleMap(this.styles.circle)}"
      </circle>

      `}render(){return this.styles.tool.overflow="visible",this.styles["transform-origin"]=this.svg.cx+" "+this.svg.cy,svg`
      <g "" id="circle-${this.toolId}"
        class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
        @click=${s=>this.handleTapEvent(s,this.config)}>
        ${this._renderCircle()}
      </g>
    `}}