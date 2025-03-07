import{svg}from"lit-element";import{classMap}from"lit-html/directives/class-map.js";import{styleMap}from"lit-html/directives/style-map.js";import Merge from"./merge";import Utils from"./utils";import BaseTool from"./base-tool";export default class LineTool extends BaseTool{constructor(s,t,i){if(super(s,Merge.mergeDeep({position:{orientation:"vertical",length:"10",cx:"50",cy:"50"},classes:{tool:{"sak-line":!0,hover:!0},line:{"sak-line__line":!0}},styles:{tool:{},line:{}}},t),i),!["horizontal","vertical","fromto"].includes(this.config.position.orientation))throw Error("LineTool::constructor - invalid orientation [vertical, horizontal, fromto] = ",this.config.position.orientation);["horizontal","vertical"].includes(this.config.position.orientation)&&(this.svg.length=Utils.calculateSvgDimension(t.position.length)),"fromto"===this.config.position.orientation?(this.svg.x1=Utils.calculateSvgCoordinate(t.position.x1,this.toolsetPos.cx),this.svg.y1=Utils.calculateSvgCoordinate(t.position.y1,this.toolsetPos.cy),this.svg.x2=Utils.calculateSvgCoordinate(t.position.x2,this.toolsetPos.cx),this.svg.y2=Utils.calculateSvgCoordinate(t.position.y2,this.toolsetPos.cy)):"vertical"===this.config.position.orientation?(this.svg.x1=this.svg.cx,this.svg.y1=this.svg.cy-this.svg.length/2,this.svg.x2=this.svg.cx,this.svg.y2=this.svg.cy+this.svg.length/2):"horizontal"===this.config.position.orientation&&(this.svg.x1=this.svg.cx-this.svg.length/2,this.svg.y1=this.svg.cy,this.svg.x2=this.svg.cx+this.svg.length/2,this.svg.y2=this.svg.cy),this.classes.line={},this.styles.line={},this.dev.debug&&console.log("LineTool constructor coords, dimensions",this.coords,this.dimensions,this.svg,this.config)}_renderLine(){return this.MergeAnimationClassIfChanged(),this.MergeAnimationStyleIfChanged(),this.MergeColorFromState(this.styles.line),this.dev.debug&&console.log("_renderLine",this.config.position.orientation,this.svg.x1,this.svg.y1,this.svg.x2,this.svg.y2),svg`
      <line class="${classMap(this.classes.line)}"
        x1="${this.svg.x1}"
        y1="${this.svg.y1}"
        x2="${this.svg.x2}"
        y2="${this.svg.y2}"
        style="${styleMap(this.styles.line)}"/>
      `}render(){return svg`
      <g id="line-${this.toolId}"
        class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
        @click=${s=>this.handleTapEvent(s,this.config)}>
        ${this._renderLine()}
      </g>
    `}}