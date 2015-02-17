
var Stage = (function(){
	var mapEl = 'map-canvas';
	var panoEl =  'pano';
	var streetviewService = new google.maps.StreetViewService();
	var scenes = [];
	var pano, map, currentScene = false;

	function getSceneIndexByPanoId(panoId) {
	    for(var i = 0; i < scenes.length; i++) {
	    	console.log(scenes[i].panoOptions.pano);
	        if(scenes[i].panoOptions.pano == panoId) {
	            return i;
	        }
	    }
	    return -1;
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

		}
	};
})();


