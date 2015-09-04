Wu.Layer = Wu.Class.extend({

	type : 'layer',

	options : {
		hoverTooltip : true,	// hover instead of click  todo..
	},

	initialize : function (layer) {

		// set source
		this.store = layer; // db object
		
		// data not loaded
		this.loaded = false;

	},

	addHooks : function () {
		this._setHooks('on');
	},

	removeHooks : function  () {
		this._setHooks('off');
		this._removeGridEvents();
	},

	_setHooks : function (on) {

		// all visible tiles loaded event (for phantomJS)
		Wu.DomEvent[on](this.layer, 'load', this._onLayerLoaded, this);
		Wu.DomEvent[on](this.layer, 'loading', this._onLayerLoading, this);
	},
	
	_unload : function (e) {
		// delete 
		this.removeHooks();
	},

	_onLayerLoaded : function () {
		app._loaded.push(this.getUuid());
		app._loaded = _.uniq(app._loaded);
	},

	_onLayerLoading : function () {
		app._loading.push(this.getUuid());
		app._loading = _.uniq(app._loading);
	},

	initLayer : function () {

		// create Leaflet layer, load data if necessary
		this._inited = true;
		
		// add hooks
		this.addHooks();
	},

	add : function (type) {

		// mark as base or layermenu layer
		this._isBase = (type == 'baselayer');
		
		// add
		this.addTo();
	},

	addTo : function () {
		if (!this._inited) this.initLayer();

		// add to map
		this._addTo();
		
		// add to controls
		this.addToControls();
	},

	_addTo : function (type) {
		if (!this._inited) this.initLayer();

		var map = app._map;

		// leaflet fn
		map.addLayer(this.layer);

		// add gridLayer if available
		if (this.gridLayer) map.addLayer(this.gridLayer);

		// add to active layers
		app.MapPane.addActiveLayer(this);	// includes baselayers

		// update zindex
		this._addToZIndex(type);

		this._added = true;

		// fire event
		Wu.Mixin.Events.fire('layerEnabled', { detail : {
			layer : this
		}}); 

	},

	_addThin: function () {
		if (!this._inited) this.initLayer();

		// only add to map temporarily
		app._map.addLayer(this.layer);
		this.layer.bringToFront();

	},

	_removeThin : function () {
		if (!this._inited) this.initLayer();
		app._map.removeLayer(this.layer);
	},

	flyTo : function () {

		var extent = this.getMeta().extent;
		if (!extent) return;

		var southWest = L.latLng(extent[1], extent[0]),
		    northEast = L.latLng(extent[3], extent[2]),
		    bounds = L.latLngBounds(southWest, northEast);

		// fly
		var map = app._map;
		map.fitBounds(bounds);
	},


	addToControls : function () {

		if (this._isBase) return;

		this._addToLegends();
		this._addToInspect();
		this._addToDescription();
		this._addToLayermenu();
	},

	_addToLayermenu : function () {

		// activate in layermenu
		var layerMenu = app.MapPane.getControls().layermenu;
		layerMenu && layerMenu._enableLayer(this.getUuid());
	},

	_addToLegends : function () {

		// add legends if active
		var legendsControl = app.MapPane.getControls().legends;
		legendsControl && legendsControl.addLegend(this);
	},

	_addToInspect : function () {

		// add to inspectControl if available
		var inspectControl = app.MapPane.getControls().inspect;		
		if (inspectControl) inspectControl.addLayer(this);

	},

	_addToDescription : function () {

		// add to descriptionControl if available
		var descriptionControl = app.MapPane.getControls().description;
		if (!descriptionControl) return;

		descriptionControl.setLayer(this);

		// hide if empty and not editor
		var isEditor = app.access.to.edit_project(app.activeProject);
		if (this.store.description || isEditor) { // todo: what if only editor 
			descriptionControl.show();
		} else { 								// refactor to descriptionControl
			descriptionControl.hide();
		}
		
	},

	leafletEvent : function (event, fn) {
		this.layer.on(event, fn);
	},

	_addToZIndex : function (type) {
		if (type == 'baselayer') this._isBase = true;
		var zx = this._zx || this._getZX();
		this._isBase ? zx.b.add(this) : zx.l.add(this); // either base or layermenu
	},

	_removeFromZIndex : function () {
		var zx = this._zx || this._getZX();
		this._isBase ? zx.b.remove(this) : zx.l.remove(this);
	},

	_getZX : function () {
		return app.MapPane.getZIndexControls();
	},

	remove : function (map) {
		var map = map || app._map;

		// leaflet fn
		if (map.hasLayer(this.layer)) map.removeLayer(this.layer);

		// remove from active layers
		app.MapPane.removeActiveLayer(this);	

		// remove gridLayer if available
		if (this.gridLayer) {
			this.gridLayer._flush();
			if (map.hasLayer(this.gridLayer)) map.removeLayer(this.gridLayer); 
		}

		// remove from zIndex
		this._removeFromZIndex();

		// remove from inspectControl if available
		var inspectControl = app.MapPane.getControls().inspect;			// refactor to events
		if (inspectControl) inspectControl.removeLayer(this);

		// remove from legendsControl if available
		var legendsControl = app.MapPane.getControls().legends;
		if (legendsControl) legendsControl.removeLegend(this);

		// remove from descriptionControl if avaialbe
		var descriptionControl = app.MapPane.getControls().description;
		if (descriptionControl) {
			descriptionControl.removeLayer(this);
			descriptionControl._container.style.display = 'none'; // (j)		// refactor to descriptionControl
		}

		this._added = false;
	},

	getActiveLayers : function () {
		return this._activeLayers;
	},

	enable : function () {
		this.addTo();
	},

	disable : function () {
		this.remove();
	},

	setOpacity : function (opacity) {
		this.opacity = opacity || 1;
		this.layer.setOpacity(this.opacity);
	},

	getOpacity : function () {
		return this.opacity || 1;
	},

	getContainer : function () {
		return this.layer.getContainer();
	},

	getTitle : function () {
		// override, get file title instead (if exists)
		var file = this.getFile();
		if (file) return file.getName();
		return this.store.title;
	},

	setTitle : function (title) {
		this.store.title = title;
		this.save('title');

		this.setLegendsTitle(title);
	},

	getDescription : function () {
		return this.store.description;
	},

	setDescription : function (description) {
		this.store.description = description;
		this.save('description');
	},

	getCopyright : function () {
		return this.store.copyright;
	},

	setCopyright : function (copyright) {
		this.store.copyright = copyright;
		this.save('copyright');
	},

	getUuid : function () {
		return this.store.uuid;
	},

	getFileUuid : function () {
		return this.store.file;
	},

	getAttribution : function () {
		return this.store.attribution;
	},

	getFile : function () {
		var fileUuid = this.getFileUuid();
		var file = _.find(app.Projects, function (p) {
			return p.files[fileUuid];
		});
		if (!file) return false;
		return file.files[fileUuid];
	},

	getProjectUuid : function () {
		return app.activeProject.store.uuid;
	},

	setCartoid : function (cartoid) {
		this.store.data.cartoid = cartoid;
		this.save('data');
	},

	getCartoid : function () {
		if (this.store.data) return this.store.data.cartoid;
	},

	// set postgis styling 
	setLayerStyle : function (options, callback) {

		

	},

	// set json representation of style in editor (for easy conversion)
	setEditorStyle : function (options, callback) {

	},

	getEditorStyle : function () {

		return this.getDefaultEditorStyle();

		// return meta;
	},

	getDefaultEditorStyle : function () {
		var meta = this.getMeta();

		var columns = meta.columns;
		var field;

		for (var c in columns) {
			field = c;
		}

		
		var style = {
			field : field,
			colors : ['red', 'white', 'blue'],
			marker : {
				width : field,
				opacity : 1,
			}
		}

		return style;
	},

	setCartoCSS : function (json, callback) {

		// send to server
		Wu.post('/api/layers/cartocss/set', JSON.stringify(json), callback, this);
	
		// set locally on layer
		this.setCartoid(json.cartoid);
	},

	getCartoCSS : function (cartoid, callback) {

		var json = {
			cartoid : cartoid
		}

		// get cartocss from server
		Wu.post('/api/layers/cartocss/get', JSON.stringify(json), callback, this);
	},

	getMeta : function () {
		var metajson = this.store.metadata;
		if (!metajson) return false;

		var meta = Wu.parse(metajson);
		return meta;
	},

	getMetaFields : function () {
		var meta = this.getMeta();
		if (!meta) return false;
		if (!meta.json) return false;
		if (!meta.json.vector_layers) return false;
		if (!meta.json.vector_layers[0]) return false;
		if (!meta.json.vector_layers[0].fields) return false;
		return meta.json.vector_layers[0].fields;
	},

	reloadMeta : function (callback) {

		var json = JSON.stringify({
			fileUuid : this.getFileUuid(),
			layerUuid : this.getUuid()
		});

		Wu.post('/api/layer/reloadmeta', json, callback || function (ctx, json) {

		}, this);

	},

	getTooltip : function () {
		var json = this.store.tooltip;
		if (!json) return false;
		var meta = JSON.parse(json);
		return meta;
	},

	setTooltip : function (meta) {
		this.store.tooltip = JSON.stringify(meta);
		this.save('tooltip');
	},

	getLegends : function () {
		var meta = this.store.legends
		if (meta) return JSON.parse(meta);
		return false;
	},

	getActiveLegends : function () {
		var legends = this.getLegends();
		var active = _.filter(legends, function (l) {
			return l.on;
		});
		return active;
	},

	setLegends : function (legends) {
		if (!legends) return;
		this.store.legends = JSON.stringify(legends);
		this.save('legends');
	},

	setLegendsTitle : function (title) {
		var legends = Wu.parse(this.store.legends);
		if (!legends[0]) return;
		legends[0].value = title;
		this.setLegends(legends);
	},

	setStyle : function (postgis) {
		if (!postgis) return console.error('no styloe to set!');
		
		this.store.data.postgis = postgis;
		this.save('data');
	},

	createLegends : function (callback) {

		// get layer feature values for this layer
		var json = JSON.stringify({
			fileUuid : this.getFileUuid(),
			cartoid : this.getCartoid()
		});

		Wu.post('/api/layer/createlegends', json, callback, this)
	},


	getFeaturesValues : function (callback, ctx) {
		if (!callback || !ctx) return console.error('must provide callback() and context');

		// get layer feature values for this layer
		var json = JSON.stringify({
			fileUuid : this.getFileUuid(),
			cartoid : this.getCartoid()
		});

		Wu.post('/api/util/getfeaturesvalues', json, callback.bind(ctx), this)
	},


	hide : function () {
		var container = this.getContainer();
		container.style.visibility = 'hidden';
	},

	show : function () {
		var container = this.getContainer();
		container.style.visibility = 'visible';
	},

	// save updates to layer (like description, style)
	save : function (field) {
		var json = {};
		json[field] = this.store[field];
		json.layer  = this.store.uuid;
		json.uuid   = app.activeProject.getUuid(); // project uuid

		this._save(json);
	},

	_save : function (json) {
		var string  = JSON.stringify(json);
		Wu.save('/api/layer/update', string);
	},

	_setZIndex : function (z) {
		this.layer.setZIndex(z);
	},
	

	_addGridEvents : function () {
		this._setGridEvents('on');
	},

	_setGridEvents : function (on) {
		var grid = this.gridLayer;
		if (!grid || !on) return;
		grid[on]('mousedown', this._gridOnMousedown, this);
		grid[on]('mouseup', this._gridOnMouseup, this);
		grid[on]('click', this._gridOnClick, this);
	},

	_removeGridEvents : function () {
		this._setGridEvents('off');
	},

	

	_flush : function () {
		this.remove();
		app.MapPane._clearPopup();
		this._removeGridEvents();
		this.layer = null;
		this.gridLayer = null;
		this._inited = false;

	},

});



