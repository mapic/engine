













// L.Popup = L.Class.extend({
// 	includes: L.Mixin.Events,

// 	options: {
// 		minWidth: 50,
// 		maxWidth: 300,
// 		// maxHeight: null,
// 		autoPan: true,
// 		closeButton: true,
// 		offset: [0, 7],
// 		autoPanPadding: [0, 0],
// 		autoPanPaddingTopLeft: L.point(10, 40),
// 		autoPanPaddingBottomRight: L.point(10, 20),
// 		keepInView: false,
// 		className: '',
// 		zoomAnimation: false,
// 	},

// 	initialize: function (options, source) {

// 		L.setOptions(this, options);

// 		this._source = source;
// 		this._animated = L.Browser.any3d && this.options.zoomAnimation;
// 		this._isOpen = false;
// 	},

// 	onAdd: function (map) {

// 		this._map = map;

// 		if (!this._container) {
// 			this._initLayout();
// 		}

// 		var animFade = map.options.fadeAnimation;

// 		if (animFade) {
// 			L.DomUtil.setOpacity(this._container, 0);
// 		}
// 		map._panes.popupPane.appendChild(this._container);

// 		map.on(this._getEvents(), this);

// 		this.update();

// 		if (animFade) {
// 			L.DomUtil.setOpacity(this._container, 1);
// 		}

// 		this.fire('open');

// 		map.fire('popupopen', {popup: this});

// 		if (this._source) {
// 			this._source.fire('popupopen', {popup: this});
// 		}
// 	},

// 	addTo: function (map) {
// 		map.addLayer(this);
// 		return this;
// 	},

// 	openOn: function (map) {
// 		map.openPopup(this);
// 		return this;
// 	},

// 	onRemove: function (map) {
// 		map._panes.popupPane.removeChild(this._container);

// 		L.Util.falseFn(this._container.offsetWidth); // force reflow

// 		map.off(this._getEvents(), this);

// 		if (map.options.fadeAnimation) {
// 			L.DomUtil.setOpacity(this._container, 0);
// 		}

// 		this._map = null;

// 		this.fire('close');

// 		map.fire('popupclose', {popup: this});

// 		if (this._source) {
// 			this._source.fire('popupclose', {popup: this});
// 		}
// 	},

// 	getLatLng: function () {
// 		return this._latlng;
// 	},

// 	setLatLng: function (latlng) {
// 		this._latlng = L.latLng(latlng);
// 		if (this._map) {
// 			this._updatePosition();
// 			this._adjustPan();
// 		}
// 		return this;
// 	},

// 	getContent: function () {
// 		return this._content;
// 	},

// 	setContent: function (content) {

// 		this._content = content;
// 		this.update();
// 		return this;
// 	},

// 	update: function () {
// 		if (!this._map) { return; }

// 		this._container.style.visibility = 'hidden';

// 		this._updateContent();
// 		this._updateLayout();
// 		this._updatePosition();

// 		this._container.style.visibility = '';

// 		this._adjustPan();
// 	},

// 	_getEvents: function () {
// 		var events = {
// 			viewreset: this._updatePosition
// 		};

// 		if (this._animated) {
// 			events.zoomanim = this._zoomAnimation;
// 		}
// 		if ('closeOnClick' in this.options ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
// 			events.preclick = this._close;
// 		}
// 		if (this.options.keepInView) {
// 			events.moveend = this._adjustPan;
// 		}

// 		return events;
// 	},

// 	_close: function () {
// 		if (this._map) {
// 			this._map.closePopup(this);
// 		}
// 	},

// 	_initLayout: function () {

// 		var prefix = 'leaflet-popup',
// 		    containerClass = prefix + ' ' + this.options.className + ' leaflet-zoom-' + (this._animated ? 'animated' : 'hide'),
// 		    container = this._container = L.DomUtil.create('div', containerClass),
// 		    closeButton;


// 		if (this.options.closeButton) {
// 			closeButton = this._closeButton =
// 			L.DomUtil.create('a', prefix + '-close-button', container);
// 			closeButton.href = '#close';
// 			closeButton.innerHTML = '&#215;';
// 			L.DomEvent.disableClickPropagation(closeButton);
// 			L.DomEvent.on(closeButton, 'mouseup', this._onCloseButtonClick, this);
// 		}

// 		var wrapper = this._wrapper = L.DomUtil.create('div', prefix + '-content-wrapper', container);
// 		L.DomEvent.disableClickPropagation(wrapper);

// 		// draggable popup
// 		// this._initDraggable();

// 		this._contentNode = L.DomUtil.create('div', prefix + '-content', wrapper);

// 		L.DomEvent.disableScrollPropagation(this._contentNode);
// 		L.DomEvent.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

// 		this._tipContainer = L.DomUtil.create('div', prefix + '-tip-container', container);
// 		this._tip = L.DomUtil.create('div', prefix + '-tip', this._tipContainer);


		


