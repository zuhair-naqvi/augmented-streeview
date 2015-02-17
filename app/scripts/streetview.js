// ==================================================================================================
// Street View Tour version 1 (beta)
// ==================================================================================================
// Copyright (c) 2013 Robert McMahon, Map Channels, http://teammaps.com.
// Licensed under the Apache License http://www.apache.org/licenses/LICENSE-2.0.
//
// You are free to use and modify this code provided that you:
// (1) Include this notice within the javascript code
// (2) Display a link to http://teammaps.com on the page that contains the Street View Tour.
// ==================================================================================================

var svt = null;
var map = null;
var pan = null;

// the main application object
function SVT()
{
    this.maximumDistance = 200;

    // dimensions of street view container (fixed)
    this.panWidth = 1600;
    this.panHeight = 780;

    // used when scaling markers in street view
    this.baseDistance = 25;

    this.placeList = [];
    this.placeLookup = [];

    this.showMarkers = true;
    this.mapBounds = null;

    this.streetviewService = new google.maps.StreetViewService();
}



// convert the current heading and pitch (degrees) into pixel coordinates
SVT.prototype.convertPointProjection = function (pov, pitch, zoom)
{
    // fov angles are magic numbers, when pan has a different dimension then different values will work better
    var fovAngleHorizontal = 90 / zoom;
    var fovAngleVertical = 60 / zoom;

    var midX = this.panWidth / 2;
    var midY = this.panHeight / 2;

    var diffHeading = this.sheading - pov.heading;
    diffHeading = normalizeAngle(diffHeading);
    diffHeading /= fovAngleHorizontal;

    var diffPitch = (pov.pitch - pitch) / fovAngleVertical;

    var x = midX + diffHeading * this.panWidth;
    var y = midY + diffPitch * this.panHeight;

    var point = new google.maps.Point(x, y);

    return point;
}


SVT.prototype.initPlaces = function ()
{
    var total = placesData.length;

    this.mapBounds = new google.maps.LatLngBounds();

    for (var i = 0; i < total; i++)
    {
        var place = new Place(i);

        this.placeList.push(place);
        this.placeLookup[place.id] = place;

        this.mapBounds = this.mapBounds.extend(place.pt);
    }
}

SVT.prototype.initPlaceMarkers = function ()
{
    for (var i in this.placeList)
    {
        var place = this.placeList[i];

        place.createMapMarker();
        place.createStreetViewMarker();
    }
}
function loadPage()
{
    google.maps.visualRefresh = true;

    svt = new SVT();

    svt.initPlaces();

    svt.initMap();
    svt.initPanorama(svt.placeList[0]);
    svt.initPlaceMarkers();
    svt.initIndex();

    setTimeout("loadPage2()", 500);
}


function loadPage2()
{
    var place = svt.placeList[0];
    if (place)
    {
        placeClick(place.id);
    }
}


// create map
SVT.prototype.initMap = function ()
{
    var mapDiv = eid("mapDiv");

    var mapOptions =
    {
        center: this.pt,
        zoom: this.zoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        scaleControl: true,
        mapTypeControl: true
    };

    map = new google.maps.Map(mapDiv, mapOptions);
    map.fitBounds(this.mapBounds);

    // event handlers    
    google.maps.event.addListener(map, 'click', function (a)
    {
        var pt = a.latLng;

        eid("markerInfo").innerHTML = "<b>Map Click</b> &nbsp; @ lat: " + formatFloat(pt.lat(), 6) + " lng: " + formatFloat(pt.lng(), 6);
    });
}



// create street view
SVT.prototype.displayPanoramaStats = function ()
{
    var pt = pan.getPosition();
    var pov = pan.getPov();

    eid("positionDiv").innerHTML = 
        "slat:" + formatFloat(pt.lat(), 6) + 
        ", slng: " + formatFloat(pt.lng(), 6) + 
        ", heading: " + formatFloat(pov.heading, 2) +
        ", pitch: " + formatFloat(pov.pitch, 2);
}