Wu.PostGISLayer = Wu.Layer.extend({

	initLayer : function () {
		this.update();
		this.addHooks();

		this._inited = true;
	},

	update : function (options) {
		var map = app._map;

		// remove
		if (this.layer) this._flush();

		// prepare raster
		this._prepareRaster();

		// prepare utfgrid
		this._prepareGrid();

		// enable
		if (options && options.enable) {
			map.addLayer(this.layer);
			this.layer.bringToFront();
		}
	},

	_getLayerUuid : function () {
		return this.store.data.postgis.layer_id;
	},

	getCartoCSS : function (cartoid, callback) {
		return this.store.data.postgis.cartocss;
	},

	getSQL : function () {
		return this.store.data.postgis.sql;
	},

	getPostGISData : function () {
		return this.store.data.postgis;
	},


	_prepareRaster : function () {

		// set ids
		var fileUuid 	= this._fileUuid,	// file id of geojson
		    subdomains  = app.options.servers.tiles.subdomains,
		    access_token = '?access_token=' + app.tokens.access_token;

		var layerUuid = this._getLayerUuid();
		var url = 'https://{s}.systemapic.com/tiles/{layerUuid}/{z}/{x}/{y}.png' + access_token;


		// add vector tile raster layer
		this.layer = L.tileLayer(url, {
			layerUuid: this._getLayerUuid(),
			subdomains : subdomains,
			maxRequests : 0,
			maxZoom : 19
		});

		// load grid after all pngs.. (dont remember why..)
		// Wu.DomEvent.on(this.layer, 'load', this._updateGrid, this);

	},

	_invalidateTiles : function () {
		return;
	},

	_updateGrid : function (l) {

		// refresh of gridlayer is attached to layer. this because vector tiles are not made in vile.js, 
		// and it's much more stable if gridlayer requests tiles after raster layer... perhpas todo: improve this hack!
		// - also, removed listeners in L.UtfGrid (onAdd)
		// 
		if (this.gridLayer) {
			this.gridLayer._update();
		}
	},

	_prepareGrid : function () {

		// set ids
		var subdomains  = app.options.servers.tiles.subdomains,
		    access_token = '?access_token=' + app.tokens.access_token;
		
		var layerUuid = this._getLayerUuid();
		var url = 'https://{s}.systemapic.com/tiles/{layerUuid}/{z}/{x}/{y}.grid' + access_token;

		// create gridlayer
		this.gridLayer = new L.UtfGrid(url, {
			useJsonP: false,
			subdomains: subdomains,
			maxRequests : 0,
			requestTimeout : 10000,
			layerUuid : layerUuid,
			maxZoom : 19
		});

		// debug
		// this.gridLayer = false;

		// add grid events
		this._addGridEvents();

	},


	// updateStyle : function () {
	// 	return console.error('updateStyle, todo: remove');
	// 	// set new options and redraw
	// 	if (this.layer) this.layer.setOptions({
	// 		cartoid : this.getCartoid(),
	// 	});
	// },


	_fetchData : function (e, callback) {

		var keys = Object.keys(e.data);
		var column = keys[0];
		var row = e.data[column];
		var layer_id = e.layer.store.data.postgis.layer_id;

		var options = {
			column : column,
			row : row,
			layer_id : layer_id,
			access_token : app.tokens.access_token
		}

		Wu.send('/api/db/fetch', options, callback, this);
	},

	

	_gridOnMousedown : function(e) {
		
		

	},

	_gridOnMouseup : function (e) {
		if (!e.data) return;

		// pass layer
		e.layer = this;

		var event = e.e.originalEvent;

		if (this._event === undefined || this._event.x == event.x) {
			// open popup 
			// app.MapPane.openPopup(e);

			// console.log('pop 7 open');
		} else {
			// clear old
			app.MapPane._clearPopup();
		}

	},

	_gridOnClick : function (e) {
		if (!e.data) return;
		if (app.MapPane._drawing) return;

		// pass layer
		e.layer = this;

		// fetch data
		this._fetchData(e, function (ctx, json) {
			
			var data = JSON.parse(json);
			console.log('fetched data: ', data);
			e.data = data;
			var event = e.e.originalEvent;
			this._event = {
				x : event.x,
				y : event.y
			}

			// open popup
			app.MapPane._addPopupContent(e);
		});


	},

});








Wu.MapboxLayer = Wu.Layer.extend({

	type : 'mapboxLayer',
	
	initLayer : function () {

		var url = 'https://{s}.tiles.mapbox.com/v4/{mapboxUri}/{z}/{x}/{y}.png?access_token={accessToken}';

		this.layer = L.tileLayer(url, {
			accessToken : this.store.accessToken,
			mapboxUri : this.store.data.mapbox,
		});

		// todo: add gridlayer to mapbox.. but why..?
		// add hooks
		this.addHooks();
		this.loaded = true;
		this._inited = true;
	},
});



Wu.GoogleLayer = Wu.Layer.extend({

	type : 'googleLayer',

	options : {
		minZoom : 0,
		maxZoom : 20,
	},

	initialize : function (layer) {

		// set source
		this.store = layer; // db object
		
		// data not loaded
		this.loaded = false;
	},

	initLayer : function () {
		this.update();
	},

	update : function () {
		var map = app._map;

		// prepare raster
		this._prepareRaster();
	},

	getTileType : function () {
		return this.store.tileType || 'aerial';
	},

	_prepareRaster : function () {

		// norkart
		var type = this.getTileType();
		// var format = this.options.tileformats[type];
		var access_token = '?access_token=' + app.tokens.access_token;
		var url = 'https://{s}.systemapic.com/proxy/google/{type}/{z}/{x}/{y}.png' + access_token;
		var subdomains  = app.options.servers.proxy.subdomains;

		// add vector tile raster layer
		this.layer = L.tileLayer(url, {
			type : type,
			// format : format,
			subdomains : subdomains,
			maxRequests : 0,
			tms : false,
			maxZoom : this.options.maxZoom,
			minZoom : this.options.minZoom,
		});

		// add clear background cache event (hack for hanging tiles)
		// see: https://github.com/Leaflet/Leaflet/issues/1905
		// if (!this._eventsAdded) this._addEvents();

		// add move event (for norkart logging)
		// if (!this._logEvent) this._logEvent = true;
	},

});