// 	},


// 	_onPinButtonClick : function () {
// 		console.log('_pinPopup');
// 	},


// 	// // systemapic dragging
// 	// _initDraggable : function () {

// 	// 	var dragPane = Wu.DomUtil.create('div', 'leaflet-popup-drag', this._wrapper);

// 	// 	Wu.DomEvent.on(dragPane, 'mousedown', this._dragStart, this);
// 	// },

// 	// _dragStart : function (e) {


// 	// 	// this._dragStartAbsoluteMousePosition = {
// 	// 	// 	x : this._container.offsetLeft + e.offsetX,
// 	// 	// 	y : this._container.offsetTop + e.offsetY
// 	// 	// }

// 	// 	console.log('..this._dragStartAbsoluteMousePosition', this._dragStartAbsoluteMousePosition);
		

// 	// 	// create ghost pane
// 	// 	this._ghost = Wu.DomUtil.create('div', 'leaflet-popup-ghost', app._appPane);
// 	// 	console.log('ghost: ', this._ghost);

// 	// 	Wu.DomEvent.on(this._ghost, 'mouseup', this._dragStop, this);
// 	// 	Wu.DomEvent.on(this._ghost, 'mousemove', this._dragging, this);

// 	// },

// 	// _dragStop : function (e) {
		
// 	// 	Wu.DomEvent.off(this._ghost, 'mouseup', this._dragStop, this);
// 	// 	Wu.DomEvent.off(this._ghost, 'mousemove', this._dragging, this);
		
// 	// 	Wu.DomUtil.remove(this._ghost);
// 	// 	console.log('dragstop');

// 	// 	// // save position
// 	// 	// var project = app.activeProject;
// 	// 	// project.setPopupPosition(this._lastPopupPos);

// 	// },

// 	// _dragging : function (e) {

// 	// 	// get popup latlng

// 	// 	var latlng = this.getLatLng();

// 	// 	console.log('popup latlng: ', latlng);
		

// 	// 	var point = app._map.latLngToLayerPoint(latlng);

// 	// 	console.log('popup point: ', point);

// 	// 	var mouseLatlng = app._map.mouseEventToLatLng(e);

// 	// 	var mousePoint = app._map.latLngToLayerPoint(latlng);

// 	// 	console.log('mouse latlng', mouseLatlng);
// 	// 	console.log('mouse point', mousePoint);

// 	// 	// this.setLatLng(mouseLatlng);

// 	// 	// var s = this._dragStartAbsoluteMousePosition;

// 	// 	// var diff = {
// 	// 	// 	x : e.offsetX - s.x,
// 	// 	// 	y : e.offsetY - s.y
// 	// 	// }

// 	// 	// if (!diff.x || !diff.y) return;

// 	// 	// // this._lastPopupPos = L.point(diff.x, diff.y);
// 	// 	// this._lastPopupPos = L.point(e.offsetX, e.offsetY);

// 	// 	// var latlng = app._map.layerPointToLatLng(this._lastPopupPos, app._map.getZoom());

// 	// 	// console.log('pointToLatLng', latlng);

// 	// 	// this.setLatLng(latlng);

// 	// 	// set popup position
// 	// 	// this.setPosition(this._lastPopupPos);
// 	// },

// 	// _mapMove : function (a, b) {
// 	// 	console.log('mapMove', a, b);
	
// 	// 	// set popup position
// 	// 	// if (this._lastPopupPos) this.setPosition(this._lastPopupPos);
// 	// },

// 	// setPosition : function (pos) {
// 	// 	// set popup position
// 	// 	L.DomUtil.setPosition(this._container, pos); // translate3D or style.left
// 	// },

// 	_updateContent: function () {
// 		if (!this._content) { return; }

// 		if (typeof this._content === 'string') {
// 			// this._contentNode.innerHTML = this._content;
// 			this._contentNode.appendChild(this._content);

// 		} else {
// 			while (this._contentNode.hasChildNodes()) {
// 				this._contentNode.removeChild(this._contentNode.firstChild);
// 			}
// 			this._contentNode.appendChild(this._content);
// 		}
// 		this.fire('contentupdate');
// 	},

// 	_updateLayout: function () {

// 		// var _extraWidth = 46;
// 		// Additional adjustment for FRANO		
// 		// var _extraWidth = 170;
// 		var _extraWidth = 70;

// 		console.log('updateLA');

// 		var container = this._contentNode,
// 		    style = container.style;

// 		var parent_container = container.parentNode;  

// 		style.width = '';
// 		style.whiteSpace = 'nowrap';

// 		var width = container.offsetWidth;
// 		width = Math.min(width, this.options.maxWidth);
// 		width = Math.max(width, this.options.minWidth);

// 		var newWidth = (width + _extraWidth) + 'px';
		
// 		style.width = newWidth;
// 		style.whiteSpace = '';
// 		style.height = '';

