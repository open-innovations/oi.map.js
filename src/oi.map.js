/**
  OI Leeds Tiny Slippy Map
  Version 0.1.9
  
  Changelog:
  0.1.9:
    - Stop zoom buttons propagating events
    - Add events with .on()
    - Add .setCenter() function to centre the map
    - bug fixes for boundary/limits
  0.1.8:
    - Limit to minZoom/maxZoom set in tile tile layers
	- Add .getBounds() to Layer
**/
// jshint esversion: 6
(function(root){
	var OI = root.OI || {};
	if(!OI.ready){
		OI.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}

	// Define some constants
	var sz = 256;
	var PI = Math.PI;
	var plugins = {};

	function Map(el,attr){
		var title = "OI Map";
		var events = {};
		this.version = "0.1.9";
		this.logging = (location.search.indexOf('debug=true') >= 0);
		this.log = function(){
			// Version 1.2
			var a = arguments;
			if(this.logging || a[0]=="ERROR" || a[0]=="WARNING"){
				var args = Array.prototype.slice.call(a, 0);
				// Build basic result
				var extra = ['%c'+title+' '+this.version+'%c: '+args[1],'font-weight:bold;',''];
				// If there are extra parameters passed we add them
				if(args.length > 2) extra = extra.concat(args.splice(2));
				if(console && typeof console.log==="function"){
					if(a[0] == "ERROR") console.error.apply(null,extra);
					else if(a[0] == "WARNING") console.warn.apply(null,extra);
					else if(a[0] == "INFO") console.info.apply(null,extra);
					else console.log.apply(null,extra);
				}
			}
			return this;
		};
		if(!el || !el.tagName){ this.log('WARNING','No DOM element provided'); return this; }
		if(!attr) attr = {};
		if(!attr.center) attr.center = [0,0];
		if(typeof attr.maxZoom!=="number") attr.maxZoom = 19;
		if(typeof attr.minZoom!=="number") attr.minZoom = 3;
		if(typeof attr.zoom!=="number") attr.zoom = 12;
		if(typeof attr.scrollWheelZoom!=="boolean") attr.scrollWheelZoom = true;
		if(typeof attr.zoomControl!=="boolean") attr.zoomControl = true;
		if(typeof attr.attributionControl!=="boolean") attr.attributionControl = true;
		var center,zoom,bounds,p,drag,resizeO,startdrag,init;
		drag = init = false;
		this.panes = { 'el':document.createElement('div'),'p':{ 'tile':{},'overlay':{},'marker':{},'labels':{},'popup':{} } };
		this.controls = {};
		this.addPane = function(p){
			if(!this.panes.p[p] || !this.panes.p[p].el){
				var pane = document.createElement('div');
				pane.classList.add('oi-map-pane','oi-map-pane-'+p);
				this.panes.p[p] = {'el':pane,'layers':[]};
				add(pane,this.panes.el);
			}
			return this;
		};
		this.updateLayers = function(b,zoom){
			if(typeof zoom!=="number") zoom = this.getZoom();
			if(!b) b = this.getBounds();
			bounds = b;
			var p,l,pos,a,attr;
			pos = {x:0,y:0};
			attr = '';
			for(p in this.panes.p){
				if(this.panes.p[p]){
					for(l in this.panes.p[p].layers){
						if(this.panes.p[p].layers[l]){
							this.panes.p[p].layers[l].update(bounds,zoom);
							a = this.panes.p[p].layers[l]._attr.attribution;
							if(a && attr.indexOf(a)<0) attr += (attr?' ':'')+a;
						}
					}
				}
			}
			if(this.controls.credit) this.controls.credit.innerHTML = attr+(attr?' | ':'')+title;
			this.trigger({'type':'updated'});
			return this;
		};
		this.getZoom = function(){ return zoom; };
		this.setZoom = function(z,noupdate){

			// Limit zoom to the maximum allowed by the tile layers
			var minZoom = attr.minZoom;
			var maxZoom = attr.maxZoom;
			if(this.panes.p.tile){
				for(l in this.panes.p.tile.layers){
					maxZoom = Math.min(maxZoom,this.panes.p.tile.layers[l]._attr.maxZoom||attr.maxZoom);
					minZoom = Math.max(minZoom,this.panes.p.tile.layers[l]._attr.minZoom||attr.minZoom);
				}
			}
			zoom = Math.max(Math.min(z,maxZoom),minZoom);
			bounds = this.getBounds();
			if(!noupdate) this.updateLayers(bounds,zoom);
			return this;
		};
		this.zoomIn = function(n){ return this.setZoom(zoom+n); };
		this.zoomOut = function(n){ return this.setZoom(zoom-n); };
		this.getCenter = function(){ return center; };
		this.getBounds = function(){
			var dy,dx,tile;
			dy = el.offsetHeight/(2*sz);
			dx = el.offsetWidth/(2*sz);
			tile = center.toTile(zoom);
			return Bounds(Tile(tile.x-dx,tile.y+dy).toLatLon(zoom),Tile(tile.x+dx,tile.y-dy).toLatLon(zoom));
		};
		function MaxBounds(_obj){
			var bnd,l;
			var b = {'se': {'lon':180,'lat':-90},'nw':{'lon':-180,'lat':90}};
			if(_obj.panes.p.tile){
				for(l in _obj.panes.p.tile.layers){
					if(_obj.panes.p.tile.layers[l]._attr.bounds){
						bnd = _obj.panes.p.tile.layers[l]._attr.bounds;
						if(bnd.nw && bnd.se){
							b.nw.lat = Math.min(b.nw.lat,bnd.nw.lat);
							b.se.lat = Math.max(b.se.lat,bnd.se.lat);
							b.nw.lon = Math.max(b.nw.lon,bnd.nw.lon);
							b.se.lon = Math.min(b.se.lon,bnd.se.lon);
						}
					}
				}
			}
			return b;
		}
		// e.g. fitBounds([[54.559322, -5.767822], [56.1210604, -3.021240]]);
		// or fitBounds({'se': {'lon': -1.6142865,'lat': 53.8263603},'nw': {'lon': -1.6725412,'lat': 53.8580877}});
		this.fitBounds = function(b){
			var dy,dx,z,nw,se,dlat,dlon,tcen;
			bounds = (this, (!b) ? this.getBounds() : (b.nw ? b : Bounds({'lat':b[0][0],'lon':b[0][1]},{'lat':b[1][0],'lon':b[1][1]})));
			center = bounds.getCenter();

			dy = el.offsetHeight/(2*sz);
			dx = el.offsetWidth/(2*sz);
			for(z = attr.minZoom; z <= attr.maxZoom; z++){
				tcen = center.toTile(z);
				nw = Tile(tcen.x-dx,tcen.y-dy).toLatLon(z);
				se = Tile(tcen.x+dx,tcen.y+dy).toLatLon(z);
				if(!(nw.lat > bounds.nw.lat && nw.lon < bounds.nw.lon && se.lat < bounds.se.lat && se.lon > bounds.se.lon)){
					z--;
					break;
				}
			}
			this.setZoom(z,false);
			return this;
		};
		this.panBy = function(p,attr){
			if(!attr) attr = {'animate':false,duration:0.25};
			center = center.toTile(zoom).shift(p).toLatLon(zoom);
			return this.updateLayers();
		};
		this.setCenter = function(c){
			center = LatLon(c[0],c[1]);
			return this.updateLayers();
		};
		this.addControl = function(name,cls,html){
			if(!this.controls[name]){
				this.controls[name] = document.createElement('div');
				add(this.controls[name],el);
			}
			this.controls[name].classList.add(...cls.split(/ /));
			if(html) this.controls[name].innerHTML = html;
			return this.controls[name];
		};

		center = LatLon(attr.center[0],attr.center[1]);

		// Set the default zoom level
		this.setZoom(attr.zoom,true);

		// Add style to map
		el.classList.add('oi-map');
		this.panes.el.classList.add('oi-map-panes');
		add(this.panes.el,el);

		// Add attribution
		if(attr.attributionControl) this.addControl('credit','oi-map-control oi-map-attribution oi-map-bottom oi-map-right','');
		if(attr.zoomControl){
			this.addControl('zoom','oi-map-control oi-map-zoom oi-map-top oi-map-left','<button class="oi-map-zoom-in" title="Zoom in">+</button><button class="oi-map-zoom-out" title="Zoom out">−</button>');
			addEvent('click',this.controls.zoom.querySelector('.oi-map-zoom-in'),{this:this},function(e){ this.zoomIn(1); });
			addEvent('click',this.controls.zoom.querySelector('.oi-map-zoom-out'),{this:this},function(e){ this.zoomOut(1); });
		}
		// Build panes
		for(p in this.panes.p){
			if(this.panes.p[p]) this.addPane(p);
		}

		// Update layers on resize
		resizeO = new ResizeObserver(entries => { if(init) this.updateLayers(); });
		resizeO.observe(this.panes.el);

		startdrag = {};
		// Add events
		this.trigger = function(e){
			if(typeof e.preventDefault==="function"){
				e.preventDefault();
				e.stopPropagation();
			}
			var ev = e.type;
			var props = {};
			if(ev=="pointerdown"){
				drag = true;
				startdrag = {x:e.pageX,y:e.pageY};
				props.startdrag = startdrag;
			}else if(ev=="pointerup"){
				drag = false;
			}else if((ev=="pointermove" || ev=="touchmove") && drag){
				var f = (ev=="touchmove" ? e.touches[0] : e);
				var delta = {x:startdrag.x - f.pageX,y:startdrag.y - f.pageY};
				this.panBy(delta);
				startdrag = {x:f.pageX,y:f.pageY};
				props.startdrag = startdrag;
			}else if(ev=="wheel" && attr.scrollWheelZoom){
				e.wheel = e.deltaY ? -e.deltaY : e.wheelDelta/40;
				this.setZoom(zoom+(e.wheel >= 0 ? 1 : -1));
			}
			if(events[ev]){
				for(var i = 0; i < events[ev].length; i++){
					if(typeof events[ev][i]==="function") events[ev][i].call(this,props);
				}
			}
		};
		addEvent('wheel',this.panes.el,{this:this,p:p},this.trigger);
		addEvent('pointerdown',this.panes.el,{this:this,p:p},this.trigger);
		addEvent('pointerup',this.panes.el,{this:this,p:p},this.trigger);
		if(('ontouchstart' in document.documentElement)) addEvent('touchmove',this.panes.el,{this:this,p:p},this.trigger);
		else addEvent('pointermove',this.panes.el,{this:this,p:p},this.trigger);

		this.on = function(typ,cb){
			if(!events[typ]) events[typ] = new Array();
			events[typ].push(cb);
		}
		
		this.Layer = Layer;
		this.Bounds = Bounds;
		this.LatLon = LatLon;
		this.Tile = Tile;

		// Execute plugins
		for(p in plugins){
			if(plugins[p]) plugins[p].exec(this);
		}
		init = true;
		return this;
	}
	Map.prototype.register = function(name,p){
		if(plugins[name]) this.log('WARNING','Plugin '+name+' already exists');
		if(typeof p.exec==="function") plugins[name] = p;
		return this;
	};
	class bound {
		constructor(a,b){
			this.nw = LatLon(Math.max(a.lat,b.lat),Math.min(a.lon,b.lon));
			this.se = LatLon(Math.min(a.lat,b.lat),Math.max(a.lon,b.lon));
		}
		getCenter(){ return LatLon((this.nw.lat-this.se.lat)/2 + this.se.lat, (this.se.lon-this.nw.lon)/2 + this.nw.lon); }
	}
	class ll {
		constructor(lat,lon){
			this.lat = lat;
			this.lon = lon;
		}
		toXY(z){
			return {x:((this.lon+180)/360*Math.pow(2,z)),y:((1-Math.log(Math.tan(this.lat*PI/180) + 1/Math.cos(this.lat*PI/180))/PI)/2 *Math.pow(2,z))};
		}
		toTile(z){
			var xy = this.toXY(z);
			return Tile(xy.x,xy.y);
		}
		toPx(z){
			var xy = this.toXY(z);
			return {x:Math.round(xy.x*sz),y:Math.round(xy.y*sz)};
		}
	}
	class tile {
		constructor(x,y){
			this.x = x;
			this.y = y;
			this.xint = Math.floor(this.x);
			this.yint = Math.floor(this.y);
			return this;
		}
		shift(p){
			this.x += p.x/sz;
			this.y += p.y/sz;
			this.xint = Math.floor(this.x);
			this.yint = Math.floor(this.y);
			return this;
		}
		toLatLon(z){
			var n = PI-2*PI*this.y/Math.pow(2,z);
			return LatLon((180/PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))),(this.x/Math.pow(2,z)*360-180));
		}
		getTranslate(offset){ if(!offset) offset = {x:0,y:0}; return 'translate3d('+((this.x-offset.x)*sz)+'px,'+((this.y-offset.y)*sz)+'px,0)'; }
	}
	function LimitBounds(_obj,bounds){
		var bnd,l,b;
		b = Bounds(bounds.nw,bounds.se);
		if(_obj._attr.bounds){
			bnd = _obj._attr.bounds;
			if(bnd.nw && bnd.se){
				b.nw.lat = Math.min(b.nw.lat,bnd.nw.lat);
				b.se.lat = Math.max(b.se.lat,bnd.se.lat);
				b.nw.lon = Math.max(b.nw.lon,bnd.nw.lon);
				b.se.lon = Math.min(b.se.lon,bnd.se.lon);
			}
		}
		return b;
	}
	function LatLon(lat,lon){ return new ll(lat||0,lon||0); }
	function Bounds(a,b){ return new bound(a||LatLon(),b||LatLon()); }
	function Tile(x,y){ return new tile(x||0,y||0); }
	class Layer {
		constructor(attr,pane){
			this._attr = attr || {};
			return this;
		}
		addTo(m){
			this._map = m;
			var p = this._attr.pane;
			if(!m.panes.p[p]) return m.log('ERROR','No pane %c'+p+'%c exists.','font-style:italic;','');
			this._el = document.createElement('div');
			this._el.classList.add('oi-map-layer');
			m.panes.p[p].el.appendChild(this._el);
			m.panes.p[p].layers.push(this);
			this.update(this._map.getBounds(),this._map.getZoom());
			return this;
		}
		getBounds(m){
			return null;
		}
		update(bounds,z){
			return this;
		}
	}
	class TileLayer extends Layer {
		constructor(url,attr){
			super(attr);
			this._url = url||"";
			this._tiles = {};
		}
		update(bounds,z){
			var urls,n,u,id,offset;
			// Get tile x/y of centre
			offset = bounds.getCenter().toTile(z);
			urls = this.getTiles(bounds,z);
			n = Math.pow(2,z);
			for(u = 0; u < urls.length; u++){
				id = z+'/'+urls[u].tile.x+'/'+urls[u].tile.y;
				if(!this._tiles[id]){
					this._tiles[id] = {el:document.createElement('img'),'tile':urls[u].tile,'z':urls[u].z};
					this._tiles[id].el.classList.add('oi-map-tile');
					this._tiles[id].el.setAttribute('loading',"lazy");
					setAttr(this._tiles[id].el,{'id':id,'src':urls[u].url});
					this._tiles[id].el.style.width = sz+"px";
					this._tiles[id].el.style.height = sz+"px";
				}
				this._tiles[id].el.style.transform = urls[u].tile.getTranslate(offset);
				add(this._tiles[id].el,this._el);
			}
			for(id in this._tiles){
				if(this._tiles[id].z != z && this._tiles[id].el){
					this._tiles[id].el.parentNode.removeChild(this._tiles[id].el);
					delete this._tiles[id];
				}
			}
			return this;
		}
		// Adapted from: https://gist.github.com/mourner/8825883
		getTiles(bounds,z){
			var min,max,urls,x,y,s,subs,turl;
			if(!this._attr.subdomains) this._attr.subdomains = 'abc';
			subs = this._attr.subdomains.length;
			min = bounds.nw.toTile(z);
			max = bounds.se.toTile(z);
			urls = [];
			var limit = LimitBounds(this,bounds);
			var limitmin = limit.nw.toTile(z);
			var limitmax = limit.se.toTile(z);
			if(z<=this._attr.maxZoom && z>=(this._attr.minZoom||1)){
				for(x = min.xint; x <= max.xint; x++){
					if(subs > 0) s = x%subs;
					for(y = min.yint; y <= max.yint; y++){
						if(x < limitmin.xint || x > limitmax.xint || y < limitmin.yint || y > limitmax.yint){
							turl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";
						}else{
							turl = this._url.replace(/\{z\}/g,z).replace(/\{y\}/g,y).replace(/\{x\}/g,x).replace(/\{r\}/g,(window.devicePixelRatio > 1 ? '@2x':''));
							if(subs > 0) turl = turl.replace(/\{s\}/g,this._attr.subdomains[s]);
						}
						urls.push({'url':turl,z:z,'tile':Tile(x,y)});
					}
				}
			}
			return urls;
		}
	}
	function add(el,to){ return to.appendChild(el); }
	function setAttr(el,prop){
		for(var p in prop){
			if(prop[p]) el.setAttribute(p,prop[p]);
		}
		return el;
	}
	function addEvent(ev,el,attr,fn){
		if(el){
			if(!el.length) el = [el];
			if(typeof fn==="function"){
				el.forEach(function(elem){
					elem.addEventListener(ev,function(e){
						e.preventDefault(); e.stopPropagation(); 
						e.data = attr;
						fn.call(attr['this']||this,e);
					});
				});
			}
		}
	}
	OI._setAttr = setAttr;
	OI._addEvent = addEvent;
	OI._add = add;
	OI.map = Map;
	OI.map.tileLayer = function(url,attr){
		if(!attr.pane) attr.pane = 'tile';	// default pane
		return new TileLayer(url,attr);
	};
	root.OI = OI;
})(window || this);