Wu.NorkartLayer = Wu.Layer.extend({

	type : 'norkartLayer',

	// ATTRIBUTION // TODO!
	// -----------
	// add attribution to layer.options (ie. leaflet layer)
	// change attribution on mapmove, use _getCopyrightText

	options : {
		// norkart options
		log_url : 'https://www.webatlas.no/weblog/Log2.aspx?',
		current_mapstyle : 1, // aerial,
	        tileformats : {
	        	vector: "png",
	                aerial: "jpeg",
	                hybrid: "jpeg"
	        },
		customer_id : 'systemapic',
		minZoom : 0,
		maxZoom : 20,
	},

	initialize : function (layer) {

		// set source
		this.store = layer; // db object
		
		// data not loaded
		this.loaded = false;
	},

	initLayer : function () {
		this.update();
	},

	update : function () {
		var map = app._map;

		// prepare raster
		this._prepareRaster();
	},

	getTileType : function () {
		return this.store.tileType || 'aerial';
	},

	_prepareRaster : function () {

		// norkart
		var type = this.getTileType();
		var format = this.options.tileformats[type];
		var access_token = '?access_token=' + app.tokens.access_token;
		var url = 'https://{s}.systemapic.com/proxy/norkart/{type}/{z}/{x}/{y}.{format}' + access_token;
		var subdomains  = app.options.servers.proxy.subdomains;

		// add vector tile raster layer
		this.layer = L.tileLayer(url, {
			type : type,
			format : format,
			subdomains : subdomains,
			maxRequests : 0,
			tms : false,
			maxZoom : this.options.maxZoom,
			minZoom : this.options.minZoom,
		});

		// add clear background cache event (hack for hanging tiles)
		// see: https://github.com/Leaflet/Leaflet/issues/1905
		if (!this._eventsAdded) this._addEvents();

		// add move event (for norkart logging)
		if (!this._logEvent) this._logEvent = true;
	},

	_addEvents : function () {
		app._map.on('zoomend', this._clearBackgroundCache.bind(this));
		app._map.on('moveend', _.throttle(this.logMapRequest.bind(this), 350));
		this._eventsAdded = true;
	},

	_clearBackgroundCache : function () {
		// clear cache if at zoom break-point
		var zoom = app._map.getZoom(); // after
		if (zoom == this.options.minZoom - 1) {
			this.layer && this.layer._clearBgBuffer();
		}
		if (zoom == this.options.maxZoom + 1) {
			this.layer && this.layer._clearBgBuffer();
		}
	},

	logMapRequest: function() {

		// don't log if not within zoom levels
		var zoom = app._map.getZoom();
		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) return;

		var e = app._map.getBounds(),
		    t = e.getNorthWest().lng,
		    n = e.getNorthWest().lat,
		    r = e.getSouthEast().lng,
		    i = e.getSouthEast().lat,
		    s = document.createElement("img");
		
		// log
		var logstring = this.options.log_url + "WMS-REQUEST=BBOX=" + t + "," + i + "," + r + "," + n + "&MAPSTYLE=" + this.options.current_mapstyle + "&CUSTOMER=" + this.options.customer_id;
		s.src = logstring;
		s = null;
	},

	// norkart fn
	_getCopyrightText: function() {
		var e = this._map.getCenter(),
		    t = this._map.getZoom(),
		    n = [
		    	"&copy; 2015 Norkart AS/Plan- og bygningsetaten, Oslo Kommune", 
		    	"&copy; 2015 Norkart AS/Geovekst og kommunene/OpenStreetMap/NASA, Meti", 
		    	"&copy; 2015 Norkart AS/Geovekst og kommunene/OpenStreetMap/NASA, Meti", 
		    	"&copy; 2015 Norkart AS/OpenStreetMap/EEA CLC2006"
		    ];
		
		if (t >= 13) {
			if (t <= 14) {
				try {
					if (this.t_containsPoint(e, L.Control.WAAttribution.t_norgeLat, L.Control.WAAttribution.t_norgeLon)) return n[1];
				} catch (r) {console.log('catch err', r);};
			} else {
				try {
					if (this.t_containsPoint(e, L.Control.WAAttribution.t_osloLat, L.Control.WAAttribution.t_osloLon)) return n[0];
				} catch (r) {console.log('catch err', r);};
			}
			
			try {
				if (this.t_containsPoint(e, L.Control.WAAttribution.t_norgeLat, L.Control.WAAttribution.t_norgeLon)) return n[1];
			} catch (r) {console.log('catch err', r);};
		
			return n[3]
		}
		
		try {
			return this.t_containsPoint(e, L.Control.WAAttribution.t_norgeLat, L.Control.WAAttribution.t_norgeLon) ? n[2] : n[3]
		} catch (r) {console.log('catch err', r);};

        },

        // norkart fn
        t_containsPoint: function(e, t, n) {
		var r, i = 0,
		    s = t.length,
		    o = !1;
		for (r = 0; r < s; r++) i++, i == s && (i = 0), (n[r] < e.lng && n[i] >= e.lng || n[i] < e.lng && n[r] >= e.lng) && t[r] + (e.lng - n[r]) / (n[i] - n[r]) * (t[i] - t[r]) < e.lat && (o = !o);
		return o;
        },
        statics: {
		t_osloLat: [59.81691, 59.81734, 59.81813, 59.82537, 59.82484, 59.82298, 59.82343, 59.82494, 59.82588, 59.8262, 59.82367, 59.82349, 59.82954, 59.83053, 59.83929, 59.85107, 59.87719, 59.87593, 59.88371, 59.88441, 59.89462, 59.90941, 59.91071, 59.91407, 59.9147, 59.91405, 59.91468, 59.91632, 59.91732, 59.91797, 59.91771, 59.91876, 59.92173, 59.92246, 59.9235, 59.92441, 59.92518, 59.92709, 59.92786, 59.92963, 59.93123, 59.93255, 59.93459, 59.93579, 59.93925, 59.9424, 59.9428, 59.94566, 59.94784, 59.95187, 59.9523, 59.95303, 59.95354, 59.95371, 59.95626, 59.95723, 59.95856, 59.96163, 59.96267, 59.96483, 59.96634, 59.97051, 59.97432, 59.97661, 59.97698, 59.97671, 59.9777, 59.97674, 59.97686, 59.97754, 59.9786, 59.98552, 59.99223, 59.99403, 59.99639, 59.99672, 59.99462, 59.99365, 59.99552, 59.99804, 60.00064, 60.00014, 59.99932, 59.99977, 59.99991, 59.99936, 60.0085, 60.01579, 60.01726, 60.02602, 60.03843, 60.05177, 60.06503, 60.07624, 60.07728, 60.08286, 60.09214, 60.09394, 60.10068, 60.10983, 60.11678, 60.1287, 60.13162, 60.13459, 60.13518, 60.13277, 60.13353, 60.1258, 60.12586, 60.12531, 60.12519, 60.12286, 60.12117, 60.1194, 60.11991, 60.11966, 60.12019, 60.12059, 60.12154, 60.12172, 60.12365, 60.12504, 60.12573, 60.12526, 60.12326, 60.12303, 60.12161, 60.12081, 60.11833, 60.11285, 60.11218, 60.1118, 60.10609, 60.10496, 60.10103, 60.09955, 60.09917, 60.0986, 60.09856, 60.09777, 60.09268, 60.08689, 60.08659, 60.08403, 60.07893, 60.07827, 60.07714, 60.07484, 60.0706, 60.06755, 60.06689, 60.0661, 60.06575, 60.06421, 60.06467, 60.06436, 60.06515, 60.06489, 60.06429, 60.05371, 60.04309, 60.04054, 60.03783, 60.03693, 60.03563, 60.03328, 60.03026, 60.02976, 60.02912, 60.02736, 60.0211, 60.01813, 60.01788, 60.01734, 60.01791, 60.02211, 60.02327, 60.02315, 60.02148, 60.01985, 60.0178, 60.00969, 60.00846, 60.0061, 59.99799, 59.99815, 59.99714, 59.99964, 60.00179, 59.99616, 59.99552, 59.99566, 59.99491, 59.99301, 59.98677, 59.98558, 59.98442, 59.98078, 59.98053, 59.98072, 59.98023, 59.98099, 59.98398, 59.98455, 59.98372, 59.97712, 59.97705, 59.96955, 59.96552, 59.96286, 59.95484, 59.9526, 59.95321, 59.94924, 59.94803, 59.94694, 59.94778, 59.94687, 59.94598, 59.94572, 59.94318, 59.9418, 59.94116, 59.93486, 59.92653, 59.92045, 59.91937, 59.91228, 59.91162, 59.91127, 59.90041, 59.89682, 59.88496, 59.87528, 59.86989, 59.86475, 59.8601, 59.85206, 59.84493, 59.83684, 59.83631, 59.83489, 59.8317, 59.83133, 59.82693, 59.82773, 59.82776, 59.82679, 59.8271, 59.82629, 59.82609, 59.8262, 59.82548, 59.82368, 59.82204, 59.82102, 59.81815, 59.81703, 59.81575, 59.81434, 59.81216, 59.81104, 59.81204, 59.81297, 59.81306, 59.81232, 59.80946, 59.81198, 59.81529, 59.81685, 59.81616, 59.81699, 59.81691],
		t_osloLon: [10.83369, 10.83169, 10.81725, 10.81244, 10.8045, 10.79843, 10.7892, 10.78261, 10.78091, 10.77675, 10.77244, 10.77156, 10.76478, 10.76156, 10.744, 10.73995, 10.73097, 10.68893, 10.66064, 10.65808, 10.65387, 10.64777, 10.64253, 10.63988, 10.63553, 10.63506, 10.63304, 10.63298, 10.63427, 10.63309, 10.63123, 10.63006, 10.62936, 10.62578, 10.62532, 10.62596, 10.62746, 10.62543, 10.62708, 10.62647, 10.63107, 10.63299, 10.63402, 10.63531, 10.63161, 10.63341, 10.63289, 10.63581, 10.63561, 10.63387, 10.63304, 10.63403, 10.63353, 10.63205, 10.63083, 10.63175, 10.62995, 10.62758, 10.62357, 10.62444, 10.62051, 10.61817, 10.61395, 10.61045, 10.60385, 10.6037, 10.59622, 10.59395, 10.59165, 10.59027, 10.59025, 10.57878, 10.5657, 10.55948, 10.55692, 10.55585, 10.55218, 10.54912, 10.54526, 10.54399, 10.5338, 10.52968, 10.52841, 10.52754, 10.52266, 10.51795, 10.50366, 10.49021, 10.48916, 10.50276, 10.52201, 10.54276, 10.56337, 10.58077, 10.59731, 10.59278, 10.59184, 10.59212, 10.58836, 10.57999, 10.57278, 10.59522, 10.60081, 10.61047, 10.61906, 10.64515, 10.68032, 10.69737, 10.69842, 10.69986, 10.70447, 10.70493, 10.70385, 10.70726, 10.71477, 10.71615, 10.71703, 10.71688, 10.7198, 10.72497, 10.73165, 10.73248, 10.73712, 10.74026, 10.74418, 10.74689, 10.7483, 10.75123, 10.75232, 10.76785, 10.7684, 10.76621, 10.75711, 10.75593, 10.75475, 10.75534, 10.75762, 10.75796, 10.75916, 10.76205, 10.7671, 10.77063, 10.77233, 10.77481, 10.77796, 10.77902, 10.77864, 10.78232, 10.7847, 10.78802, 10.79385, 10.79691, 10.80157, 10.80937, 10.81045, 10.81208, 10.81561, 10.81927, 10.81976, 10.81656, 10.81803, 10.81696, 10.8181, 10.81464, 10.8128, 10.81205, 10.81316, 10.8124, 10.8134, 10.812, 10.81542, 10.81921, 10.82064, 10.82139, 10.82217, 10.8235, 10.82526, 10.82693, 10.82875, 10.82921, 10.83204, 10.83314, 10.83571, 10.83704, 10.83808, 10.8391, 10.84252, 10.84311, 10.84959, 10.85821, 10.86331, 10.86429, 10.86605, 10.86714, 10.87516, 10.8754, 10.88293, 10.89337, 10.90433, 10.90591, 10.9074, 10.91267, 10.91629, 10.9182, 10.92565, 10.93057, 10.93106, 10.93751, 10.93807, 10.93705, 10.94129, 10.94334, 10.94433, 10.95138, 10.94763, 10.94608, 10.94499, 10.94244, 10.94272, 10.94206, 10.94584, 10.94306, 10.94246, 10.92912, 10.92148, 10.91913, 10.91781, 10.91573, 10.91481, 10.91521, 10.91188, 10.91142, 10.90762, 10.90988, 10.90715, 10.90934, 10.91233, 10.92155, 10.92651, 10.93119, 10.93367, 10.9352, 10.9366, 10.933, 10.92716, 10.92303, 10.91703, 10.91477, 10.91326, 10.91079, 10.91094, 10.90679, 10.90105, 10.89649, 10.89677, 10.8918, 10.89157, 10.88907, 10.8876, 10.88294, 10.88188, 10.87985, 10.87885, 10.87378, 10.86889, 10.86313, 10.85584, 10.8479, 10.84604, 10.84597, 10.8373, 10.83566, 10.83369],
		t_norgeLat: [69.11, 69.09, 69.04, 69.04, 69.09, 69.1, 69.12, 69.18, 69.19, 69.2, 69.22, 69.23, 69.26, 69.27, 69.28, 69.28, 69.31, 69.3, 69.27, 69.24, 69.24, 69.15, 69.13, 69.13, 69.12, 69.11, 69.09, 69.02, 69.01, 68.96, 68.96, 68.93, 68.93, 68.91, 68.85, 68.83, 68.82, 68.8, 68.79, 68.75, 68.74, 68.72, 68.72, 68.72, 68.73, 68.74, 68.74, 68.74, 68.73, 68.71, 68.7, 68.69, 68.69, 68.69, 68.68, 68.68, 68.63, 68.63, 68.63, 68.64, 68.64, 68.64, 68.66, 68.66, 68.67, 68.67, 68.68, 68.69, 68.7, 68.7, 68.7, 68.7, 68.71, 68.71, 68.75, 68.78, 68.82, 68.84, 68.83, 68.83, 68.83, 68.81, 68.8, 68.79, 68.76, 68.76, 68.75, 68.74, 68.73, 68.73, 68.73, 68.71, 68.69, 68.68, 68.66, 68.65, 68.65, 68.66, 68.64, 68.63, 68.63, 68.62, 68.61, 68.59, 68.56, 68.56, 68.56, 68.55, 68.55, 68.56, 68.57, 68.58, 68.59, 68.59, 68.6, 68.61, 68.61, 68.61, 68.61, 68.62, 68.62, 68.62, 68.62, 68.62, 68.62, 68.62, 68.62, 68.62, 68.63, 68.63, 68.64, 68.64, 68.65, 68.66, 68.66, 68.67, 68.68, 68.69, 68.69, 68.7, 68.7, 68.71, 68.71, 68.72, 68.73, 68.74, 68.75, 68.8, 68.8, 68.8, 68.81, 68.82, 68.83, 68.84, 68.84, 68.85, 68.85, 68.86, 68.86, 68.86, 68.87, 68.88, 68.88, 68.88, 68.88, 68.89, 68.89, 68.89, 68.89, 68.9, 68.9, 68.9, 68.9, 68.9, 68.9, 68.89, 68.89, 68.89, 68.89, 68.89, 68.88, 68.88, 68.88, 68.89, 68.89, 68.89, 68.9, 68.9, 68.92, 68.93, 68.94, 68.94, 68.95, 68.99, 69, 69.01, 69.01, 69.02, 69.11, 69.12, 69.14, 69.15, 69.17, 69.18, 69.19, 69.2, 69.22, 69.23, 69.23, 69.25, 69.26, 69.27, 69.27, 69.28, 69.28, 69.29, 69.3, 69.3, 69.31, 69.31, 69.34, 69.34, 69.35, 69.36, 69.36, 69.37, 69.38, 69.39, 69.39, 69.4, 69.41, 69.42, 69.42, 69.43, 69.43, 69.44, 69.45, 69.46, 69.47, 69.48, 69.49, 69.51, 69.52, 69.53, 69.55, 69.56, 69.57, 69.58, 69.59, 69.61, 69.63, 69.65, 69.65, 69.65, 69.66, 69.67, 69.68, 69.68, 69.69, 69.7, 69.71, 69.72, 69.73, 69.73, 69.74, 69.74, 69.75, 69.75, 69.77, 69.8, 69.81, 69.82, 69.83, 69.85, 69.86, 69.88, 69.89, 69.9, 69.91, 69.92, 69.94, 69.96, 69.96, 69.95, 69.95, 69.95, 69.94, 69.95, 69.95, 69.96, 69.96, 69.95, 69.95, 69.94, 69.93, 69.93, 69.93, 69.93, 69.94, 69.94, 69.94, 69.93, 69.93, 69.92, 69.91, 69.91, 69.91, 69.92, 69.93, 69.93, 69.93, 69.95, 69.95, 69.95, 69.95, 69.96, 69.96, 69.97, 69.98, 69.98, 69.99, 69.99, 69.99, 70, 70.01, 70.02, 70.02, 70.02, 70.02, 70.03, 70.03, 70.04, 70.05, 70.06, 70.06, 70.07, 70.08, 70.07, 70.06, 70.06, 70.07, 70.07, 70.08, 70.09, 70.09, 70.09, 70.05, 70.04, 70.04, 70, 69.92, 69.9, 69.89, 69.88, 69.87, 69.87, 69.86, 69.85, 69.83, 69.82, 69.79, 69.78, 69.69, 69.69, 69.68, 69.67, 69.57, 69.55, 69.53, 69.52, 69.51, 69.49, 69.48, 69.47, 69.46, 69.41, 69.4, 69.31, 69.28, 69.23, 69.22, 69.19, 69.18, 69.16, 69.14, 69.13, 69.12, 69.11, 69.1, 69.09, 69.08, 69.06, 69.05, 69.04, 69.04, 69.02, 69.02, 69.01, 69.02, 69.02, 69.03, 69.03, 69.06, 69.07, 69.11, 69.12, 69.15, 69.18, 69.21, 69.23, 69.24, 69.24, 69.25, 69.25, 69.26, 69.27, 69.29, 69.3, 69.31, 69.31, 69.31, 69.31, 69.33, 69.33, 69.31, 69.32, 69.32, 69.33, 69.35, 69.37, 69.37, 69.39, 69.39, 69.4, 69.4, 69.41, 69.42, 69.42, 69.42, 69.42, 69.41, 69.41, 69.4, 69.41, 69.41, 69.41, 69.42, 69.43, 69.43, 69.43, 69.44, 69.45, 69.46, 69.47, 69.47, 69.47, 69.49, 69.51, 69.52, 69.52, 69.53, 69.53, 69.55, 69.56, 69.58, 69.59, 69.6, 69.62, 69.63, 69.64, 69.64, 69.64, 69.64, 69.65, 69.66, 69.67, 69.67, 69.65, 69.63, 69.63, 69.63, 69.62, 69.61, 69.59, 69.54, 69.54, 69.54, 69.54, 69.54, 69.54, 69.54, 69.54, 69.53, 69.53, 69.53, 69.56, 69.56, 69.57, 69.58, 69.59, 69.61, 69.64, 69.65, 69.66, 69.67, 69.68, 69.67, 69.67, 69.68, 69.69, 69.69, 69.7, 69.7, 69.71, 69.72, 69.72, 69.73, 69.78, 69.78, 69.79, 69.78, 69.78, 69.77, 69.77, 69.76, 69.76, 69.76, 69.79, 69.79, 69.79, 69.98, 70.01, 70.12, 70.12, 70.11, 70.14, 70.24, 70.35, 70.36, 70.4, 70.44, 70.47, 70.5, 70.54, 70.65, 70.67, 70.83, 70.87, 70.94, 70.95, 71.02, 71.12, 71.28, 71.3, 71.32, 71.33, 71.35, 71.36, 71.38, 71.38, 71.34, 71.31, 71.31, 71.3, 71.29, 71.27, 71.19, 71.11, 70.99, 70.98, 70.9, 70.85, 70.79, 70.7, 70.63, 70.56, 70.48, 70.39, 70.35, 70.17, 70.07, 69.99, 69.81, 69.75, 69.71, 69.7, 69.65, 69.6, 69.52, 69.51, 69.39, 69.35, 69.32, 69.25, 69.25, 69.18, 69.08, 69.07, 69, 68.9, 68.85, 68.76, 68.73, 68.61, 68.54, 68.46, 68.46, 68.4, 68.39, 68.34, 68.29, 68.24, 68.15, 68.12, 68.1, 68.01, 67.87, 67.82, 67.78, 67.7, 67.7, 67.62, 67.59, 67.54, 67.47, 67.44, 67.39, 67.34, 67.02, 66.82, 66.71, 66.67, 66.4, 66.19, 65.97, 65.7, 65.57, 65.54, 65.5, 65.47, 65.35, 65.27, 65.05, 64.99, 64.87, 64.78, 64.73, 64.55, 64.36, 64.24, 64.14, 64.04, 63.77, 63.7, 63.58, 63.43, 63.34, 63.31, 63.27, 63.26, 63.25, 63.19, 63.18, 63.15, 63.09, 63.02, 63, 62.97, 62.93, 62.81, 62.75, 62.67, 62.62, 62.47, 62.43, 62.38, 62.29, 62.18, 62.15, 62.03, 61.85, 61.78, 61.71, 61.68, 61.55, 61.54, 61.49, 61.35, 61.23, 61.16, 61.07, 61, 60.83, 60.81, 60.72, 60.69, 60.57, 60.51, 60.44, 60.41, 60.39, 60.31, 60.23, 60.17, 60.1, 60.07, 60.05, 59.91, 59.87, 59.79, 59.76, 59.72, 59.68, 59.67, 59.56, 59.56, 59.5, 59.44, 59.36, 59.31, 59.27, 59.22, 59.18, 59.14, 59.12, 59.07, 59.04, 59, 58.96, 58.92, 58.81, 58.78, 58.76, 58.65, 58.62, 58.6, 58.55, 58.53, 58.5, 58.44, 58.4, 58.36, 58.33, 58.28, 58.16, 58.08, 58.07, 58.06, 58.03, 58.02, 57.97, 57.91, 57.88, 57.88, 57.82, 57.79, 57.77, 57.76, 57.76, 57.76, 57.76, 57.77, 57.78, 57.79, 57.8, 57.83, 57.85, 57.9, 57.92, 57.94, 57.98, 58.02, 58.04, 58.08, 58.13, 58.15, 58.17, 58.25, 58.39, 58.42, 58.43, 58.52, 58.6, 58.67, 58.72, 58.72, 58.73, 58.74, 58.76, 58.77, 58.77, 58.76, 58.76, 58.89, 58.94, 58.96, 58.98, 58.99, 59.01, 59.08, 59.08, 59.09, 59.09, 59.09, 59.09, 59.1, 59.1, 59.1, 59.1, 59.1, 59.1, 59.1, 59.08, 59.08, 59.07, 59.06, 59.06, 59.04, 59.04, 59.03, 59.02, 59.01, 58.99, 58.99, 58.98, 58.97, 58.95, 58.94, 58.93, 58.92, 58.89, 58.89, 58.89, 58.89, 58.89, 58.88, 58.88, 58.88, 58.88, 58.88, 58.88, 58.88, 58.89, 58.89, 58.89, 58.88, 58.88, 58.89, 58.89, 58.89, 58.89, 58.9, 58.9, 58.9, 58.9, 58.9, 58.91, 58.92, 58.92, 58.93, 58.93, 58.94, 58.95, 58.96, 58.98, 58.99, 59.01, 59.01, 59.03, 59.03, 59.04, 59.05, 59.06, 59.07, 59.09, 59.09, 59.1, 59.11, 59.12, 59.12, 59.13, 59.14, 59.15, 59.16, 59.17, 59.18, 59.19, 59.2, 59.21, 59.22, 59.22, 59.23, 59.23, 59.24, 59.25, 59.27, 59.29, 59.31, 59.32, 59.32, 59.33, 59.34, 59.34, 59.35, 59.38, 59.4, 59.41, 59.42, 59.42, 59.43, 59.44, 59.46, 59.47, 59.48, 59.5, 59.51, 59.54, 59.55, 59.56, 59.57, 59.58, 59.59, 59.6, 59.61, 59.61, 59.62, 59.62, 59.63, 59.63, 59.64, 59.64, 59.64, 59.64, 59.64, 59.64, 59.65, 59.65, 59.66, 59.67, 59.68, 59.69, 59.69, 59.69, 59.69, 59.69, 59.69, 59.7, 59.71, 59.72, 59.73, 59.75, 59.75, 59.76, 59.77, 59.78, 59.79, 59.8, 59.82, 59.83, 59.83, 59.83, 59.84, 59.84, 59.85, 59.85, 59.86, 59.87, 59.87, 59.87, 59.88, 59.89, 59.89, 59.9, 59.9, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.89, 59.9, 59.9, 59.9, 59.91, 59.93, 59.93, 59.94, 59.94, 59.95, 59.96, 59.96, 59.97, 59.98, 59.98, 59.99, 60, 60.01, 60.02, 60.02, 60.03, 60.04, 60.05, 60.06, 60.07, 60.09, 60.13, 60.14, 60.15, 60.16, 60.19, 60.22, 60.23, 60.24, 60.25, 60.26, 60.28, 60.3, 60.31, 60.32, 60.33, 60.33, 60.34, 60.35, 60.36, 60.36, 60.37, 60.38, 60.39, 60.39, 60.4, 60.41, 60.43, 60.44, 60.48, 60.51, 60.52, 60.53, 60.54, 60.55, 60.57, 60.59, 60.6, 60.61, 60.61, 60.62, 60.63, 60.64, 60.65, 60.66, 60.67, 60.68, 60.7, 60.71, 60.73, 60.75, 60.79, 60.83, 60.84, 60.85, 60.86, 60.87, 60.88, 60.89, 60.9, 60.91, 60.92, 60.92, 60.94, 60.97, 60.98, 60.99, 61, 61.01, 61.03, 61.04, 61.04, 61.04, 61.04, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.05, 61.06, 61.06, 61.06, 61.07, 61.08, 61.09, 61.09, 61.1, 61.12, 61.14, 61.19, 61.22, 61.24, 61.26, 61.27, 61.29, 61.31, 61.32, 61.36, 61.37, 61.39, 61.4, 61.42, 61.43, 61.48, 61.53, 61.55, 61.57, 61.57, 61.57, 61.57, 61.57, 61.56, 61.56, 61.56, 61.58, 61.59, 61.6, 61.62, 61.62, 61.63, 61.69, 61.7, 61.72, 61.75, 61.75, 61.77, 61.8, 61.82, 61.83, 61.85, 61.87, 61.88, 61.89, 61.91, 62, 62.12, 62.15, 62.17, 62.18, 62.2, 62.22, 62.25, 62.26, 62.27, 62.27, 62.38, 62.39, 62.4, 62.41, 62.46, 62.52, 62.58, 62.59, 62.61, 62.62, 62.63, 62.66, 62.68, 62.69, 62.71, 62.71, 62.74, 62.76, 62.83, 62.84, 62.88, 62.9, 62.94, 62.96, 62.97, 62.98, 62.99, 63, 63, 63.01, 63.02, 63.04, 63.05, 63.12, 63.17, 63.26, 63.27, 63.28, 63.33, 63.33, 63.34, 63.34, 63.35, 63.35, 63.39, 63.48, 63.55, 63.56, 63.59, 63.63, 63.65, 63.72, 63.72, 63.73, 63.75, 63.76, 63.78, 63.79, 63.82, 63.83, 63.85, 63.85, 63.89, 63.93, 63.93, 63.96, 63.97, 63.99, 64, 64, 64.01, 64.03, 64.03, 64.04, 64.04, 64.05, 64.07, 64.08, 64.09, 64.09, 64.09, 64.09, 64.1, 64.07, 64.05, 64.05, 64.03, 64.03, 64.02, 64.01, 64.01, 64.03, 64.05, 64.06, 64.09, 64.11, 64.13, 64.15, 64.16, 64.19, 64.2, 64.2, 64.23, 64.3, 64.36, 64.37, 64.38, 64.38, 64.4, 64.44, 64.46, 64.48, 64.48, 64.5, 64.5, 64.55, 64.55, 64.57, 64.58, 64.61, 64.63, 64.71, 64.79, 64.81, 64.82, 64.84, 64.85, 64.86, 64.88, 64.91, 64.94, 64.96, 64.97, 64.98, 64.98, 65, 65.05, 65.07, 65.1, 65.12, 65.13, 65.14, 65.17, 65.19, 65.23, 65.25, 65.28, 65.3, 65.34, 65.36, 65.4, 65.43, 65.44, 65.45, 65.48, 65.49, 65.5, 65.51, 65.53, 65.58, 65.59, 65.63, 65.64, 65.66, 65.67, 65.69, 65.72, 65.73, 65.75, 65.79, 65.8, 65.81, 65.86, 65.87, 65.89, 65.9, 65.92, 65.95, 66.02, 66.07, 66.1, 66.13, 66.13, 66.14, 66.14, 66.14, 66.14, 66.14, 66.16, 66.18, 66.24, 66.24, 66.28, 66.32, 66.34, 66.35, 66.38, 66.4, 66.4, 66.43, 66.43, 66.45, 66.46, 66.47, 66.48, 66.5, 66.53, 66.53, 66.57, 66.58, 66.59, 66.61, 66.62, 66.62, 66.65, 66.66, 66.67, 66.68, 66.7, 66.78, 66.78, 66.85, 66.87, 66.88, 66.91, 66.93, 66.96, 66.96, 66.97, 66.98, 66.98, 66.99, 67.01, 67.02, 67.04, 67.04, 67.06, 67.14, 67.15, 67.16, 67.2, 67.2, 67.22, 67.24, 67.25, 67.27, 67.27, 67.28, 67.29, 67.35, 67.37, 67.41, 67.43, 67.45, 67.48, 67.49, 67.51, 67.52, 67.53, 67.53, 67.53, 67.56, 67.57, 67.57, 67.59, 67.6, 67.64, 67.66, 67.67, 67.69, 67.71, 67.73, 67.74, 67.74, 67.76, 67.77, 67.78, 67.79, 67.8, 67.81, 67.83, 67.84, 67.86, 67.87, 67.92, 67.93, 67.94, 67.94, 67.96, 67.96, 67.99, 68, 68.05, 68.05, 68.06, 68.07, 68.08, 68.08, 68.1, 68.11, 68.12, 68.12, 68.12, 68.11, 68.09, 68.08, 68.07, 68.05, 68.05, 68.01, 68.01, 68, 67.97, 67.97, 68.05, 68.06, 68.13, 68.15, 68.18, 68.19, 68.2, 68.22, 68.31, 68.32, 68.34, 68.36, 68.37, 68.41, 68.43, 68.52, 68.54, 68.55, 68.57, 68.58, 68.58, 68.54, 68.53, 68.51, 68.51, 68.52, 68.52, 68.52, 68.51, 68.5, 68.5, 68.5, 68.49, 68.47, 68.44, 68.42, 68.41, 68.38, 68.38, 68.37, 68.36, 68.35, 68.35, 68.39, 68.39, 68.4, 68.41, 68.42, 68.42, 68.44, 68.46, 68.49, 68.5, 68.52, 68.53, 68.55, 68.56, 68.57, 68.59, 68.59, 68.6, 68.61, 68.63, 68.67, 68.68, 68.7, 68.73, 68.74, 68.75, 68.76, 68.77, 68.77, 68.81, 68.85, 68.86, 68.88, 68.89, 68.91, 68.92, 68.92, 68.93, 68.93, 68.97, 69, 69, 69.03, 69.05, 69.06, 69.06, 69.06, 69.06, 69.06, 69.06, 69.05, 69.06, 69.06, 69.06, 69.06, 69.07, 69.11, 69.12, 69.1, 69.1],
		t_norgeLon: [20.78, 20.84, 21.06, 21.07, 21.13, 21.13, 21.07, 21.03, 21.03, 21.03, 21.03, 21.05, 21.11, 21.16, 21.18, 21.22, 21.29, 21.38, 21.65, 21.69, 21.7, 21.83, 21.87, 21.88, 21.89, 21.9, 21.95, 22.08, 22.09, 22.16, 22.17, 22.18, 22.19, 22.2, 22.3, 22.34, 22.34, 22.35, 22.35, 22.36, 22.37, 22.37, 22.38, 22.41, 22.44, 22.49, 22.52, 22.53, 22.57, 22.7, 22.73, 22.8, 23.02, 23.04, 23.06, 23.07, 23.16, 23.17, 23.2, 23.21, 23.22, 23.24, 23.31, 23.32, 23.34, 23.37, 23.39, 23.44, 23.51, 23.55, 23.59, 23.64, 23.64, 23.67, 23.72, 23.75, 23.77, 23.88, 23.93, 23.96, 24, 24.03, 24.05, 24.15, 24.14, 24.15, 24.19, 24.22, 24.24, 24.27, 24.31, 24.47, 24.62, 24.62, 24.67, 24.71, 24.72, 24.73, 24.78, 24.8, 24.79, 24.8, 24.81, 24.83, 24.85, 24.86, 24.87, 24.9, 24.91, 24.91, 24.91, 24.91, 24.91, 24.92, 24.92, 24.92, 24.93, 24.94, 24.95, 24.98, 24.99, 25, 25.01, 25.04, 25.05, 25.06, 25.07, 25.08, 25.08, 25.09, 25.12, 25.13, 25.13, 25.12, 25.13, 25.12, 25.11, 25.11, 25.12, 25.11, 25.12, 25.12, 25.14, 25.14, 25.13, 25.13, 25.13, 25.16, 25.17, 25.18, 25.21, 25.23, 25.24, 25.25, 25.26, 25.27, 25.29, 25.3, 25.31, 25.32, 25.36, 25.38, 25.39, 25.4, 25.41, 25.41, 25.42, 25.43, 25.45, 25.46, 25.47, 25.48, 25.49, 25.51, 25.52, 25.52, 25.53, 25.54, 25.55, 25.57, 25.58, 25.59, 25.61, 25.61, 25.63, 25.64, 25.65, 25.66, 25.68, 25.69, 25.69, 25.7, 25.71, 25.74, 25.76, 25.77, 25.78, 25.79, 25.74, 25.75, 25.76, 25.76, 25.74, 25.73, 25.72, 25.71, 25.72, 25.73, 25.72, 25.72, 25.73, 25.75, 25.74, 25.75, 25.76, 25.75, 25.76, 25.75, 25.76, 25.75, 25.76, 25.78, 25.79, 25.79, 25.81, 25.82, 25.82, 25.84, 25.85, 25.84, 25.83, 25.83, 25.81, 25.82, 25.81, 25.82, 25.83, 25.84, 25.85, 25.87, 25.86, 25.87, 25.89, 25.88, 25.86, 25.88, 25.92, 25.96, 25.97, 25.99, 25.98, 25.97, 25.95, 25.93, 25.92, 25.91, 25.92, 25.94, 25.95, 25.97, 25.99, 26, 26.05, 26.1, 26.13, 26.14, 26.16, 26.17, 26.2, 26.26, 26.26, 26.28, 26.31, 26.37, 26.4, 26.43, 26.43, 26.42, 26.45, 26.47, 26.47, 26.68, 26.69, 26.7, 26.71, 26.72, 26.72, 26.73, 26.74, 26.79, 26.85, 26.86, 26.85, 26.86, 26.86, 26.87, 26.88, 26.91, 26.93, 26.94, 26.96, 26.98, 27, 27.01, 27.02, 27.04, 27.06, 27.1, 27.15, 27.16, 27.17, 27.24, 27.28, 27.29, 27.3, 27.3, 27.29, 27.29, 27.28, 27.29, 27.3, 27.34, 27.36, 27.38, 27.4, 27.45, 27.46, 27.47, 27.53, 27.53, 27.54, 27.54, 27.56, 27.56, 27.57, 27.61, 27.67, 27.71, 27.74, 27.75, 27.76, 27.77, 27.89, 27.91, 27.95, 27.96, 27.98, 27.98, 27.99, 28.01, 28.16, 28.27, 28.3, 28.34, 28.34, 28.35, 28.35, 28.36, 28.42, 28.43, 28.62, 28.63, 29.13, 29.14, 29.14, 29.14, 29.25, 29.27, 29.29, 29.3, 29.32, 29.33, 29.34, 29.32, 29.31, 29.22, 29.2, 29.01, 28.94, 28.83, 28.83, 28.83, 28.83, 28.82, 28.82, 28.81, 28.81, 28.8, 28.82, 28.83, 28.86, 28.93, 28.95, 28.97, 29.01, 29.03, 29.04, 29.04, 29.05, 29.06, 29.08, 29.1, 29.16, 29.19, 29.24, 29.26, 29.28, 29.32, 29.32, 29.33, 29.33, 29.31, 29.31, 29.3, 29.31, 29.31, 29.31, 29.32, 29.35, 29.4, 29.43, 29.45, 29.49, 29.5, 29.55, 29.57, 29.58, 29.62, 29.67, 29.71, 29.72, 29.76, 29.77, 29.79, 29.81, 29.82, 29.84, 29.87, 29.89, 29.92, 29.93, 29.94, 29.95, 29.97, 29.98, 29.99, 30.02, 30.04, 30.05, 30.06, 30.07, 30.09, 30.12, 30.12, 30.13, 30.14, 30.15, 30.14, 30.15, 30.16, 30.18, 30.2, 30.2, 30.19, 30.19, 30.18, 30.16, 30.16, 30.16, 30.16, 30.15, 30.14, 30.11, 30.11, 30.12, 30.13, 30.15, 30.23, 30.3, 30.31, 30.32, 30.37, 30.36, 30.42, 30.51, 30.52, 30.54, 30.62, 30.67, 30.68, 30.72, 30.73, 30.72, 30.75, 30.82, 30.93, 30.94, 30.94, 30.95, 30.95, 30.95, 30.95, 30.94, 30.93, 30.93, 30.94, 30.94, 30.95, 30.95, 30.94, 30.93, 30.91, 30.9, 30.89, 30.88, 30.89, 30.9, 30.84, 30.83, 30.81, 30.8, 30.79, 30.77, 30.76, 30.72, 30.71, 30.69, 30.79, 30.83, 30.82, 31.11, 31.2, 31.51, 31.52, 31.52, 31.59, 31.64, 31.75, 31.76, 31.76, 31.75, 31.71, 31.66, 31.57, 31.22, 31.14, 30.61, 30.45, 30.05, 30.03, 29.57, 29.16, 28.47, 28.34, 27.98, 27.77, 27.06, 26.68, 25.96, 25.6, 24.92, 24.63, 24.34, 23.99, 23.77, 23.67, 23.25, 22.85, 22.3, 22.24, 21.91, 21.7, 21.17, 20.48, 19.88, 19.38, 18.82, 18.29, 18.18, 17.8, 17.61, 17.44, 17.16, 17.05, 16.9, 16.81, 16.57, 16.25, 15.79, 15.75, 15.29, 15.15, 15.02, 14.79, 14.78, 14.62, 14.37, 14.34, 14.19, 13.95, 13.84, 13.74, 13.7, 13.49, 13.39, 13.26, 13.23, 13.01, 13, 12.8, 12.67, 12.59, 12.47, 12.42, 12.39, 12.28, 12.16, 12.13, 11.99, 11.71, 11.7, 11.48, 11.41, 11.36, 11.31, 11.3, 11.31, 11.35, 11.66, 11.86, 11.63, 11.57, 11.3, 11.08, 10.95, 10.8, 10.67, 10.64, 10.61, 10.58, 10.45, 10.36, 10.15, 10.08, 10, 9.8, 9.7, 9.32, 8.94, 8.62, 8.36, 8.11, 7.65, 7.53, 7.36, 7.11, 6.97, 6.92, 6.86, 6.84, 6.8, 6.62, 6.6, 6.5, 6.34, 6.13, 6.06, 5.98, 5.89, 5.64, 5.51, 5.34, 5.25, 4.94, 4.89, 4.81, 4.68, 4.58, 4.55, 4.44, 4.28, 4.22, 4.17, 4.15, 4.13, 4.13, 4.13, 4.11, 4.1, 4.09, 4.09, 4.09, 4.18, 4.19, 4.24, 4.26, 4.33, 4.36, 4.4, 4.42, 4.43, 4.47, 4.51, 4.52, 4.55, 4.55, 4.56, 4.6, 4.62, 4.64, 4.65, 4.66, 4.67, 4.67, 4.61, 4.6, 4.57, 4.53, 4.48, 4.46, 4.45, 4.47, 4.5, 4.55, 4.6, 4.72, 4.8, 4.89, 4.96, 5.01, 5.05, 5.07, 5.08, 5.14, 5.16, 5.18, 5.22, 5.25, 5.28, 5.34, 5.4, 5.47, 5.52, 5.61, 5.87, 6.04, 6.07, 6.08, 6.15, 6.16, 6.27, 6.39, 6.48, 6.49, 6.77, 6.93, 7.1, 7.16, 7.26, 7.47, 7.59, 7.69, 7.77, 7.84, 7.88, 8.01, 8.09, 8.3, 8.37, 8.46, 8.54, 8.63, 8.68, 8.75, 8.85, 8.9, 8.94, 9.07, 9.3, 9.36, 9.37, 9.53, 9.67, 9.79, 9.97, 9.99, 10.01, 10.06, 10.15, 10.29, 10.36, 10.58, 10.59, 10.64, 10.92, 10.98, 11.07, 11.09, 11.12, 11.15, 11.21, 11.24, 11.26, 11.28, 11.3, 11.31, 11.32, 11.33, 11.34, 11.35, 11.36, 11.37, 11.38, 11.39, 11.39, 11.39, 11.4, 11.41, 11.42, 11.42, 11.43, 11.44, 11.46, 11.45, 11.46, 11.46, 11.46, 11.46, 11.46, 11.45, 11.45, 11.46, 11.47, 11.48, 11.49, 11.5, 11.51, 11.52, 11.53, 11.54, 11.55, 11.56, 11.55, 11.56, 11.57, 11.57, 11.58, 11.58, 11.59, 11.61, 11.62, 11.62, 11.63, 11.64, 11.65, 11.66, 11.66, 11.66, 11.67, 11.67, 11.68, 11.69, 11.69, 11.7, 11.7, 11.71, 11.71, 11.72, 11.72, 11.73, 11.74, 11.75, 11.76, 11.76, 11.78, 11.79, 11.79, 11.78, 11.77, 11.78, 11.79, 11.79, 11.79, 11.79, 11.79, 11.79, 11.8, 11.8, 11.8, 11.8, 11.81, 11.82, 11.83, 11.84, 11.84, 11.84, 11.83, 11.83, 11.84, 11.83, 11.83, 11.83, 11.82, 11.82, 11.8, 11.79, 11.79, 11.78, 11.77, 11.77, 11.77, 11.77, 11.77, 11.76, 11.75, 11.74, 11.72, 11.72, 11.71, 11.71, 11.7, 11.7, 11.71, 11.71, 11.72, 11.72, 11.73, 11.74, 11.75, 11.76, 11.77, 11.79, 11.82, 11.83, 11.84, 11.86, 11.87, 11.88, 11.88, 11.89, 11.9, 11.91, 11.92, 11.93, 11.94, 11.95, 11.95, 11.94, 11.94, 11.94, 11.94, 11.95, 11.95, 11.94, 11.95, 11.94, 11.94, 11.9, 11.9, 11.88, 11.87, 11.86, 11.85, 11.86, 11.87, 11.89, 11.89, 11.91, 11.92, 11.92, 11.93, 11.94, 11.98, 11.99, 12.02, 12.03, 12.04, 12.05, 12.07, 12.08, 12.11, 12.13, 12.15, 12.16, 12.17, 12.18, 12.19, 12.2, 12.21, 12.22, 12.24, 12.25, 12.26, 12.28, 12.31, 12.32, 12.34, 12.35, 12.36, 12.37, 12.38, 12.38, 12.39, 12.41, 12.43, 12.44, 12.45, 12.46, 12.47, 12.48, 12.5, 12.52, 12.52, 12.53, 12.53, 12.54, 12.53, 12.52, 12.52, 12.52, 12.52, 12.51, 12.5, 12.5, 12.5, 12.5, 12.52, 12.54, 12.55, 12.56, 12.57, 12.58, 12.58, 12.59, 12.6, 12.6, 12.61, 12.62, 12.62, 12.62, 12.62, 12.61, 12.61, 12.6, 12.59, 12.57, 12.55, 12.53, 12.53, 12.52, 12.52, 12.52, 12.52, 12.52, 12.51, 12.5, 12.48, 12.46, 12.43, 12.41, 12.4, 12.37, 12.35, 12.35, 12.34, 12.34, 12.34, 12.34, 12.33, 12.33, 12.33, 12.32, 12.31, 12.29, 12.28, 12.26, 12.26, 12.25, 12.23, 12.32, 12.37, 12.38, 12.4, 12.41, 12.44, 12.45, 12.47, 12.49, 12.54, 12.6, 12.61, 12.64, 12.65, 12.66, 12.67, 12.67, 12.68, 12.69, 12.69, 12.7, 12.7, 12.71, 12.71, 12.71, 12.71, 12.79, 12.81, 12.83, 12.84, 12.84, 12.85, 12.85, 12.86, 12.88, 12.86, 12.84, 12.82, 12.79, 12.78, 12.71, 12.64, 12.6, 12.58, 12.55, 12.52, 12.49, 12.47, 12.47, 12.46, 12.43, 12.39, 12.39, 12.36, 12.34, 12.33, 12.3, 12.2, 12.18, 12.14, 12.14, 12.15, 12.15, 12.16, 12.17, 12.17, 12.18, 12.18, 12.19, 12.19, 12.19, 12.22, 12.27, 12.28, 12.28, 12.29, 12.29, 12.3, 12.31, 12.32, 12.32, 12.31, 12.23, 12.22, 12.22, 12.21, 12.17, 12.13, 12.08, 12.07, 12.06, 12.06, 12.07, 12.09, 12.1, 12.1, 12.11, 12.12, 12.13, 12.14, 12.11, 12.11, 12.09, 12.08, 12.13, 12.18, 12.18, 12.2, 12.21, 12.22, 12.23, 12.22, 12.22, 12.2, 12.19, 12.13, 12.08, 12, 11.98, 12, 12.05, 12.06, 12.06, 12.07, 12.08, 12.07, 12.12, 12.22, 12.18, 12.18, 12.15, 12.24, 12.27, 12.34, 12.35, 12.35, 12.38, 12.4, 12.42, 12.44, 12.48, 12.5, 12.52, 12.51, 12.57, 12.62, 12.63, 12.66, 12.69, 12.74, 12.75, 12.76, 12.77, 12.84, 12.86, 12.88, 12.89, 12.92, 13.04, 13.09, 13.15, 13.16, 13.17, 13.2, 13.2, 13.5, 13.65, 13.66, 13.81, 13.83, 13.92, 13.92, 13.97, 13.99, 14.01, 14.03, 14.06, 14.07, 14.1, 14.11, 14.13, 14.16, 14.16, 14.14, 14.13, 14.13, 14.12, 14.12, 14.12, 14.13, 14.13, 14.12, 14.12, 14.09, 14.06, 13.95, 13.92, 13.78, 13.76, 13.7, 13.66, 13.69, 13.7, 13.8, 13.9, 13.92, 13.93, 13.96, 13.98, 13.99, 14.01, 14.06, 14.09, 14.11, 14.13, 14.14, 14.15, 14.17, 14.26, 14.28, 14.32, 14.35, 14.35, 14.36, 14.37, 14.37, 14.39, 14.4, 14.46, 14.52, 14.52, 14.51, 14.51, 14.51, 14.51, 14.51, 14.51, 14.51, 14.51, 14.51, 14.52, 14.52, 14.53, 14.53, 14.53, 14.54, 14.54, 14.54, 14.57, 14.58, 14.59, 14.62, 14.62, 14.63, 14.61, 14.6, 14.6, 14.59, 14.59, 14.58, 14.56, 14.54, 14.53, 14.52, 14.65, 14.83, 14.85, 14.95, 15, 15.03, 15.08, 15.14, 15.36, 15.37, 15.5, 15.49, 15.48, 15.47, 15.45, 15.44, 15.43, 15.42, 15.41, 15.4, 15.4, 15.39, 15.38, 15.42, 15.49, 15.5, 15.59, 15.61, 15.63, 15.65, 15.66, 15.67, 15.71, 15.72, 15.73, 15.75, 15.78, 15.88, 15.89, 15.98, 16.01, 16.02, 16.06, 16.11, 16.16, 16.17, 16.2, 16.23, 16.24, 16.26, 16.3, 16.32, 16.41, 16.4, 16.4, 16.41, 16.41, 16.41, 16.42, 16.41, 16.4, 16.36, 16.35, 16.33, 16.32, 16.31, 16.3, 16.22, 16.19, 16.14, 16.11, 16.12, 16.15, 16.15, 16.17, 16.17, 16.38, 16.4, 16.43, 16.46, 16.47, 16.49, 16.5, 16.52, 16.56, 16.58, 16.59, 16.61, 16.61, 16.62, 16.63, 16.64, 16.65, 16.65, 16.66, 16.66, 16.67, 16.68, 16.69, 16.7, 16.71, 16.72, 16.75, 16.77, 16.81, 16.85, 16.92, 16.93, 16.99, 17.03, 17.15, 17.16, 17.17, 17.19, 17.21, 17.22, 17.25, 17.27, 17.28, 17.29, 17.3, 17.33, 17.41, 17.48, 17.52, 17.63, 17.64, 17.76, 17.78, 17.82, 17.9, 17.91, 17.99, 18.01, 18.08, 18.09, 18.13, 18.15, 18.16, 18.16, 18.14, 18.13, 18.13, 18.13, 18.12, 18.11, 18.11, 18.13, 18.13, 18.21, 18.33, 18.38, 18.42, 18.52, 18.56, 18.62, 18.68, 18.95, 18.98, 18.99, 19.04, 19.08, 19.09, 19.1, 19.14, 19.29, 19.44, 19.54, 19.59, 19.76, 19.78, 19.82, 19.92, 19.96, 19.97, 20, 20.02, 20.05, 20.08, 20.09, 20.12, 20.17, 20.22, 20.27, 20.21, 20.1, 20.08, 20.01, 19.98, 20.01, 20.06, 20.07, 20.09, 20.11, 20.14, 20.21, 20.22, 20.23, 20.26, 20.27, 20.28, 20.29, 20.3, 20.31, 20.35, 20.35, 20.35, 20.34, 20.35, 20.35, 20.35, 20.34, 20.34, 20.33, 20.25, 20.2, 20.18, 20.13, 20.09, 20.07, 20.08, 20.11, 20.29, 20.31, 20.4, 20.41, 20.44, 20.47, 20.55, 20.56, 20.59, 20.69, 20.72, 20.77, 20.78]
        },



});