// 		var height = container.offsetHeight,
// 		    maxHeight = this.options.maxHeight,
// 		    scrolledClass = 'leaflet-popup-scrolled';


// 		// Additional adjustment for FRANO
// 		maxHeight += 165;


// 		if (maxHeight && height > maxHeight) {
// 			style.height = maxHeight + 'px';
// 			L.DomUtil.addClass(container, scrolledClass);
// 		} else {
// 			L.DomUtil.removeClass(container, scrolledClass);
// 		}

// 		this._containerWidth = this._container.offsetWidth;

// 		parent_container.style.width = newWidth;
// 	},

// 	_updatePosition: function () {
// 		console.log('_updatePosition');
// 		if (!this._map) { return; }

// 		var pos = this._map.latLngToLayerPoint(this._latlng),
// 		    animated = this._animated,
// 		    offset = L.point(this.options.offset);

// 		    console.log('pospos', pos);

// 		if (animated) {
// 			L.DomUtil.setPosition(this._container, pos);
// 		}



// 		this._containerBottom = - offset.y - (animated ? 0 : pos.y);

// 		this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x + (animated ? 0 : pos.x);

// 		// bottom position the popup in case the height of the popup changes (images loading etc)
// 		this._container.style.bottom = this._containerBottom + 'px';
// 		this._container.style.left = this._containerLeft + 'px';
// 	},

// 	_zoomAnimation: function (opt) {
// 		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center);

// 		console.log('zoomAnimation', pos);

// 		L.DomUtil.setPosition(this._container, pos);
// 	},

// 	_adjustPan: function () {
// 		if (!this.options.autoPan) { return; }

// 		console.log('adjustPan');

// 		var map = this._map,
// 		    containerHeight = this._container.offsetHeight, // todo: add padding for autoPan before pan
// 		    containerWidth = this._containerWidth,

// 		    layerPos = new L.Point(this._containerLeft, -containerHeight - this._containerBottom);

// 		if (this._animated) {
// 			layerPos._add(L.DomUtil.getPosition(this._container));
// 		}

// 		var containerPos = map.layerPointToContainerPoint(layerPos),
// 		    padding = L.point(this.options.autoPanPadding),
// 		    paddingTL = L.point(this.options.autoPanPaddingTopLeft || padding),
// 		    paddingBR = L.point(this.options.autoPanPaddingBottomRight || padding),
// 		    size = map.getSize(),
// 		    dx = 0,
// 		    dy = 0;

// 		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
// 			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
// 		}
// 		if (containerPos.x - dx - paddingTL.x < 0) { // left
// 			dx = containerPos.x - paddingTL.x;
// 		}
// 		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
// 			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
// 		}
// 		if (containerPos.y - dy - paddingTL.y < 0) { // top
// 			dy = containerPos.y - paddingTL.y;
// 		}

// 		if (dx || dy) {
// 			map
// 			    .fire('autopanstart')
// 			    .panBy([dx, dy]);
// 		}
// 	},

// 	_onCloseButtonClick: function (e) {
// 		this._close();
// 		L.DomEvent.stop(e);
// 	},


// });







































// smoother zooming, especially on apple mousepad
L._lastScroll = new Date().getTime();
L.Map.ScrollWheelZoom.prototype._onWheelScroll = function (e) {
    if (new Date().getTime() - L._lastScroll < 200) { return; }
    var delta = L.DomEvent.getWheelDelta(e);
    var debounce = this._map.options.wheelDebounceTime;

    this._delta += delta;
    this._lastMousePos = this._map.mouseEventToContainerPoint(e);

    if (!this._startTime) {
        this._startTime = +new Date();
    }

    var left = Math.max(debounce - (+new Date() - this._startTime), 0);

    clearTimeout(this._timer);
    L._lastScroll = new Date().getTime();
    this._timer = setTimeout(L.bind(this._performZoom, this), left);

    L.DomEvent.stop(e);
}



L.Map.include({

	// refresh map container size
	reframe: function (options) {
		if (!this._loaded) { return this; }
		this._sizeChanged = true;
		this.fire('moveend');
	}
});


L.Polygon.include({

	getCenter: function () {
		var i, j, p1, p2, f, area, x, y, center,
		    points = this._rings[0],
		    len = points.length;

		if (!len) { return null; }

		// polygon centroid algorithm; only uses the first ring if there are multiple

		area = x = y = 0;

		for (i = 0, j = len - 1; i < len; j = i++) {
			p1 = points[i];
			p2 = points[j];

			f = p1.y * p2.x - p2.y * p1.x;
			x += (p1.x + p2.x) * f;
			y += (p1.y + p2.y) * f;
			area += f * 3;
		}

		if (area === 0) {
			// Polygon is so small that all points are on same pixel.
			center = points[0];
		} else {
			center = [x / area, y / area];
		}
		return this._map.layerPointToLatLng(center);
	},
})

// prevent minifed bug
L.Icon.Default.imagePath = '/css/images';