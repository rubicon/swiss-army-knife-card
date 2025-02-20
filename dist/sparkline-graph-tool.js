import{svg}from"lit-element";import{classMap}from"lit-html/directives/class-map.js";import{styleMap}from"lit-html/directives/style-map.js";import Merge from"./merge";import BaseTool from"./base-tool";import Utils from"./utils";import SparklineGraph,{X,Y,V}from"./sparkline-graph";import Colors from"./colors";let getTime=(i,s,t="en-US")=>i.toLocaleString(t,{hour:"numeric",minute:"numeric",...s}),getMilli=i=>3600*i*1e3,getFirstDefinedItem=(...i)=>i.find(i=>void 0!==i),DEFAULT_COLORS=["var(--theme-sys-color-primary)","#3498db","#e74c3c","#9b59b6","#f1c40f","#2ecc71","#1abc9c","#34495e","#e67e22","#7f8c8d","#27ae60","#2980b9","#8e44ad"],findFirstValuedIndex=(t,e)=>{for(let i=e,s=t.length;i<s;i+=1)if(null!=t[i].value)return i;throw new Error('Error in threshold interpolation: could not find right-nearest valued stop. Do the first and last thresholds have a set "value"?')},interpolateStops=a=>{if(!a||!a.length)return a;if(null==a[0].value||null==a[a.length-1].value)throw new Error('The first and last thresholds must have a set "value".\n See xyz manual');let r=0,h=null;return a.map((i,s)=>{if(null!=i.value)return r=s,{...i};null==h?h=findFirstValuedIndex(a,s):s>h&&(r=h,h=findFirstValuedIndex(a,s));var t=a[r].value,e=(a[h].value-t)/(h-r);return{color:"string"==typeof i?i:i.color,value:e*s+t}})},computeThresholds=(i,s)=>{let t=interpolateStops(i);try{t.sort((i,s)=>s.value-i.value)}catch(i){console.log("computeThresholds, error",i,t)}return"smooth"===s?t:[].concat(...t.map((i,s)=>[i,{value:i.value-1e-4,color:(t[s+1]||i).color}]))};export default class SparklineGraphTool extends BaseTool{constructor(i,s,t){var e={position:{cx:50,cy:50,height:25,width:25,margin:0},period:{type:"unknown",real_time:!1,group_by:"interval"},sparkline:{state_values:{logarithmic:!1,value_factor:0,aggregate_func:"avg",smoothing:!0},equalizer:{value_buckets:10,square:!1},graded:{square:!1},animate:!0,hour24:!1,font_size:10,line_color:[...DEFAULT_COLORS],colorstops:{colors:[]},colorstops_transition:"smooth",state_map:{map:[]},cache:!0,color:"var(--primary-color)",radial_barcode:{size:5,line_width:0,face:{hour_marks_count:24}},classes:{tool:{"sak-sparkline":!0,hover:!0},bar:{},line:{"sak-sparkline__line":!0,hover:!0},graded_background:{},graded_foreground:{},radial_barcode_background:{"sak-sparkline__radial_barcode__background":!0},radial_barcode_face_day_night:{"sak-sparkline__radial_barcode-face_day-night":!0},radial_barcode_face_hour_marks:{"sak-sparkline__radial_barcode-face_hour-marks":!0},radial_barcode_face_hour_numbers:{"sak-sparkline__radial_barcode-face_hour-numbers":!0}},styles:{tool:{},line:{},bar:{},graded_background:{},graded_foreground:{},radial_barcode_background:{},radial_barcode_face_day_night:{},radial_barcode_face_hour_marks:{},radial_barcode_face_hour_numbers:{},area_mask_above:{fill:"url(#sak-sparkline-area-mask-tb-1)"},area_mask_below:{fill:"url(#sak-sparkline-area-mask-bt-1)"},bar_mask_above:{fill:"url(#sak-sparkline-bar-mask-tb-80)"},bar_mask_below:{fill:"url(#sak-sparkline-bar-mask-bt-80)"}},show:{style:"fixedcolor"}}};if(super(i,Merge.mergeDeep(e,s),t),this.config.period.real_time?this.config.period.type="real_time":this.config.period?.calendar?(this.config.period.type="calendar",this.config.period=Merge.mergeDeep({calendar:{period:"day",offset:0,duration:{hour:24},bins:{per_hour:1}}},this.config.period)):this.config.period?.rolling_window&&(this.config.period.type="rolling_window",this.config.period=Merge.mergeDeep({rolling_window:{duration:{hour:24},bins:{per_hour:1}}},this.config.period)),this.svg.margin={},"object"==typeof this.config.position.margin?(this.svg.margin.t=Utils.calculateSvgDimension(this.config.position.margin?.t)||Utils.calculateSvgDimension(this.config.position.margin?.y)||0,this.svg.margin.b=Utils.calculateSvgDimension(this.config.position.margin?.b)||Utils.calculateSvgDimension(this.config.position.margin?.y)||0,this.svg.margin.r=Utils.calculateSvgDimension(this.config.position.margin?.r)||Utils.calculateSvgDimension(this.config.position.margin?.x)||0,this.svg.margin.l=Utils.calculateSvgDimension(this.config.position.margin?.l)||Utils.calculateSvgDimension(this.config.position.margin?.x)||0,this.svg.margin.x=this.svg.margin.l,this.svg.margin.y=this.svg.margin.t):(this.svg.margin.x=Utils.calculateSvgDimension(this.config.position.margin),this.svg.margin.y=this.svg.margin.x,this.svg.margin.t=this.svg.margin.x,this.svg.margin.r=this.svg.margin.x,this.svg.margin.b=this.svg.margin.x,this.svg.margin.l=this.svg.margin.x),this.svg.clockface={},this.config.sparkline?.radial_barcode?.face&&(!0===this.config.sparkline.radial_barcode.face?.show_day_night&&(this.svg.clockface.dayNightRadius=Utils.calculateSvgDimension(this.config.sparkline.radial_barcode.face.day_night_radius)),!0===this.config.sparkline.radial_barcode.face?.show_hour_marks&&(this.svg.clockface.hourMarksRadius=Utils.calculateSvgDimension(this.config.sparkline.radial_barcode.face.hour_marks_radius)),["absolute","relative"].includes(this.config.sparkline.radial_barcode.face?.show_hour_numbers))&&(this.svg.clockface.hourNumbersRadius=Utils.calculateSvgDimension(this.config.sparkline.radial_barcode.face.hour_numbers_radius)),this._data=[],this._bars=[],this._scale={},this._needsRendering=!1,this.classes.tool={},this.classes.bar={},this.classes.radial_barcode_face_day_night={},this.classes.radial_barcode_face_hour_marks={},this.classes.radial_barcode_face_hour_numbers={},this.classes.barcode={},this.classes.barcode_graph={},this.styles.barcode={},this.styles.barcode_graph={},this.classes.traffic_light={},this.classes.graded_background={},this.styles.graded_background={},this.classes.graded_foreground={},this.styles.graded_foreground={},this.classes.equalizer_part={},this.styles.equalizer_part={},this.classes.radial_barcode={},this.classes.radial_barcode_background={},this.classes.radial_barcode_graph={},this.styles.radial_barcode={},this.styles.radial_barcode_background={},this.styles.radial_barcode_graph={},this.classes.helper_line1={},this.classes.helper_line2={},this.classes.helper_line3={},this.styles.helper_line1={},this.styles.helper_line2={},this.styles.helper_line3={},this.styles.tool={},this.styles.bar={},this.styles.line={},this.styles.radial_barcode_face_day_night={},this.styles.radial_barcode_face_hour_marks={},this.styles.radial_barcode_face_hour_numbers={},this.stylesBar={},this.seriesIndex=0,this.id=this.toolId,this.bound=[0,0],this.boundSecondary=[0,0],this.length=[],this.entity=[],this.line=[],this.lineMin=[],this.lineMax=[],this.bar=[],this.equalizer=[],this.graded=[],this.abs=[],this.area=[],this.areaMinMax=[],this.points=[],this.gradient=[],this.tooltip={},this.updateQueue=[],this.updating=!1,this.stateChanged=!1,this.initial=!0,this._md5Config=void 0,this.radialBarcodeChart=[],this.radialBarcodeChartBackground=[],this.barcodeChart=[],this.config.width=this.svg.width,this.config.height=this.svg.height,this.svg.line_width=Utils.calculateSvgDimension(this.config.sparkline[this.config.sparkline.show.chart_type]?.line_width||this.config.line_width||0),this.svg.column_spacing=Utils.calculateSvgDimension(this.config.sparkline[this.config.sparkline.show.chart_type]?.column_spacing||this.config.bar_spacing||1),this.svg.row_spacing=Utils.calculateSvgDimension(this.config.sparkline[this.config.sparkline.show.chart_type]?.row_spacing||this.config.bar_spacing||1),this.gradeValues=[],this.config.sparkline.colorstops.colors.map((i,s)=>this.gradeValues[s]=i.value),this.stops=Merge.mergeDeep(...this.config.sparkline.colorstops.colors),this.gradeRanks=[],this.config.sparkline.colorstops.colors.map((i,s)=>{var t="rank_order"===this.config.sparkline.show?.chart_variant&&void 0!==i.rank?i.rank:s,e=(this.gradeRanks[t]||(this.gradeRanks[t]={},this.gradeRanks[t].value=[],this.gradeRanks[t].rangeMin=[],this.gradeRanks[t].rangeMax=[]),this.gradeRanks[t].rank=t,this.gradeRanks[t].color=i.color,i.value),s=this.config.sparkline.colorstops.colors[s+1]?.value||1/0;return this.gradeRanks[t].value.push(i.value),this.gradeRanks[t].rangeMin.push(e),this.gradeRanks[t].rangeMax.push(s),!0}),this.config.sparkline.colorstops.colors=computeThresholds(this.config.sparkline.colorstops.colors,this.config.sparkline.colorstops_transition),this.radialBarcodeChartWidth=Utils.calculateSvgDimension(this.config?.radial_barcode?.size||5),this.svg.graph={},this.svg.graph.height=this.svg.height-0*this.svg.margin.y,this.svg.graph.width=this.svg.width-0*this.svg.margin.x,this.config.sparkline.state_map.map.forEach((i,s)=>{"string"==typeof i&&(this.config.sparkline.state_map.map[s]={value:i,label:i}),this.config.sparkline.state_map.map[s].label=this.config.sparkline.state_map.map[s].label||this.config.sparkline.state_map.map[s].value}),this.xLines={},this.xLines.lines=[],"object"==typeof this.config.sparkline.x_lines?.lines){let s=0;this.config.sparkline.x_lines.lines.forEach(i=>{this.xLines.lines[s]={id:i.name,zpos:i?.zpos||"above",yshift:Utils.calculateSvgDimension(i?.yshift)||0},s+=1})}"object"==typeof this.config.sparkline.x_lines?.numbers&&(this.xLines.numbers={...this.config.sparkline.x_lines.numbers});var{}=this;this.config.sparkline.state_values.smoothing=getFirstDefinedItem(this.config.sparkline.state_values.smoothing,!this._card.config.entities[this.defaultEntityIndex()].entity.startsWith("binary_sensor.")),this.Graph=[],this.Graph[0]=new SparklineGraph(this.svg.graph.width,this.svg.graph.height,this.svg.margin,this.config,this.gradeValues,this.gradeRanks,this.config.sparkline.state_map),this._firstDataReceived=!1}set value(i){var s;return this._stateValue!==i&&(s=super.value=i,"real_time"===this.config.period.type&&(this.series=[{state:i}]),s)}set data(i){}set series(t){if(this.dev&&this.dev.fakeData){let s=40;for(let i=0;i<t.length;i++)i<t.length/2&&(s-=4*i),i>t.length/2&&(s+=3*i),t[i].state=s}var i=(!0===this._card.config.entities[0].fixed_value&&(t=[i=t[t.length-1],i]),this.seriesIndex=0,this.Graph[this.seriesIndex].update(t),this.updateBounds(),this).config;if(i.sparkline.show.chart_type){if(!this._card.config.entities[this.defaultEntityIndex()]||0===this.Graph[0].coords.length)return;var s,e="secondary"===this._card.config.entities[0].states?this.boundSecondary:this.bound,e=([this.Graph[0].min,this.Graph[0].max]=[e[0],e[1]],this.visibleEntities.length);"bar"===i.sparkline.show.chart_type?(this.bar[0]=this.Graph[0].getBars(0,e,this.svg.colomn_spacing),0<i.sparkline.colorstops.colors.length&&!this._card.config.entities[0].color&&(this.gradient[0]=this.Graph[0].computeGradient(i.sparkline.colorstops.colors,this.config.sparkline.state_values.logarithmic))):["area","line"].includes(i.sparkline.show.chart_type)&&(e=this.Graph[0].getPath(),!1!==this._card.config.entities[0].show_line)&&(this.line[0]=e),"area"===i.sparkline.show.chart_type&&(this.area[0]=this.Graph[0].getArea(this.line[0])),(i.sparkline?.line?.show_minmax||i.sparkline?.area?.show_minmax)&&(e=this.Graph[0].getPathMin(),s=this.Graph[0].getPathMax(),this.lineMin[0]=e,this.lineMax[0]=s,this.areaMinMax[0]=this.Graph[0].getAreaMinMax(e,s)),"dots"===i.sparkline.show.chart_type||!0===i.sparkline?.area?.show_dots||!0===i.sparkline?.line?.show_dots?this.points[0]=this.Graph[0].getPoints():"equalizer"===this.config.sparkline.show.chart_type?(this.Graph[0].levelCount=this.config.sparkline.equalizer.value_buckets,this.Graph[0].valuesPerBucket=(this.Graph[0].max-this.Graph[0].min)/this.config.sparkline.equalizer.value_buckets,this.equalizer[0]=this.Graph[0].getEqualizer(0,this.visibleEntities.length,this.svg.column_spacing,this.svg.row_spacing)):"graded"===this.config.sparkline.show.chart_type?(this.Graph[0].levelCount=this.config.sparkline.equalizer.value_buckets,this.Graph[0].valuesPerBucket=(this.Graph[0].max-this.Graph[0].min)/this.config.sparkline.equalizer.value_buckets,this.graded[0]=this.Graph[0].getGrades(0,this.visibleEntities.length,this.svg.column_spacing,this.svg.row_spacing)):"radial_barcode"===this.config.sparkline.show.chart_type?(this.radialBarcodeChartBackground[0]=this.Graph[0].getRadialBarcodeBackground(0,this.visibleEntities.length,this.svg.column_spacing,this.svg.row_spacing),this.radialBarcodeChart[0]=this.Graph[0].getRadialBarcode(0,this.visibleEntities.length,this.svg.column_spacing,this.svg.row_spacing),this.Graph[0].radialBarcodeBackground=this.radialBarcodeChartBackground[0],this.Graph[0].radialBarcode=this.radialBarcodeChart[0]):"barcode"===this.config.sparkline.show.chart_type&&(this.barcodeChart[0]=this.Graph[0].getBarcode(0,this.visibleEntities.length,this.svg.column_spacing,this.svg.row_spacing),this.Graph[0].barcodeChart=this.barcodeChart[0]),0<i.sparkline.colorstops.colors.length&&!this._card.config.entities[0].color&&(this.gradient[0]=this.Graph[0].computeGradient(i.sparkline.colorstops.colors,this.config.sparkline.state_values.logarithmic)),this.line=[...this.line]}this.updating=!1,this._firstUpdatedCalled?(this._firstUpdatedCalled=!1,this._firstDataReceived=!0):(this._firstUpdatedCalled=!0,this._firstDataReceived=!1)}hasSeries(){return this.defaultEntityIndex()}_convertState(s){var i=this.config.sparkline.state_map.map.findIndex(i=>i.value===s.state);-1!==i&&(s.state=i)}processStateMap(r){0<this.config.sparkline.state_map?.map?.length&&r[0].forEach((i,s)=>{0<this.config.sparkline.state_map.map.length&&(r[0][s].haState=i.state),this._convertState(i),r[0][s].state=i.state}),"bin"===this.config.sparkline.state_values?.use_value&&r[0].forEach((t,i)=>{let e=-1;let a=!1;a=!1;for(let s=0;s<this.gradeRanks.length;s++)for(let i=0;i<this.gradeRanks[s].rangeMin.length;i++)t.state>=this.gradeRanks[s].rangeMin[i]&&t.state<this.gradeRanks[s].rangeMax[i]&&(a=!0,i,e=s);a||console.log("processStateMap - ILLEGAL value",t,i);var s=this.gradeRanks[e].rank;r[0][i].haState=t.state,r[0][i].state=s}),0!==this.config.sparkline.state_values.value_factor&&r[0].forEach((i,s)=>{r[0][s].haState=i.state,r[0][s].state=i.state*this.config.sparkline.state_values.value_factor})}get visibleEntities(){return[1]}get primaryYaxisEntities(){return this.visibleEntities.filter(i=>void 0===i.states||"primary"===i.states)}get secondaryYaxisEntities(){return this.visibleEntities.filter(i=>"secondary"===i.states)}get visibleLegends(){return this.visibleEntities.filter(i=>!1!==i.show_legend)}get primaryYaxisSeries(){return this.primaryYaxisEntities.map((i,s)=>this.Graph[s])}get secondaryYaxisSeries(){return this.secondaryYaxisEntities.map(i=>this.Graph[i.index])}getBoundary(s,i,t,e){if(s in Math)return void 0===t?Math[s](...i.map(i=>i[s]))||e:"~"!==t[0]?t:Math[s](Number(t.substr(1)),...i.map(i=>i[s]));throw new Error(`The type "${s}" is not present on the Math object`)}getBoundaries(i,s,t,e,a){let r=[this.getBoundary("min",i,s,e[0],a),this.getBoundary("max",i,t,e[1],a)];return r=a&&(s=Math.abs(r[0]-r[1]),0<(i=parseFloat(a)-s))?[r[0]-i/2,r[1]+i/2]:r}updateBounds({config:i}=this){this.bound=this.getBoundaries(this.primaryYaxisSeries,i.sparkline.state_values.lower_bound,i.sparkline.state_values.upper_bound,this.bound,i.sparkline.state_values.min_bound_range),this.boundSecondary=this.getBoundaries(this.secondaryYaxisSeries,i.sparkline.state_values.lower_bound_secondary,i.sparkline.state_values.upper_bound_secondary,this.boundSecondary,i.sparkline.state_values.min_bound_range_secondary)}computeColor(i,s){var{colorstops:t,line_color:e}=this.config.sparkline;let a=Number(i)||0;i={color:e[s]||e[0],...t.colors.slice(-1)[0],...t.colors.find(i=>i.value<a)};return this._card.config.entities[s].color||i.color}intColor(i,s){var t,e,a,{colorstops:r,line_color:h}=this.config.sparkline;let l=Number(i)||0,n;return 0<r.colors.length&&(n="bar"===this.config.sparkline.show.chart_type?(t=(r.colors.find(i=>i.value<l)||r.colors.slice(-1)[0]).color,t):(t=r.colors.findIndex(i=>i.value<l),e=r.colors[t],(a=r.colors[t-1])?(i=(a.value-i)/(a.value-e.value),Colors.getGradientValue(a.color,e.color,i)):(t?r.colors[r.colors.length-1]:r.colors[0]).color)),this._card.config.entities[s].color||n||h[s]||h[0]}getEndDate(){var i=new Date;switch(this.config.period?.group_by){case"date":i.setDate(i.getDate()+1),i.setHours(0,0,0);break;case"hour":i.setHours(i.getHours()+1),i.setMinutes(0,0)}return"day"===this.config.period?.calendar?.period&&i.setHours(0,0,0,0),i}setTooltip(i,s,t,e=0){}renderSvgAreaMask(i,s){var t,e;if("area"===this.config.sparkline.show.chart_type&&i)return i="fade"===this.config.sparkline.show.fill,t=this.length[s]||!1===this._card.config.entities[s].show_line,e=0<=this.Graph[s]._min?0:Math.abs(this.Graph[s]._min)/(this.Graph[s]._max-this.Graph[s]._min)*100,svg`
    <defs>
      <linearGradient id=${`fill-grad-pos-${this.id}-`+s} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='100%' stop-opacity='0.1'/>
      </linearGradient>
      <mask id=${`fill-grad-mask-pos-${this.id}-`+s}>
        <rect width="100%" height="${100-e}%" fill=${this.config.sparkline.styles.area_mask_above.fill}
         />
      </mask>
      <linearGradient id=${`fill-grad-neg-${this.id}-`+s} x1="0%" y1="100%" x2="0%" y2="0%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='100%' stop-opacity='0.1'/>
      </linearGradient>
      <mask id=${`fill-grad-mask-neg-${this.id}-`+s}>
        <rect width="100%" y=${100-e}% height="${e}%" fill=${this.config.sparkline.styles.area_mask_below.fill}
         />
      </mask>
    </defs>

    <mask id=${`fill-${this.id}-`+s}>
      <path class='fill'
        type=${this.config.sparkline.show.fill}
        .id=${s} anim=${this.config.sparkline.animate} ?init=${t}
        style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
        fill='white'
        mask=${i?`url(#fill-grad-mask-pos-${this.id}-${s})`:""}
        d=${this.area[s]}
      />
      ${this.Graph[s]._min<0?svg`<path class='fill'
            type=${this.config.sparkline.show.fill}
            .id=${s} anim=${this.config.sparkline.animate} ?init=${t}
            style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
            fill='white'
            mask=${i?`url(#fill-grad-mask-neg-${this.id}-${s})`:""}
            d=${this.area[s]}
          />`:""}
    </mask>`}renderSvgAreaMinMaxMask(i,s){var t,e;if(["area","line"].includes(this.config.sparkline.show.chart_type)&&i)return i="fade"===this.config.sparkline.show.fill,t=this.length[s]||!1===this._card.config.entities[s].show_line,e=0<=this.Graph[s]._min?0:Math.abs(this.Graph[s]._min)/(this.Graph[s]._max-this.Graph[s]._min)*100,svg`
    <defs>
      <linearGradient id=${`fill-grad-pos-${this.id}-`+s} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='100%' stop-opacity='0.1'/>
      </linearGradient>
      <mask id=${`fill-grad-mask-pos-${this.id}-`+s}>
        <rect width="100%" height="${100-e}%" fill=${this.config.sparkline.styles.area_mask_above.fill}
         />
      </mask>
      <linearGradient id=${`fill-grad-neg-${this.id}-`+s} x1="0%" y1="100%" x2="0%" y2="0%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='100%' stop-opacity='0.1'/>
      </linearGradient>
      <mask id=${`fill-grad-mask-neg-${this.id}-`+s}>
        <rect width="100%" y=${100-e}% height="${e}%" fill=${this.config.sparkline.styles.area_mask_below.fill}
         />
      </mask>
    </defs>

    <mask id=${`fillMinMax-${this.id}-`+s}>
      <path class='fill'
        type=${this.config.sparkline.show.fill}
        .id=${s} anim=${this.config.sparkline.animate} ?init=${t}
        style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
        fill='#555555'
        mask=${i?`url(#fill-grad-mask-pos-${this.id}-${s})`:""}
        d=${this.areaMinMax[s]}
      />
      ${this.Graph[s]._min<0?svg`<path class='fill'
            type=${this.config.sparkline.show.fill}
            .id=${s} anim=${this.config.sparkline.animate} ?init=${t}
            style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
            fill='#444444'
            mask=${i?`url(#fill-grad-mask-neg-${this.id}-${s})`:""}
            d=${this.areaMinMax[s]}
          />`:""}
    </mask>`}renderSvgLineMask(i,s){if(i)return i=svg`
    <path
      class='line'
      .id=${s}
      anim=${this.config.sparkline.animate} ?init=${this.length[s]}
      style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
      fill='none'
      stroke-dasharray=${this.length[s]||"none"} stroke-dashoffset=${this.length[s]||"none"}
      stroke=${"white"}
      stroke-width=${this.svg.line_width}
      d=${this.line[s]}
    />`,svg`
    <mask id=${`line-${this.id}-`+s}>
      ${i}
    </mask>
  `}renderSvgLineMinMaxMask(i,s){if("line"===this.config.sparkline.show.chart_type&&i)return i=svg`
    <path
      class='lineMinMax'
      .id=${s}
      anim=${this.config.sparkline.animate} ?init=${this.length[s]}
      style="animation-delay: ${this.config.sparkline.animate?.5*s+"s":"0s"}"
      fill='none'
      stroke-dasharray=${this.length[s]||"none"} stroke-dashoffset=${this.length[s]||"none"}
      stroke=${"white"}
      stroke-width=${this.svg.line_width}
      d=${this.line[s]}
    />`,svg`
    <mask id=${`lineMinMax-${this.id}-`+s}>
      ${i}
    </mask>
  `}renderSvgPoint(i,s){var t=this.gradient[s]?this.computeColor(i[V],s):"inherit";return svg`
    <circle
      class='line--point'
      ?inactive=${this.tooltip.index!==i[3]}
      style=${`--mcg-hover: ${t};`}
      stroke=${t}
      fill=${t}
      cx=${i[X]} cy=${i[Y]} r=${this.svg.line_width/1.5}
      @mouseover=${()=>this.setTooltip(s,i[3],i[V])}
      @mouseout=${()=>this.tooltip={}}
    />
  `}renderSvgPoints(i,s){var t;if(i)return t=this.computeColor(this._card.entities[s].state,s),svg`
    <g class='line--points'
      ?tooltip=${this.tooltip.entity===s}
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      ?init=${this.length[s]}
      anim=${this.config.sparkline.animate&&"hover"!==this.config.sparkline.show.points}
      style="animation-delay: ${this.config.sparkline.animate?.5*s+.5+"s":"0s"}"
      fill=${t}
      stroke=${t}
      stroke-width=${this.svg.line_width/2}
      >
      ${i.map(i=>this.renderSvgPoint(i,s))}
    </g>`}renderSvgTrafficLight(l,i){var s;if(!0===this.config.sparkline.graded.square){if((s=Math.min(l.width,l.height))<l.height){var t=(this.svg.graph.height-this.gradeRanks.length*s)/(this.gradeRanks.length-1);for(let i=0;i<this.gradeRanks.length;i++)l.y[i]=this.svg.graph.height+this.svg.margin.y-i*(s+t);l.height=s}l.width=s}var e=this.gradeRanks.map((i,s)=>{var t=void 0!==l.value[s],e=t?this.classes.graded_foreground:this.classes.graded_background,a=t?this.styles.graded_foreground:this.styles.graded_background,r=t?this.computeColor(l.value[s]+.001,0):"var(--theme-sys-elevation-surface-neutral4)",h=t?this.styles.graded_foreground?.rx||0:this.styles.graded_background?.rx||0,t=t?this.styles.graded_foreground?.ry||h:this.styles.graded_background?.ry||h;return svg`
    <rect class="${classMap(e)}" style="${styleMap(a)}"
      x=${l.x+this.svg.line_width/2}
      y=${l.y[s]-+l.height+this.svg.line_width/2}
      height=${Math.max(1,l.height-this.svg.line_width)}
      width=${Math.max(1,l.width-this.svg.line_width)}
      stroke-width="${this.svg.line_width||0}"
      fill=${r}
      stroke=${r}
      pathLength="10"
      rx=${h}
      ry=${t}
      >
    </rect>`});return svg`
    ${e}
    `}renderSvgGraded(i,s){var t,e,a;if(i)return t=this.computeColor(this._card.entities[s].state,s),e=this.xLines.lines.map(i=>"below"===i.zpos?[svg`
        <line class=${classMap(this.classes[i.id])}) style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),a=this.xLines.lines.map(i=>"above"===i.zpos?[svg`
        <line class="${classMap(this.classes[i.id])}"
              style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),svg`
    <g class='traffic-lights'
      ?tooltip=${this.tooltip.entity===s}
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      ?init=${this.length[s]}
      anim=${this.config.sparkline.animate&&"hover"!==this.config.sparkline.show.points}
      style="animation-delay: ${this.config.sparkline.animate?.5*s+.5+"s":"0s"}"
      fill=${t}
      stroke=${t}
      stroke-width=${this.svg.line_width/2}
      >
      ${e}
      ${i.map(i=>this.renderSvgTrafficLight(i,s))}
      ${a}
    </g>`}renderSvgGradient(i){if(i)return i=i.map((i,s)=>{if(i)return svg`
      <linearGradient id=${`grad-${this.id}-`+s} gradientTransform="rotate(90)">
        ${i.map(i=>svg`
          <stop stop-color=${i.color} offset=${i.offset+"%"} />
        `)}
      </linearGradient>`}),svg`${i}`}renderSvgLineBackground(i,s){var t,e;if(i)return i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.computeColor(this._card.entities[s].state,s),t=this.xLines.lines.map(i=>"below"===i.zpos?[svg`
        <line class=${classMap(this.classes[i.id])}) style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),e=this.xLines.lines.map(i=>"above"===i.zpos?[svg`
        <line class="${classMap(this.classes[i.id])}"
              style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),svg`
    ${t}
    <rect class='line--rect'
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      id=${`line-rect-${this.id}-`+s}
      fill=${i} height="100%" width="100%"
      mask=${`url(#line-${this.id}-${s})`}
    />
    ${e}
    `}renderSvgLineMinMaxBackground(i,s){if("line"===this.config.sparkline.show.chart_type&&i)return i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.computeColor(this._card.entities[s].state,s),svg`
    <rect class='line--rect'
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      id=${`line-rect-${this.id}-`+s}
      fill=${i} height="100%" width="100%"
      mask=${`url(#lineMinMax-${this.id}-${s})`}
    />`}renderSvgAreaBackground(i,s){var t,e;if("area"===this.config.sparkline.show.chart_type&&i)return i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.intColor(this._card.entities[s].state,s),t=this.xLines.lines.map(i=>"below"===i.zpos?[svg`
          <line class=${classMap(this.classes[i.id])}) style="${styleMap(this.styles[i.id])}"
          x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
          x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
          pathLength="240"
          >
          </line>
          `]:[""]),e=this.xLines.lines.map(i=>"above"===i.zpos?[svg`
          <line class="${classMap(this.classes[i.id])}"
                style="${styleMap(this.styles[i.id])}"
          x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
          x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
          pathLength="240"
          >
          </line>
          `]:[""]),svg`
    ${t}
    <rect class='fill--rect'
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      id=${`fill-rect-${this.id}-`+s}
      fill=${i} height="100%" width="100%"
      mask=${`url(#fill-${this.id}-${s})`}
    />
    ${e}
    `}renderSvgAreaMinMaxBackground(i,s){if(["area","line"].includes(this.config.sparkline.show.chart_type)&&i)return i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.intColor(this._card.entities[s].state,s),svg`
    <rect class='fill--rect'
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      id=${`fill-rect-${this.id}-`+s}
      fill=${i} height="100%" width="100%"
      mask=${`url(#fillMinMax-${this.id}-${s})`}
    />`}renderSvgEqualizerMask(i,n){if("equalizer"===this.config.sparkline.show.chart_type&&i){let a="fade"===this.config.sparkline.show.fill;this.id;var s=`url(#fill-grad-mask-pos-${this.id}-${n}})`;let r=this.config.sparkline.styles.bar_mask_below.fill,h=this.config.sparkline.styles.bar_mask_above.fill,l;if(!0===this.config.sparkline.equalizer.square&&(l=Math.min(i[0].width,i[0].height))<i[0].height){let e=(this.svg.height-this.config.sparkline.equalizer.value_buckets*l)/(this.config.sparkline.equalizer.value_buckets-1);i=[...i.map((s,i)=>{var t={...s};for(let i=0;i<s.y.length;i++)t.y[i]=this.svg.height-i*(l+e);return t.width=l,t.height=l,t})]}i=i.map((e,i)=>{var s=e.value.map((i,s)=>{var t=this.config.sparkline.animate?svg`
        <animate attributeName='y'
          from=${this.svg.height} to=${e.y[s]-+e.height-this.svg.line_width}
          begin='0s' dur='2s' fill='remove' restart='whenNotActive' repeatCount='1'
          calcMode='spline' keyTimes='0; 1' keySplines='0.215 0.61 0.355 1'>
        </animate>`:"";return svg`
      <rect class="${classMap(this.classes.equalizer_part)}"
            style="${styleMap(this.styles.equalizer_part)}"
        data-size=${l}
        x=${e.x}
        y=${e.y[s]-e.height-this.svg.line_width/1e5}
        height=${Math.max(1,e.height-this.svg.line_width)}
        width=${Math.max(1,e.width-this.svg.line_width)}
        fill=${a?0<e.value?h:r:"white"}
        stroke=${a?0<e.value?h:r:"white"}
        stroke-width="${this.svg.line_width||0}"
        rx="0%"
        style="transition: fill 5s ease;"
        @mouseover=${()=>this.setTooltip(n,s,i)}
        @mouseout=${()=>this.tooltip={}}>
        ${this._firstUpdatedCalled?t:""}
      </rect>`});return svg`
      ${s}`});return svg`
    <defs>
      <linearGradient id=${`fill-grad-pos-${this.id}-`+n} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='25%' stop-opacity='0.4'/>
        <stop stop-color='white' offset='60%' stop-opacity='0.0'/>
      </linearGradient>
      <linearGradient id=${`fill-grad-neg-${this.id}-`+n} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color='white' offset='40%' stop-opacity='0'/>
        <stop stop-color='white' offset='75%' stop-opacity='0.4'/>
        <stop stop-color='white' offset='100%' stop-opacity='1.0'/>
      </linearGradient>

      <mask id=${`fill-grad-mask-pos-${this.id}-`+n}>
        <rect width="100%" height="100%"}
      </mask>
    </defs>  
    <mask id=${`equalizer-bg-${this.id}-`+n}>
      ${i}
      mask = ${s}
    </mask>
  `}}renderSvgBarsMask(i,h){if("bar"===this.config.sparkline.show.chart_type&&i){let e="fade"===this.config.sparkline.show.fill;this.id;var s=`url(#fill-grad-mask-pos-${this.id}-${h}})`;let a=this.config.sparkline.styles.bar_mask_below.fill,r=this.config.sparkline.styles.bar_mask_above.fill;i=i.map((i,s)=>{var t=this.config.sparkline.animate?svg`
        <animate attributeName='y' from=${this.svg.height} to=${i.y} dur='2s' fill='remove'
          calcMode='spline' keyTimes='0; 1' keySplines='0.215 0.61 0.355 1'>
        </animate>`:"";return svg` 

      <rect class='bar' x=${i.x} y=${i.y+(0<i.value?+this.svg.line_width/2:-this.svg.line_width/2)}
        height=${Math.max(1,i.height-+this.svg.line_width)} width=${i.width}
        fill=${e?0<i.value?r:a:"white"}
        stroke=${e?0<i.value?r:a:"white"}
        stroke-width="${this.svg.line_width||0}"
        @mouseover=${()=>this.setTooltip(h,s,i.value)}
        @mouseout=${()=>this.tooltip={}}>
        ${this._firstUpdatedCalled?t:""}
      </rect>`});return svg`
    <defs>
      <linearGradient id=${`fill-grad-pos-${this.id}-`+h} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color='white' offset='0%' stop-opacity='1'/>
        <stop stop-color='white' offset='25%' stop-opacity='0.4'/>
        <stop stop-color='white' offset='60%' stop-opacity='0.0'/>
      </linearGradient>
      <linearGradient id=${`fill-grad-neg-${this.id}-`+h} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color='white' offset='40%' stop-opacity='0'/>
        <stop stop-color='white' offset='75%' stop-opacity='0.4'/>
        <stop stop-color='white' offset='100%' stop-opacity='1.0'/>
      </linearGradient>

      <mask id=${`fill-grad-mask-pos-${this.id}-`+h}>
        <rect width="100%" height="100%"}
      </mask>
    </defs>  
    <mask id=${`bars-bg-${this.id}-`+h}>
      ${i}
      mask = ${s}
    </mask>
  `}}renderSvgEqualizerBackground(i,s){var t,e;if("equalizer"===this.config.sparkline.show.chart_type&&i)return"fadenever"===this.config.sparkline.show.fill?(this.length[s]||this._card.config.entities[s].show_line,i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.intColor(this._card.entities[s].state,s),this.gradient[s]?this.id:this.intColor(this._card.entities[s].state,s),svg`
      <defs>
        <linearGradient id=${`fill-grad-${this.id}-`+s} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stop-color='white' offset='0%' stop-opacity='1'/>
          <stop stop-color='white' offset='100%' stop-opacity='.1'/>
        </linearGradient>

        <mask id=${`fill-grad-mask-${this.id}-`+s}>
          <rect width="100%" height="100%" fill=${`url(#fill-grad-${this.id}-${s})`}
        </mask>
      </defs>

      <g mask = ${`url(#fill-grad-mask-${this.id}-${s})`}>
        <rect class='equalizer--bg'
          ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
          id=${`equalizer-bg-${this.id}-`+s}
          fill=${i} height="100%" width="100%"
          mask=${`url(#equalizer-bg-${this.id}-${s})`}
        />
      /g>`):(i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.computeColor(this._card.entities[s].state,s),t=this.xLines.lines.map(i=>"below"===i.zpos?[svg`
            <line class=${classMap(this.classes[i.id])}) style="${styleMap(this.styles[i.id])}"
            x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
            x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
            pathLength="240"
            >
            </line>
            `]:[""]),e=this.xLines.lines.map(i=>"above"===i.zpos?[svg`
            <line class="${classMap(this.classes[i.id])}"
                  style="${styleMap(this.styles[i.id])}"
            x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
            x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
            pathLength="240"
            >
            </line>
            `]:[""]),svg`
      ${t}
      <rect class='equalizer--bg'
        ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
        id=${`equalizer-bg-${this.id}-`+s}
        fill=${i} height="100%" width="100%"
        mask=${`url(#equalizer-bg-${this.id}-${s})`}
      />
      ${e}
      `)}renderSvgBarsBackground(i,s){if("bar"===this.config.sparkline.show.chart_type&&i)return"fadenever"===this.config.sparkline.show.fill?(this.length[s]||this._card.config.entities[s].show_line,i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.intColor(this._card.entities[s].state,s),this.gradient[s]?this.id:this.intColor(this._card.entities[s].state,s),svg`
      <defs>
        <linearGradient id=${`fill-grad-${this.id}-`+s} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stop-color='white' offset='0%' stop-opacity='1'/>
          <stop stop-color='white' offset='100%' stop-opacity='.1'/>
        </linearGradient>

        <mask id=${`fill-grad-mask-${this.id}-`+s}>
          <rect width="100%" height="100%" fill=${`url(#fill-grad-${this.id}-${s})`}
        </mask>
      </defs>

      <g mask = ${`url(#fill-grad-mask-${this.id}-${s})`}>
        <rect class='bars--bg'
          ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
          id=${`bars-bg-${this.id}-`+s}
          fill=${i} height="100%" width="100%"
          mask=${`url(#bars-bg-${this.id}-${s})`}
        />
      /g>`):(i=this.gradient[s]?`url(#grad-${this.id}-${s})`:this.computeColor(this._card.entities[s].state,s),svg`
      <rect class='bars--bg'
        ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
        id=${`bars-bg-${this.id}-`+s}
        fill=${i} height="100%" width="100%"
        mask=${`url(#bars-bg-${this.id}-${s})`}
      />`)}renderSvgBars(i,a){if(i)return i=i.map((i,s)=>{var t=this.config.sparkline.animate?svg`
        <animate attributeName='y' from=${this.svg.height} to=${i.y} dur='2s' fill='remove'
          calcMode='spline' keyTimes='0; 1' keySplines='0.215 0.61 0.355 1'>
        </animate>`:"",e=this.computeColor(i.value,a);return svg` 
      <rect class='bar' x=${i.x} y=${i.y}
        height=${i.height} width=${i.width} fill=${e}
        @mouseover=${()=>this.setTooltip(a,s,i.value)}
        @mouseout=${()=>this.tooltip={}}>
        ${this._firstUpdatedCalled?t:""}
      </rect>`}),svg`<g class='bars' ?anim=${this.config.sparkline.animate}>${i}</g>`}renderSvgRadialBarcodeBin(i,s,t){i=this.intColor(i.value,0);return svg`
  <path class="${classMap(this.classes.clock_graph)}"
        style="${styleMap(this.styles.clock_graph)}"
    d=${s}
    fill=${i}
    stroke=${i}
  >
  `}renderSvgRadialBarcodeBackgroundBin(i,s,t){return svg`
  <path class="${classMap(this.classes.radial_barcode_background)}"
        style="${styleMap(this.styles.radial_barcode_background)}"
    d=${s}
  >
  `}renderSvgRadialBarcodeBackground(i){var{start:s,end:t,start2:e,end2:a,largeArcFlag:r,sweepFlag:h}=this.Graph[0]._calcRadialBarcodeCoords(0,359.9,!0,i,i,this.radialBarcodeChartWidth),l={x:i-this.radialBarcodeChartWidth,y:i-this.radialBarcodeChartWidth},s=["M",s.x,s.y,"A",i,i,0,r,h,t.x,t.y,"L",a.x,a.y,"A",l.x,l.y,0,r,"0"===h?"1":"0",e.x,e.y,"Z"].join(" ");return svg`
    <path
      style="fill: lightgray; opacity: 0.4"
      d="${s}"
    />
  `}renderSvgRadialBarcodeFace(i){return this.config?.clock?.face?svg`
    ${!0===this.config.radial_barcode.face?.show_day_night?svg`
          <circle pathLength="1"
          class="${classMap(this.classes.radial_barcode_face_day_night)}" style="${styleMap(this.styles.radial_barcode_face_day_night)}"
          r="${this.svg.clockface.dayNightRadius}" cx=${this.svg.width/2} cy="${this.svg.height/2}"
          />
        `:""}
    ${!0===this.config.radial_barcode.face?.show_hour_marks?svg`
        <circle pathLength=${this.config.radial_barcode.face.hour_marks_count}
        class="${classMap(this.classes.radial_barcode_face_hour_marks)}" style="${styleMap(this.styles.radial_barcode_face_hour_marks)}"
        r="${this.svg.clockface.hourMarksRadius}" cx=${this.svg.width/2} cy="${this.svg.height/2}"
        />
       `:""}
    ${"absolute"===this.config.radial_barcode.face?.show_hour_numbers?svg`
        <g>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2}" y="${this.svg.height/2-this.svg.clockface.hourNumbersRadius}"
            >24</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2}" y="${this.svg.height/2+this.svg.clockface.hourNumbersRadius}"
            >12</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2+this.svg.clockface.hourNumbersRadius}" y="${this.svg.height/2}"
            >6</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2-this.svg.clockface.hourNumbersRadius}" y="${this.svg.height/2}"
            >18</text>
        </g>`:""}
    ${"relative"===this.config.radial_barcode.face?.show_hour_numbers?svg`
        <g>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2}" y="${this.svg.height/2-this.svg.clockface.hourNumbersRadius}"
            >0</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2}" y="${this.svg.height/2+this.svg.clockface.hourNumbersRadius}"
            >-12</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2+this.svg.clockface.hourNumbersRadius}" y="${this.svg.height/2}"
            >-18</text>
          <text class="${classMap(this.classes.radial_barcode_face_hour_numbers)}" style="${styleMap(this.styles.radial_barcode_face_hour_numbers)}"
            x="${this.svg.width/2-this.svg.clockface.hourNumbersRadius}" y="${this.svg.height/2}"
            >-6</text>

        </g>`:""}
  `:svg``}renderSvgRadialBarcode(i,s){if(i){let t=this.Graph[s].getRadialBarcodePaths(),e=this.Graph[s].getRadialBarcodeBackgroundPaths();return svg`
    <g class='graph-clock'
      ?tooltip=${this.tooltip.entity===s}
      ?inactive=${void 0!==this.tooltip.entity&&this.tooltip.entity!==s}
      ?init=${this.length[s]}
      anim=${this.config.sparkline.animate&&"hover"!==this.config.sparkline.show.points}
      style="animation-delay: ${this.config.sparkline.animate?.5*s+.5+"s":"0s"}"
      stroke-width=${this.svg.line_width/2}>
      ${this.radialBarcodeChartBackground[s].map((i,s)=>this.renderSvgRadialBarcodeBackgroundBin(i,e[s],s))}
      ${i.map((i,s)=>this.renderSvgRadialBarcodeBin(i,t[s],s))}
      ${this.renderSvgRadialBarcodeFace(this.svg.width/2-40)}
    </g>`}}renderSvgBarcode(i,l){var s,t;if(i)return i=i.map((i,s)=>{let t;"bin"===this.config.sparkline.state_values?.use_value?(e=Math.floor(i.value),this.gradeRanks[e]?.value?(e=this.gradeRanks[e].value[0]+(this.gradeRanks[e].rangeMax[0]-this.gradeRanks[e].rangeMin[0])*(i.value-e),t=this.intColor(e,0)):console.log("renderbarcode, illegal value",i.value)):t=this.intColor(i.value,0);var e=this.config.sparkline.animate?svg`
        <animate attributeName='x' from=${this.svg.margin.x} to=${i.x} dur='3s' fill='remove'
          calcMode='spline' keyTimes='0; 1' keySplines='0.215 0.61 0.355 1'>
        </animate>`:"",a=this.styles.barcode_graph?.rx||0,r=this.styles.barcode_graph?.ry||a,h=i.height-this.svg.margin.t-this.svg.margin.b-this.svg.line_width,h=h<1?-(1-h):0;return svg` 
      <!-- Barcode Part -->
      <rect class="${classMap(this.classes.barcode_graph)}"
            style="${styleMap(this.styles.barcode_graph)}"
        x=${i.x}
        y=${i.y+h+this.svg.margin.t-this.svg.margin.b+this.svg.line_width/2}
        height=${Math.max(1,i.height-this.svg.margin.t-this.svg.margin.b-this.svg.line_width)}
        width=${Math.max(i.width,1)}
        fill=${t}
        stroke=${t}
        stroke-width="${this.svg.line_width||0}"
        rx="${a}"
        ry="${r}"
        @mouseover=${()=>this.setTooltip(l,s,i.value)}
        @mouseout=${()=>this.tooltip={}}>
        ${this._firstUpdatedCalled?e:""}
      </rect>`}),s=this.xLines.lines.map(i=>"below"===i.zpos?[svg`
        <!-- Line Below -->
        <line class=${classMap(this.classes[i.id])} style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),t=this.xLines.lines.map(i=>"above"===i.zpos?[svg`
        <!-- Line Above-->
        <line class="${classMap(this.classes[i.id])}"
              style="${styleMap(this.styles[i.id])}"
        x1="${this.svg.margin.x}" y1="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        x2="${this.svg.graph.width+this.svg.margin.x}" y2="${this.svg.margin.y+this.svg.graph.height/2+i.yshift}"
        pathLength="240"
        >
        </line>
        `]:[""]),svg`
    <!-- Sparkline Barcode Render -->
    <g id="linesBelow">
      ${s}
    </g>
    <g id="BarcodeParts">
      ${i}
    </g>
    <g id="linesAbove">
      ${t}
    </g>
  `}renderSvg(){return 0<this.config.sparkline.colorstops.colors.length&&!this._card.config.entities[0].color&&(this.gradient[0]=this.Graph[0].computeGradient(this.config.sparkline.colorstops.colors,this.config.sparkline.state_values.logarithmic)),this.MergeAnimationClassIfChanged(),this.MergeAnimationStyleIfChanged(),svg`
    <svg width="${this.svg.width}" height="${this.svg.height}" overflow="visible"
      x="${this.svg.x}" y="${this.svg.y}"
    >
      <g>
        <!-- Sparkline Tool Gradient Defs -->
        <defs>
          ${this.renderSvgGradient(this.gradient)}
        </defs>
        <!-- Sparkline Tool Graph Area -->
        <svg viewbox="0 0 ${this.svg.width} ${this.svg.height}"
         overflow="visible"
        >
        ${this.area.map((i,s)=>this.renderSvgAreaMask(i,s))}
        ${this.area.map((i,s)=>this.renderSvgAreaBackground(i,s))}
        ${this.areaMinMax.map((i,s)=>this.renderSvgAreaMinMaxMask(i,s))}
        ${this.areaMinMax.map((i,s)=>this.renderSvgAreaMinMaxBackground(i,s))}
        ${this.line.map((i,s)=>this.renderSvgLineMask(i,s))}
        ${this.line.map((i,s)=>this.renderSvgLineBackground(i,s))}
        ${this.bar.map((i,s)=>this.renderSvgBarsMask(i,s))}
        ${this.bar.map((i,s)=>this.renderSvgBarsBackground(i,s))}
        ${this.equalizer.map((i,s)=>this.renderSvgEqualizerMask(i,s))}
        ${this.equalizer.map((i,s)=>this.renderSvgEqualizerBackground(i,s))}
        ${this.points.map((i,s)=>this.renderSvgPoints(i,s))}
        ${this.barcodeChart.map((i,s)=>this.renderSvgBarcode(i,s))}
        ${this.radialBarcodeChart.map((i,s)=>this.renderSvgRadialBarcode(i,s))}
        ${this.graded.map((i,s)=>this.renderSvgGraded(i,s))}
        </svg>
      </g>
    </svg>`}updated(i){this.config.sparkline.animate&&i.has("line")&&(this.length.length<this.entity.length?(this._card.shadowRoot.querySelectorAll("svg path.line").forEach(i=>{this.length[i.id]=i.getTotalLength()}),this.length=[...this.length]):this.length=Array(this.entity.length).fill("none"))}render(){return svg`
        <!-- Sparkline Tool Render -->
        <g
          id="sparkline-${this.toolId}"
          class="${classMap(this.classes.tool)}" style="${styleMap(this.styles.tool)}"
          @click=${i=>this.handleTapEvent(i,this.config)}>
          ${this.renderSvg()}
        </g>
      `}}