// systemapic layers
Wu.RasterLayer = Wu.Layer.extend({

	initialize : function (layer) {

		// set source
		this.store = layer; // db object
		
		// data not loaded
		this.loaded = false;

	},


	initLayer : function () {
		this.update();
	},

	update : function () {
		var map = app._map;

		// remove
		// if (this.layer) this.remove();

		this._fileUuid = this.store.file;
		this._defaultCartoid = 'raster';

		// prepare raster
		this._prepareRaster();

		// prepare utfgrid
		// this._prepareGrid();
		
	},


	_prepareRaster : function () {

		// set ids
		var fileUuid 	= this._fileUuid,	// file id of geojson
		    cartoid 	= this.store.data.cartoid || this._defaultCartoid,
		    tileServer 	= app.options.servers.tiles.uri,
		    subdomains  = app.options.servers.tiles.subdomains,
		    token 	= '?token=' + app.Account.getToken(),
		    url 	= tileServer + '{fileUuid}/{cartoid}/{z}/{x}/{y}.png' + token;

		// add vector tile raster layer
		this.layer = L.tileLayer(url, {
			fileUuid: fileUuid,
			cartoid : cartoid,
			subdomains : subdomains,
			maxRequests : 0,
			tms : true
		});

	},

});


Wu.CartodbLayer = Wu.Layer.extend({});