SVT.prototype.initPanorama = function (place)
{
    var visible = false;
    var panDiv = eid("panDiv");

    // controls can be hidden here to prevent the position being changed by the user
    var panOptions =
    {
        // zoomControl: false,
        // linksControl: false
    };

    console.log(place);

    panOptions.pano = place.id;
    panOptions.pov =
    {
        heading: place.heading,
        pitch: place.pitch
        // zoom: this.szoom
    };

    pan = new google.maps.StreetViewPanorama(panDiv, panOptions);

    map.setStreetView(pan);

    // event handlers    
    google.maps.event.addListener(pan, 'pov_changed', function ()
    {
        setTimeout("svt.updateAllStreetViewMarkers();", 10);
    });

    google.maps.event.addListener(pan, 'zoom_changed', function ()
    {
        setTimeout("svt.updateAllStreetViewMarkers();", 10);
    });

    google.maps.event.addListener(pan, 'position_changed', function ()
    {
        svt.streetPt = pan.getPosition();
        map.setCenter(svt.streetPt);

        setTimeout("svt.updateAllStreetViewMarkers();", 10);
    });

}


SVT.prototype.findNearestStreetView = function (place)
{
    if (place.streetPt != null)
    {
        // use preset streetview coordinates
        pan.setPosition(place.streetPt);

        // get pov
        var heading = place.heading;
        if (heading == null)
        {
            heading = google.maps.geometry.spherical.computeHeading(place.streetPt, place.pt);
        }
        if (place.pitch == null)
        {
            place.pitch = 0;
        }
        pan.setPov(
            {
                heading: heading,
                pitch: place.pitch + 0.1,
                zoom: place.zoom
            });
    }
    else
    {
        // find closest streetview within 50 metres
        this.streetviewService.getPanoramaByLocation(place.pt, 50, function (data, status)
        {
            if (status == google.maps.StreetViewStatus.OK)
            {
                var location = data.location;
                var streetPt = location.latLng;

                pan.setPosition(streetPt);

                // get pov
                var heading = google.maps.geometry.spherical.computeHeading(streetPt, place.pt);

                pan.setPov(
                    {
                        heading: heading,
                        pitch: 0.1,
                        zoom: place.zoom
                    });
            }
            else
            {
                // street view unavilable, do nothing
                return;
            }

        });
    }

    // this.updateAllStreetViewMarkers();
    setTimeout("svRefresh()", 200);
}

// additional adjustment to fix bug where streetviews are only partially uipdated after moving to a new location.
function svRefresh()
{
    var pov = pan.getPov();

    pov.pitch -= 0.1;
    pan.setPov(pov);

    glog("svRefresh " + pov.pitch);
}



function Place(i)
{
    var placeData = placesData[i];

    this.id = placeData.id;

    this.name = placeData.name;
    this.icon = placeData.icon;
    this.iconWidth = placeData.iconWidth;
    this.iconHeight = placeData.iconHeight;

    this.pt = new google.maps.LatLng(placeData.lat, placeData.lng);
    this.streetPt = null;
    if (typeof (placeData.slat) != "undefined" && typeof (placeData.slng) != "undefined")
    {
        this.streetPt = new google.maps.LatLng(placeData.slat, placeData.slng);
    }
    this.pitch = placeData.pitch;
    this.zoom = placeData.zoom;
    this.elevation = placeData.elevation;
    this.maximumDistance = placeData.maximumDistance;

    this.heading = null;
    if (typeof (placeData.heading) != "undefined")
    {
        this.heading = placeData.heading;
    }

    // properties which are updated as the street view changes
    this.markerPitch = 0;
    this.distance = 0;
    this.markerDiv = null;
    this.pov = null;
    this.pixelPoint = null;
}


Place.prototype.createMapMarker = function ()
{
    var place = this;

    var overlayOptions =
    {
        position: this.pt,
        map: map,
        title: this.name
    };

    var marker = new google.maps.Marker(overlayOptions);

    this.mapMarker = marker;

    // event handlers    
    google.maps.event.addListener(marker, "click", function ()
    {
        eid("markerInfo").innerHTML = "<b>Marker Click</b> " + place.name;

        map.setCenter(place.pt);
        pan.setZoom(place.zoom);

        // svt.findNearestStreetView(place);
    });
}

SVT.prototype.updateMapMarker = function (place)
{
    place.mapMarker.setMap(this.showMarkers ? map : null);
}

