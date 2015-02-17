
var Stage = (function(){
	var mapEl = 'map-canvas';
	var panoEl =  'pano';
	var streetviewService = new google.maps.StreetViewService();
	var scenes = [];
	var pano, map, currentScene, sheading = false;

	var maximumDistance = 200;

    // dimensions of street view container (fixed)
    var panWidth = 1600;
    var panHeight = 780;

    // used when scaling markers in street view
    var baseDistance = 25;

	function getSceneIndexByPanoId(panoId) {
	    for(var i = 0; i < scenes.length; i++) {
	    	console.log(scenes[i].panoOptions.pano);
	        if(scenes[i].panoOptions.pano == panoId) {
	            return i;
	        }
	    }
	    return -1;
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

	function convertPointProjection(pov, pitch, zoom)
	{
	    // fov angles are magic numbers, when pan has a different dimension then different values will work better
	    var fovAngleHorizontal = 90 / zoom;
	    var fovAngleVertical = 60 / zoom;

	    var midX = panWidth / 2;
	    var midY = panHeight / 2;

	    var diffHeading = sheading - pov.heading;
	    diffHeading = normalizeAngle(diffHeading);
	    diffHeading /= fovAngleHorizontal;

	    var diffPitch = (pov.pitch - pitch) / fovAngleVertical;

	    var x = midX + diffHeading * panWidth;
	    var y = midY + diffPitch * panHeight;

	    var point = new google.maps.Point(x, y);

	    return point;
	}

	function updateOverlay(overlay)
	{
		var pov = pano.getPov();
		if (pov)
		{
			var zoom = pano.getZoom();

			// scale according to street view zoom level
			var adjustedZoom = Math.pow(2, zoom) / 2;

			// // recalulate icon heading and pitch now
			sheading  = google.maps.geometry.spherical.computeHeading(currentScene.mapOptions.center, overlay.location);
			overlay.distance = google.maps.geometry.spherical.computeDistanceBetween(currentScene.mapOptions.center, overlay.location);

			verticalAngle = (360 / Math.PI) * Math.tan(overlay.elevation / (overlay.distance + 0.1));
			overlay.markerPitch = verticalAngle;



			var pixelPoint = convertPointProjection(pov, overlay.markerPitch, adjustedZoom);

			console.log(pixelPoint);

			var distanceScale = baseDistance / overlay.distance;
			adjustedZoom = adjustedZoom * distanceScale;

			// // _TODO scale marker according to distance from view point to marker 
			// // beyond maximum range a marker will not be visible

			// // apply position and size to the marker div
			var wd = overlay.width * adjustedZoom;
			var ht = overlay.height * adjustedZoom;

			var x = pixelPoint.x - Math.floor(wd / 2);
			var y = pixelPoint.y - Math.floor(ht / 2);

			var markerEl = overlay.markerEl[0];
			console.log(markerEl);
			markerEl.style.display = "block";
			markerEl.style.left = x + "px";
			markerEl.style.top = y + "px";
			markerEl.style.width = wd + "px";
			markerEl.style.height = ht + "px";
			markerEl.style.zIndex = Math.floor(1000000 / (overlay.distance + 1));


			// hide marker when its beyond the maximum distance
			// var markerVisible = this.showMarkers;
			// if (place.distance > place.maximumDistance)
			// {
			//     markerVisible = false;
			// }

			// markerDiv.style.display = (markerVisible) ? "block" : "none";

		// diagnostics
		// glog(place.name + " : " + Math.floor(place.distance) + " m, zoom=" + zoom);
		}		
	}

	return {
		addScene: function(scene) {
			scenes.push(scene);
		},
		play: function(sceneIndex){

			currentScene = scenes[sceneIndex];
			
		    map = new google.maps.Map($("#"+mapEl)[0], currentScene.mapOptions);		
			pano = new google.maps.StreetViewPanorama($("#"+panoEl)[0], currentScene.panoOptions);
			map.setStreetView(pano);

            google.maps.event.addListener(pano, 'pano_changed', function() {            	
            	 currentScene = scenes[getSceneIndexByPanoId(pano.getPano())];
            	 // console.log(currentScene.panoOptions.pov);
            	 pano.setPov(currentScene.panoOptions.pov);
            });	
            google.maps.event.addListener(pano, 'links_changed', function() {
            	  pano.links = currentScene.links;
            });

		    // event handlers    
		    google.maps.event.addListener(pano, 'pov_changed', function ()
		    {
		        setTimeout("Stage.updateOverays();", 10);
		    });

		    google.maps.event.addListener(pano, 'zoom_changed', function ()
		    {
		        setTimeout("Stage.updateOverays();", 10);
		    });

		    google.maps.event.addListener(pano, 'position_changed', function ()
		    {
		        setTimeout("Stage.updateOverays();", 10);
		    });            

		},
		updateOverays: function(){
			overlays = currentScene.overlays;

			overlays.forEach(function(overlay){
				updateOverlay(overlay);
			});
		}
	};
})();