Wu.ErrorLayer = Wu.Layer.extend({})


// shorthand for creating all kinds of layers
Wu.createLayer = function (layer) {
	if (!layer.data) {
		console.error('no layer - weird:', layer);
		return new Wu.ErrorLayer();
	}
	// postgis
	if (layer.data.postgis && layer.data.postgis.file_id) {
		return new Wu.PostGISLayer(layer);
	}
	// mapbox
	if (layer.data.mapbox) return new Wu.MapboxLayer(layer);

	// systemapic vector tiles todo: store not as geojson, but as vector tiles in project db model?
	if (layer.data.geojson) return new Wu.CartoCSSLayer(layer);
	
	// osm
	if (layer.data.osm) return new Wu.OSMLayer(layer);

	// topojson
	if (layer.data.topojson) return new Wu.TopojsonLayer(layer);

	// raster
	if (layer.data.raster) return new Wu.RasterLayer(layer);

	// raster
	if (layer.data.norkart) return new Wu.NorkartLayer(layer);

	// raster
	if (layer.data.google) return new Wu.GoogleLayer(layer);

	return new Wu.ErrorLayer();
}







// update options and redraw
L.TileLayer.include({
	setOptions : function (options) {
		L.setOptions(this, options);
		this.redraw();
	}
});

L.UtfGrid.include({
	setOptions : function (options) {
		L.setOptions(this, options);
		this.redraw();
	}
});





