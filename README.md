# oi.map.js

A very basic, lightweight, slippy map.

We regularly use the excellent [Leaflet](https://leafletjs.com/) to create interactive maps on our websites. It is incredibly powerful. However, for some of our use cases, the Javascript file is the largest single resource. We wanted to be able to get a basic interactive map for as little bandwidth use as we could - and so this library was created.

This library aims to stay as small as possible so there is no plan to add all the amazing functionality of Leaflet - use Leaflet for that.

## Usage

```
var map = new OI.map(<DOM>,{
  'center': [lat,lon],
  'zoom': 17
});
```

where `<DOM>` is the DOM element to attach the map to.

You can then add a tile layer using e.g.

```
OI.map.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);
```

The following methods are available:

```
// set the map to contain the given geographical bounds with the maximum zoom level possible
map.fitBounds({'nw':{'lat':54,'lon':-1.8},'se':{'lat':53,'lon':-1.6}});

// get the map bounds
map.getBounds();

// get the map centre
map.getCenter();

// return the zoom level
map.getZoom();

// set the zoom level
map.setZoom(17);

// zoom in by the number of zoom levels
map.zoomIn(2);

// zoom out by the number of zoom levels
map.zoomOut(2);

// pan the map from the centre
map.panBy({'x':5,'y':10},{'animate':true,'duration':1});
```

## Plugins

There is currently one 'plugin' - oi.map.overlay.js - that adds the ability to display GeoJSON layers on the map with some basic styling. The way of calling the code is designed to be as similar to Leaflet's as we could get it (but not quite identical) so that it is relatively easy to switch to Leaflet if the requirements for a particular web map increase.