// create the 'marker' (a div containing an image which can be clicked)
Place.prototype.createStreetViewMarker = function ()
{
    var markerDiv = document.createElement("div");
    markerDiv.innerHTML = "<img src='" + this.icon + "' width='100%' height='100%' alt='' />";
    markerDiv.style.position = "absolute";
    markerDiv.style.left = "0px";
    markerDiv.style.top = "0px";
    markerDiv.style.width = "0px";
    markerDiv.style.height = "0px";

    markerDiv.style.zIndex = 1000;
    markerDiv.style.display = "none";
    markerDiv.style.cursor = "pointer";

    markerDiv.title = this.name;

    markerDiv.onclick = markerClick;

    eid("panFrame").appendChild(markerDiv);

    this.markerDiv = markerDiv;

    // svt.updateStreetViewMarker(this);
}

SVT.prototype.updateStreetViewMarker = function (place)
{
    var pov = pan.getPov();
    if (pov)
    {
        var zoom = pan.getZoom();

        // scale according to street view zoom level
        var adjustedZoom = Math.pow(2, zoom) / 2;

        // recalulate icon heading and pitch now
        this.sheading = google.maps.geometry.spherical.computeHeading(this.streetPt, place.pt)
        place.distance = google.maps.geometry.spherical.computeDistanceBetween(this.streetPt, place.pt);

        verticalAngle = (360 / Math.PI) * Math.tan(place.elevation / (place.distance + 0.1));
        place.markerPitch = verticalAngle;

        var pixelPoint = this.convertPointProjection(pov, place.markerPitch, adjustedZoom);

        var distanceScale = this.baseDistance / place.distance;
        adjustedZoom = adjustedZoom * distanceScale;

        // _TODO scale marker according to distance from view point to marker 
        // beyond maximum range a marker will not be visible

        // apply position and size to the marker div
        var wd = place.iconWidth * adjustedZoom;
        var ht = place.iconHeight * adjustedZoom;

        var x = pixelPoint.x - Math.floor(wd / 2);
        var y = pixelPoint.y - Math.floor(ht / 2);

        var markerDiv = place.markerDiv;
        markerDiv.style.display = "block";
        markerDiv.style.left = x + "px";
        markerDiv.style.top = y + "px";
        markerDiv.style.width = wd + "px";
        markerDiv.style.height = ht + "px";
        markerDiv.style.zIndex = Math.floor(1000000 / (place.distance + 1));


        // hide marker when its beyond the maximum distance
        var markerVisible = this.showMarkers;
        if (place.distance > place.maximumDistance)
        {
            markerVisible = false;
        }

        markerDiv.style.display = (markerVisible) ? "block" : "none";
        
        // diagnostics
        // glog(place.name + " : " + Math.floor(place.distance) + " m, zoom=" + zoom);
    }
}

SVT.prototype.updateAllStreetViewMarkers = function ()
{
    for (var i in this.placeList)
    {
        var place = this.placeList[i];
        this.updateStreetViewMarker(place);
    }

    this.displayPanoramaStats();
}

SVT.prototype.updateAllMapMarkers = function ()
{
    for (var i in this.placeList)
    {
        var place = this.placeList[i];
        this.updateMapMarker(place);
    }
}

// display a message when the user clicks on the marker's div
function markerClick()
{
    eid("markerInfo").innerHTML = "<h2>Clicked</h2>";
}


function showMarkersClick(a)
{
    svt.showMarkers = a.checked;

    svt.updateAllStreetViewMarkers();
    svt.updateAllMapMarkers();
}

function placeClick(id)
{
    var place = svt.placeLookup[id];
    if (place)
    {
        map.setCenter(place.pt);
        pan.setZoom(place.zoom);
        // svt.findNearestStreetView(place);
    }
}


SVT.prototype.initIndex = function ()
{
    var html = "<h3>Index</h3>";
    for (var i in this.placeList)
    {
        var place = this.placeList[i];

        html += "<div style='padding:2px'><a href='javascript:placeClick(\"" + place.id + "\")'>" + place.name + "</a></div>";
    }

    eid("indexDiv").innerHTML = html;
}



// utils
function eid(id)
{
    return document.getElementById(id);
}

function glog(a)
{
    if (typeof (console) != "undefined" && console && console.log)
    {
        console.log(a);
    }
}


function formatFloat(n, d)
{
    var m = Math.pow(10, d);
    return Math.round(n * m, 10) / m;
}


function normalizeAngle(a)
{

    while (a > 180)
    {
        a -= 360;
    }

    while (a < -180)
    {
        a += 360;
    }

    return a;
}