// // topojson layer
// Wu.TopojsonLayer = Wu.Layer.extend({

// 	type : 'topojsonLayer',

// 	initLayer : function () {
// 		var that = this;
	       
// 		// create leaflet geoJson layer
// 		this.layer = L.topoJson(false, {
// 			// create popup
// 			onEachFeature : this.createPopup
// 		});

// 	}	
// });

// // extend leaflet geojson with topojson conversion (test) - works! but doesn't solve any problems
// L.TopoJSON = L.GeoJSON.extend({
// 	addData: function(jsonData) {    
// 		if (jsonData.type === "Topology") {
// 			for (key in jsonData.objects) {
// 				geojson = topojson.feature(jsonData, jsonData.objects[key]);
// 				L.GeoJSON.prototype.addData.call(this, geojson);
// 			}
// 		} 
// 		else {
// 			L.GeoJSON.prototype.addData.call(this, jsonData);
// 		}
// 	}  
// });

// L.topoJson = function (json, options) {
// 	return new L.TopoJSON(json, options);
// };






// Wu.RasterLayer = Wu.Layer.extend({
// 	type : 'rasterLayer',
// });


// // systemapic layers
// Wu.CartoCSSLayer = Wu.Layer.extend({

// 	initLayer : function () {
// 		this.update();
// 		this.addHooks();

