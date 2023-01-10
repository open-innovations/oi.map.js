/**
  OI Leeds Tiny Slippy Map
  Plugin for overlays (e.g. GeoJSON)
  Version 0.1.5
  Changelog:
  - 0.1.5:
    - Add getBounds() to GeoJSON layer
**/
// jshint esversion: 6
(function(root){
		
	function svgEl(t){ return document.createElementNS(ns,t); }
	var OI = root.OI || {};
	function renameProps(props,names){
		for(var n in names){
			if(props[n]!=null){
				props[names[n]] = props[n];
				delete props[n];
			}
		}
		return props;
	}
	if(OI.map){
		var ns = 'http://www.w3.org/2000/svg';
		OI.map.prototype.register('overlay',{
			'version':'0.1.4',
			'exec':function(_map){
				function Thing(feature,m){
					this.bindPopup = function(txt){
						this._popuptext = txt;
						if(feature.marker) this._el = feature.marker._el.querySelector('path');
						else if(feature._svg) this._el = feature._svg;
						OI._addEvent('click',this._el,{'popup':txt,el:this._el,this:this},function(e){
							popup.bindPopup(e.data.popup).addTo(m.panes.p.popup.el).setTarget(this._el).openPopup().setPosition(e.target);
						});
						return this;
					};
					return this;
				}
				function Popup(){
					this.open = false;
					this.bindPopup = function(txt){
						this.txt = txt;
						return this;
					};
					this.openPopup = function(){
						if(!this.pane) return this;
						var p = this.pane.querySelector('.oi-map-popup');
						if(p) p.parentNode.removeChild(p);
						p = document.createElement('div');
						p.classList.add('oi-map-popup');
						this.pane.appendChild(p);
						p.innerHTML = '<div class="oi-map-popup-inner">'+this.txt+'</div>';
						this.p = p;
						this.open = true;
						return this;
					};
					this.addTo = function(el){
						this.pane = el;
						return this;
					};
					this.setTarget = function(el){
						if(el) this._target = el;
						return this;
					};
					this.setPosition = function(el){
						if(this.p && this.open){
							var bb = this._target.getBoundingClientRect();
							var bbo = this.pane.getBoundingClientRect();
							OI._setAttr(this.p,{'style':'top:'+(bb.top-bbo.top).toFixed(1)+'px;left:'+(bb.left-bbo.left+bb.width/2).toFixed(1)+'px;'});
						}
						return this;
					};
					return this;
				}
				var popup = new Popup();
				class marker extends _map.Layer {
					constructor(ll,attr,pane){
						super(attr,pane);
						this._ll = ll||OI.map.LatLon();
						this._el = svgEl('svg');
						this._el.innerHTML = attr.svg;
						OI._setAttr(this._el,{'overflow':'visible','width':'1','height':'1'});
					}
					addTo(m){
						this._map = m;
						var p = this._attr.pane;
						if(!m.panes.p[p]) return m.log('ERROR','No pane %c'+p+'%c exists.','font-style:italic;','');
						m.panes.p[p].el.appendChild(this._el);
						m.panes.p[p].layers.push(this);
						this.setLatLon(this._ll);
						return this;
					}
					update(bounds,z){
						return this.setLatLon(this._ll,bounds.getCenter().toPx(z));
					}
					setLatLon(ll,offset){
						var z,xy;
						z = this._map.getZoom();
						if(!offset) offset = this._map.getCenter().toPx(z);
						xy = ll.toPx(z);
						OI._setAttr(this._el,{'class':'oi-map-marker','style':'transform:translate3d('+(xy.x-offset.x)+'px,'+(xy.y-offset.y)+'px,0)'});
						return this;
					}
					bindPopup(txt){
						this._popup = txt;
						OI._addEvent('click',this._el,{'popup':txt,this:this},function(e){
							popup.bindPopup(this._popup).addTo(this._map.panes.p.popup.el).setTarget(this._el.childNodes[0]).openPopup().setPosition(e.target);
						});
						return this;
					}
					openPopup(){
						var ev = document.createEvent('HTMLEvents');
						ev.initEvent('click', true, false);
						this._el.dispatchEvent(ev);
						return this;
					}
				}
				class geoJSONLayer extends _map.Layer {
					constructor(json,attr,pane){
						super(attr,pane);
						this._json = json||{};
						this._attr = attr || {};
					}
					addTo(m){
						var p,l;
						this._map = m;
						p = this._attr.pane;
						if(!m.panes.p[p]) return m.log('ERROR','No pane %c'+p+'%c exists.','font-style:italic;','');

						this._el = m.panes.p[p].el.querySelector('.oi-map-layer');
						if(!this._el){
							l = document.createElement('div');
							l.classList.add('oi-map-layer');
							m.panes.p[p].el.appendChild(l);
							this._el = l;

							// Create the SVG element
							this._svg = svgEl('svg');
							OI._setAttr(this._svg,{'overflow':'visible','preserveAspectRatio':'xMinYMin meet','vector-effect':'non-scaling-stroke'});
							this._el.appendChild(this._svg);
						}else{
							this._svg = this._el.querySelector('svg');
						}

						m.panes.p[p].el.appendChild(this._el);
						m.panes.p[p].layers.push(this);
						// Update the view
						this.update(this._map.getBounds(),this._map.getZoom());
					}
					getBounds(m){
						var f,g,c,b,lat,lon,geometry,i,j,k;
						lat = {'max':-90,'min':90};
						lon = {'max':-180,'min':180};
						for(f = 0; f < this._json.features.length; f++){
							g = this._json.features[f].geometry;
							c = g.coordinates;
							if(g.type=="Point"){
								lat.max = Math.max(c[1],lat.max);
								lon.max = Math.max(c[0],lon.max);
								lat.min = Math.min(c[1],lat.min);
								lon.min = Math.min(c[0],lon.min);
							}else{
								for(i = 0; i < c.length; i++){
									for(j = 0; j < c[i].length; j++){
										if(g.type=="Polygon"){
											lat.max = Math.max(c[i][j][1],lat.max);
											lon.max = Math.max(c[i][j][0],lon.max);											
											lat.min = Math.min(c[i][j][1],lat.min);
											lon.min = Math.min(c[i][j][0],lon.min);
										}else if(g.type=="MultiPolygon"){
											for(k = 0; k < c[i][j].length; k++){
												lat.max = Math.max(c[i][j][k][1],lat.max);
												lon.max = Math.max(c[i][j][k][0],lon.max);
												lat.min = Math.min(c[i][j][k][1],lat.min);
												lon.min = Math.min(c[i][j][k][0],lon.min);
											}
										}
									}
								}
							}
						}
						return this._map.Bounds(this._map.LatLon(lat.max,lon.max),this._map.LatLon(lat.min,lon.min));
					}
					update(bounds,z){
						var offset,f,xy,nw,se,el,c,i,j,k,d,props,style,defaults,attr,g,offs;
						// Get tile x/y of centre
						offset = bounds.getCenter().toPx(z);
						nw = bounds.nw.toPx(z);
						se = bounds.se.toPx(z);
						defaults = {'opacity':1,'fillOpacity':0.2,'weight':3,'color':'#3388ff','stroke':true};
						OI._setAttr(this._svg,{'viewBox':((nw.x-offset.x).toFixed(3)+' '+(nw.y-offset.y).toFixed(3)+' '+(se.x-nw.x).toFixed(3)+' '+(se.y-nw.y).toFixed(3))});
						for(f = 0; f < this._json.features.length; f++){
							props = {};
							style = {};
							if(typeof this._attr.style==="function") style = this._attr.style.call(this,this._json.features[f])||{};
							else if(typeof this._attr.style==="object") style = this._attr.style;

							// Extend
							props = Object.assign({}, defaults, style);

							g = this._json.features[f].geometry;
							c = g.coordinates;
							if(g.type=="Point"){
								xy = this._map.LatLon(c[1],c[0]).toPx(z);
								offs = (xy.x-offset.x)+' '+(xy.y-offset.y);
								if(!this._json.features[f]._svg){
									el = svgEl('g');
									el.innerHTML = '<path d="M 0 0 L -10.84,-22.86 A 12 12 1 1 1 10.84,-22.86 L 0,0 z" fill="'+props.color+'" fill-opacity="1"></path><ellipse cx="0" cy="-27.5" rx="4" ry="4" fill="white"></ellipse>';
									this._svg.appendChild(el);
									this._json.features[f]._svg = el;
								}
								props.transform = "translate("+offs+")";
								props.fill = true;
								props.fillOpacity = 1;
							}else if(g.type=="Polygon"){
								if(!this._json.features[f]._svg){
									el = svgEl('path');
									this._svg.appendChild(el);
									this._json.features[f]._svg = el;					
								}
								// Make the path
								d = '';
								for(i = 0; i < c.length; i++){
									for(j = 0; j < c[i].length; j++){
										xy = this._map.LatLon(c[i][j][1],c[i][j][0]).toPx(z);
										d += (j==0 ? 'M':'L')+' '+(xy.x-offset.x)+' '+(xy.y-offset.y);
									}
								}
								props.d = d;
								props.fill = true;
							}else if(g.type=="LineString"){
								if(!this._json.features[f]._svg){
									el = svgEl('path');
									OI._setAttr(el,{'r':5,stroke:'black','stroke-width':1,fill:'none'});
									this._svg.appendChild(el);
									this._json.features[f]._svg = el;								
								}
								// Make the points
								d = '';
								for(i = 0; i < c.length; i++){
									xy = this._map.LatLon(c[i][1],c[i][0]).toPx(z);
									d += (i==0 ? 'M':'L')+(xy.x-offset.x)+' '+(xy.y-offset.y);
								}
								props.d = d;
								props.fill = false;
							}else if(g.type=="MultiLineString"){
								if(!this._json.features[f]._svg){
									el = svgEl('path');
									OI._setAttr(el,{'r':5,stroke:'black','stroke-width':1,fill:'none'});
									this._svg.appendChild(el);
									this._json.features[f]._svg = el;								
								}
								// Make the points
								d = '';
								for(i = 0; i < c.length; i++){
									for(j = 0; j < c[i].length; j++){
										xy = this._map.LatLon(c[i][j][1],c[i][j][0]).toPx(z);
										d += (j==0 ? 'M':'L')+(xy.x-offset.x)+' '+(xy.y-offset.y);
									}
								}
								props.d = d;
								props.fill = false;
							}else if(g.type=="MultiPolygon"){
								if(!this._json.features[f]._svg){
									el = svgEl('path');
									this._svg.appendChild(el);
									this._json.features[f]._svg = el;								
								}
								// Make the path
								d = '';
								for(i = 0; i < c.length; i++){
									for(j = 0; j < c[i].length; j++){
										if(c[i][j].length != 2){
											for(k = 0; k < c[i][j].length; k++){
												xy = this._map.LatLon(c[i][j][k][1],c[i][j][k][0]).toPx(z);
												d += (k==0 ? 'M':'L')+' '+(xy.x-offset.x)+' '+(xy.y-offset.y);
											}
										}
									}
								}
								props.d = d;
								props.fill = true;
							}
							if(this._json.features[f]._svg){
								if(props.fill && !props.fillColor) props.fillColor = props.color+'';
								props = renameProps(props,{'fillColor':'fill','color':'stroke','opacity':'stroke-opacity','fillOpacity':'fill-opacity','weight':'stroke-width'});
								if(props.title) this._json.features[f]._svg.innerHTML = '<title>'+props.title+'</title>';
								OI._setAttr(this._json.features[f]._svg,props);
							}
							if(!this._json.features[f]._added && typeof this._attr.onEachFeature==="function"){
								this._json.features[f]._thing = new Thing(this._json.features[f],this._map);
								this._attr.onEachFeature.call(this,this._json.features[f],this._json.features[f]._thing);
								this._json.features[f]._added = true;
							}
						}
						popup.setPosition();
					}
				}
				OI.map.geoJSON = function(geo,attr){
					if(!attr) attr = {};
					if(!attr.pane) attr.pane = 'overlay';	// default pane
					return new geoJSONLayer(geo,attr);
				};
				OI.map.marker = function(ll,attr){
					if(!attr) attr = {};
					if(!attr.pane) attr.pane = 'marker';	// default pane
					return new marker(ll,attr);
				};
			}
		});
	}

	root.OI = OI;
})(window || this);