// 		this._inited = true;
// 	},

// 	update : function () {
// 		var map = app._map;

// 		// remove
// 		if (this.layer) this._flush();

// 		this._fileUuid = this.store.file;
// 		this._defaultCartoid = 'cartoid';

// 		// prepare raster
// 		this._prepareRaster();

// 		// prepare utfgrid
// 		this._prepareGrid();
		
// 	},

// 	_prepareRaster : function () {
		
// 		// set ids
// 		var fileUuid 	= this._fileUuid,	// file id of geojson
// 		    cartoid 	= this.store.data.cartoid || this._defaultCartoid,
// 		    tileServer 	= app.options.servers.tiles.uri,
// 		    subdomains  = app.options.servers.tiles.subdomains,
// 		    token 	= '?token=' + app.Account.getToken(),
// 		    url 	= tileServer + '{fileUuid}/{cartoid}/{z}/{x}/{y}.png' + token;

// 		// add vector tile raster layer
// 		this.layer = L.tileLayer(url, {
// 			fileUuid: this._fileUuid,
// 			cartoid : cartoid,
// 			subdomains : subdomains,
// 			maxRequests : 0,
// 		});

// 		Wu.DomEvent.on(this.layer, 'load', this._updateGrid, this);
// 	},

// 	_updateGrid : function (l) {



// 		// refresh of gridlayer is attached to layer. this because vector tiles are not made in vile.js, 
// 		// and it's much more stable if gridlayer requests tiles after raster layer... perhpas todo: improve this hack!
// 		// - also, removed listeners in L.UtfGrid (onAdd)
// 		// 
// 		if (this.gridLayer) this.gridLayer._update();
// 	},

// 	_prepareGrid : function () {

// 		// set ids
// 		var fileUuid 	= this._fileUuid,	// file id of geojson
// 		    cartoid 	= this.store.data.cartoid || 'cartoid',
// 		    gridServer 	= app.options.servers.utfgrid.uri,
// 		    subdomains  = app.options.servers.utfgrid.subdomains,
// 		    // token 	= app.accessToken,
// 		    token 	= '?token=' + app.Account.getToken(),
// 		    url 	= gridServer + '{fileUuid}/{z}/{x}/{y}.grid.json' + token;
		
// 		// create gridlayer
// 		this.gridLayer = new L.UtfGrid(url, {
// 			useJsonP: false,
// 			subdomains: subdomains,
// 			maxRequests : 0,
// 			requestTimeout : 10000,
// 			fileUuid : fileUuid
// 		});

// 		// debug
// 		// this.gridLayer = false;

// 		// add grid events
// 		this._addGridEvents();

// 	},

// 	updateStyle : function () {
// 		// set new options and redraw
// 		if (this.layer) this.layer.setOptions({
// 			cartoid : this.getCartoid(),
// 		});
// 	},

// 	_typeLayer : function () {

// 	},

// });




// Wu.OSMLayer = Wu.CartoCSSLayer.extend({

// 	update : function () {
// 		var map = app._map;

// 		// remove
// 		if (this.layer) this._flush();

// 		// id of data 
// 		this._fileUuid = 'osm';
// 		this._defaultCartoid = 'cartoidosm';

// 		// prepare raster
// 		this._prepareRaster();

// 		// prepare utfgrid
// 		this._prepareGrid();
		
// 	},

// 	_prepareRaster : function () {
		
// 		// set ids
// 		var fileUuid 	= this._fileUuid,	// file id of geojson
// 		    cartoid 	= this.store.data.cartoid || this._defaultCartoid,
// 		    tileServer 	= app.options.servers.osm.uri,
// 		    subdomains  = app.options.servers.osm.subdomains,
// 		    token 	= '?token=' + app.Account.getToken(),
// 		    url 	= tileServer + '{fileUuid}/{cartoid}/{z}/{x}/{y}.png' + token;

// 		// add vector tile raster layer
// 		this.layer = L.tileLayer(url, {
// 			fileUuid: this._fileUuid,
// 			cartoid : cartoid,
// 			subdomains : subdomains,
// 			maxRequests : 0,
// 		});
// 	},

// 	_prepareGrid : function () {

// 		// set ids
// 		var fileUuid 	= this._fileUuid,	// file id of geojson
// 		    cartoid 	= this.store.data.cartoid || 'cartoid',
// 		    gridServer 	= app.options.servers.osm.uri,
// 		    subdomains  = app.options.servers.osm.subdomains,
// 		    token 	= '?token=' + app.Account.getToken(),
// 		    url 	= gridServer + fileUuid + '/{z}/{x}/{y}.grid.json' + token;
		
// 		// create gridlayer
// 		// this.gridLayer = new L.UtfGrid(url, {
// 		// 	useJsonP: false,
// 		// 	subdomains: subdomains,
// 		// 	// subdomains: 'ijk',
// 		// 	// subdomains: 'ghi',
// 		// 	maxRequests : 10,
// 		// 	requestTimeout : 20000
// 		// });

// 		// debug
// 		this.gridLayer = false;

// 		// add grid events
// 		this._addGridEvents();

// 	},

// 	getFileUuid : function () {
// 		return 'osm';
// 	},

// 	setCartoCSS : function (json, callback) {

// 		// send to server
// 		Wu.post('/api/layers/cartocss/set', JSON.stringify(json), callback, this);
	
// 		// set locally on layer
// 		this.setCartoid(json.cartoid);
// 	},

// 	getCartoCSS : function (cartoid, callback) {

// 		var json = {
// 			cartoid : cartoid
// 		}

// 		// get cartocss from server
// 		Wu.post('/api/layers/cartocss/get', JSON.stringify(json), callback, this);
// 	},

// 	updateStyle : function () {

// 		// set new options and redraw
// 		if (this.layer) this.layer.setOptions({
// 			cartoid : this.getCartoid(),
// 		});

// 	},



// });



