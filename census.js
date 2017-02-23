OpenLayers.DOTS_PER_INCH = 25.4/0.28;
Ext.BLANK_IMAGE_URL  = '../ext-3.2.1/resources/images/default/s.gif';
//Ext.Ajax.timeout = 960000; //16 minutes
Ext.Ajax.timeout = 3600000; //1 hour

var GeoserverURL   = '/geoserver';
var GeoserverWMS   = GeoserverURL + '/wms?';
//var GeoserverWMS = '/geowebcache/service/wms?';
/*
	The above works, as GWC is configured to take arbitrary requests,
	but requires each layer to be configured in the GWC,
	and "Disable Layer Merging"
*/

//var GeowebcacheURL = GeoserverURL + '/gwc/service/wms?';
var GeowebcacheURL = '/geowebcache/service/wms?';
//var GeowebcacheURL  = GeoserverURL + '/wms?';   
var defaultPdfFilename = 'cm_census';

Proj4js.defs["EPSG:3734"]='+proj=lcc +lat_1=41.7 +lat_2=40.43333333333333 '+
    '+lat_0=39.66666666666666 +lon_0=-82.5 +x_0=600000 +y_0=0 '+
    '+ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs ';
var EPSG_3734 = new Proj4js.Proj('EPSG:3734');

//pull some vars declaration outside of Ext.onReady func, for debugging purposes
var map, mapPanel, printMapPanel, legendPanel;
var sketch;
var printProvider, printForm;

function formatLonlats(lonLat) {
    var lat = lonLat.lat;
    var long = lonLat.lon;
    var ns = OpenLayers.Util.getFormattedLonLat(lat);
    var ew = OpenLayers.Util.getFormattedLonLat(long,'lon');
    return ns + ', ' + ew + '   (' + (Math.round(lat * 100000) / 100000) + ', ' + (Math.round(long * 100000) / 100000) + ')';
}

Ext.onReady(function() {
    Ext.QuickTips.init();

    var host = document.location.protocol + '//' + document.location.host;
    var path = document.location.pathname.split('/');
    
    var iconWidth = iconHeight = 10;
    
    printProvider = new GeoExt.data.PrintProvider({
        //method: 'GET',
        method: 'POST',
        capabilities: printCapabilities,
        //url: '/geoserver202/pdf/',
        customParams: {
            serviceParams: { locale: 'en_US' },
            resourcesUrl: [host, path.slice(1,path.length-1).join('/')].join('/'),
            layersMerging: true,
            preferredIntervalFractions : [0.1,0.2,0.4]
        }
    });
    
    var k = OpenLayers.INCHES_PER_UNIT['ft'] * OpenLayers.DOTS_PER_INCH;
//    var scales = [600,1200,2400,4800,6000,9600,12000,15480,24000,31680,50000,63360,100000,250000,500000,1000000].reverse();
    var scales = [600,1200,2400,4800,6000,9600,12000,15480,24000,31680,50000,63360,250000,500000,1000000].reverse();
    var resolutions = [];  

    Ext.each(scales, function(it,i,all){
        resolutions[i] = it/k;
    });



    map = new OpenLayers.Map({
        allOverlays: false,
        scales: scales,
        maxExtent: new OpenLayers.Bounds(1320000.0,160000.0,2731023.622047244,1100682.4146981628),
//	maxExtent: new OpenLayers.Bounds(2112821,560287,2274487,706832),
//        maxExtent: new OpenLayers.Bounds(1320000.0,160000.0,2525000,976000),
        projection: new OpenLayers.Projection("EPSG:3734"),
        displayProjection: new OpenLayers.Projection("EPSG:4326"),
        units: 'ft',
	displayUnits: 'ft',
        controls: []
    });

    map.addControl(new OpenLayers.Control.MousePosition({formatOutput: formatLonlats}));
    map.addControl(new OpenLayers.Control.PanZoomBar());
    map.addControl(new OpenLayers.Control.ScaleLine());
    map.addControl(new OpenLayers.Control.Scale());
    map.addControl(new OpenLayers.Control.LayerSwitcher());
//    map.addControl(new OpenLayers.Control.Permalink());


////// WMS GetFeatureInfo
	var info = new OpenLayers.Control.WMSGetFeatureInfo({
	drillDown: false,
	queryVisible: true,
	panMapIfOutOfView: false,
	url: GeoserverWMS,
	layerUrls: [GeowebcacheURL],
	eventListeners: {
	    getfeatureinfo: function(event) {
		popup = new OpenLayers.Popup.FramedCloud(
		        "popinfo",
		        map.getLonLatFromPixel(event.xy),
		        null,
		        event.text,
		        null,
		        true
		    );

		    map.addPopup(popup, true);
	    }
	}
	});


	map.addControl(info);
	info.activate();

//  end of popup code  
        
    var layers = [];
    var baseLayers = [];
    var overviews = [];

// For background group layers.    
    /////////////////////////////////////////////////////
    var excludeLegend = ''; 

    var groupLayerBg = function(layers, groupName, excludeLegend){
        var lay = new OpenLayers.Layer.WMS(groupName,
            GeowebcacheURL, {
//            GeoserverWMS, {
                layers: layers.reverse(), 
                tiled: 'false',
                transparent: true,
                format: 'image/png'                 
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                displayInLayerSwitcher: true,
                isBaseLayer: true,
                visibility: true,
                printUrl: GeoserverWMS,
                singleTile:false,
		tileSize: new OpenLayers.Size(256,256),
		noDisplayLegend: excludeLegend
            }
        );
        return lay;
    };
    
    var groupLayerLeafBg = function(groupName){
        return {
            nodeType: 'gx_layer',
            layer: groupName,
            isLeaf: false,
            loader: {
                param: 'LAYERS'
            }
        };
    };
    
    layers.push(
//	groupLayerBg([
//	    'summer_aerial_1',
//	    'summer_aerial_2',
//	], 'Summer Aerial 2010', true),
	groupLayerBg([
			'cm_points',
			'basemap_cm_trails',
			'basemap_buildings',
			'basemap_bridgedecks',
			'basemap_parking',
			'basemap_impervious',
			'basemap_hydropolygon',
			'basemap_contours',
			'basemap_cm_boundaries',
			'basemap_background'
				], 'Map', true),
/*	groupLayerBg([
	    'reservation_bounds_solid',
	    'cuyahoga_street_centerlines',
	    'cuy_roads_poly'
	], 'Map', true)
        groupLayerBg([
	    'hinckley',
	    'willoughby_2007',
            'aerial_8',
            'aerial_7',
            'aerial_3',
            'aerial_4',
            'aerial_5',
            'aerial_6',
            'aerial_2',
            'aerial_1'
        ], 'Aerial (2007-8)', true),
        groupLayerBg([
	    'hinckley_grey',
	    'willoughby_2007_grey',
            'aerial_8_grey',
            'aerial_7_grey',
            'aerial_3_grey',
            'aerial_4_grey',
            'aerial_5_grey',
            'aerial_6_grey',
            'aerial_2_grey',
            'aerial_1_grey'
        ], 'Greyscale Aerial (2007-8)', true),
//	groupLayerBg([
//	    'ta_view'
//	], 'Terrestrial Assessment', false),
//	groupLayerBg([
//	    'hillshade'
//	], 'Hillshade', true),

	groupLayerBg([
	    'usgs_1950s-60s'
	], '1950s-60s USGS Quads', true)            */
    );

// For background non-grouped layers
 /*   
    baseLayers.push(
        new OpenLayers.Layer.WMS(
            'OSIP Aerial (2006-- no-print)', GeowebcacheURL,
            {
                srs: 'EPSG:3734',
                layers: 'aerial_7_county',
                format: 'image/png',
                tiled: false
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                isBaseLayer: true,
                visibility: true,
		//commented out to prevent printing-- is pointed to old windows geoserver.
                printUrl: GeoserverWMS,
                printLayerName: 'aerial_7_county',
		tileSize: new OpenLayers.Size(128,128),
		noDisplayLegend:  true
            } 
        ) 
    );
   
    layers.push(baseLayers[0]);    
       */





    var skipLegendLayers = ['Graticule (Geographic Grid)', 'hillshade', 'Facility Labels', 'nhd_subregion', 'Parcels (Black)', 'Parcels (Yellow)','Transportation Labels', 'CM Grid', 'Interstate Labels', 'Extra Shields', 'Basic Vector Layer', 'Golf', 'Mask', 'Trail Bridges', 'nhd_lake_erie', 'Transportation Roads and Labels'];

//	name of layer, display name, visibility
    var overviewsConfig = [
    //    ['signs', 'Sign Inventory', false],
  //      ['cm_trails', 'Trails', true],
//	['unsanctioned_trails_view', 'Unsanctioned Trails', false],
//	['cm_bridge_view', 'Trail Bridges', true],        
//	['wetlands_view', 'Wetlands', false],
//       ['contours_2', '5-County Contours', false],
//       ['cuy_contours_2', 'Cuyahoga Contours', false],
  //      ['contours_2_all', 'Contours', false],
//	['soil_names', 'Soil Names', false],
//	['soil_hydric', 'Hydric Soils', false],
//	['hydro_view', 'Hydro', false],
//	['geology_view', 'Geology', false],
//	['bed_depth', 'Bedrock Depth', false],
//	['detailed_hydro_view', 'Detailed Hydro', true],
//        ['grid_view', 'Grid', false],
//        ['ms_sensitive_081711', 'Sensitivity', false],
//	['cm_canopy_coarse', 'Forest Canopy', false],
	['reservation_bounds', 'Cleveland Metroparks', false],
	['county_parcels','County Parcels (Black)',false],
	['county_parcels_yellow','County Parcels (Yellow)',false],
	['census_half_mile_buffer', 'Half Mile Buffer', false],
	['census_one_mile_buffer', 'One Mile Buffer', false],
	['census_two_mile_buffer', 'Two Mile Buffer', false],
//	['census_half_mile_mask', 'Half Mile Mask', false],
//	['cuva_bounds', 'CVNP', false],
	['census_view', 'Census Block Groups', false],
	['census_per_black', 'Percent African American', false],
	['census_under_18', 'Percent Under 18', false],
	['census_over_65', 'Percent Over 65', false],
	['census_median_age', 'Median Age', false],
	['census_unemployment', 'Unemployment', false],
	['census_pop_density', 'Pop Density', false],
	['census_per_bach', 'Education', false],
	['census_income', 'Income', false],
	['census_per_renter', 'Renting', false],
	['census_per_novehicle', 'Without Vehicle', false],
	['census_hh_size', 'Household Size', false]

//	['ta_view', 'Terestrial Assessment', false]
].reverse();

    Ext.each(overviewsConfig, function(ly,i,lys){
        overviews.push(
            new OpenLayers.Layer.WMS(
                ly[1], GeowebcacheURL,
//                ly[1], GeoserverWMS,  
                {
                    srs: 'EPSG:3734',
                    layers: ly[0],
                    transparent: true,
                    format: 'image/png',
                    tiled: false
                }, {
                    buffer: 0,
                    displayOutsideMaxExtent: true,
                    isBaseLayer: false,
	            printUrl: GeoserverWMS,
                    visibility: ly[2],
                    singleTile: false//,
                }
            )
        );        
        
        layers.push(overviews[i]);
        
    });    
    

    var groupLayerNoSwitcher = function(layers, groupName){
        var lay = new OpenLayers.Layer.WMS(groupName,
//            GeowebcacheURL, {
            GeoserverWMS, {
                layers: layers.reverse(), 
                tiled: 'false',
                transparent: true,
                format: 'image/png'                 
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                displayInLayerSwitcher: true,
                isBaseLayer: false,
                visibility: true,
                printUrl: GeoserverWMS,
                singleTile: true//,
//		tileSize: new OpenLayers.Size(1024,1024)
            }
        );
        return lay;
    };
    
    var groupLayerLeafNoSwitcher = function(groupName){
        return {
            nodeType: 'gx_layer',
            layer: groupName,
            isLeaf: false,
            loader: {
                param: 'LAYERS'
            }
        };
    };


    layers.push(
        groupLayerNoSwitcher([
            'cities_and_townships'
         ], 'City and Township Boundaries')
    );


    LEGEND.loadStyles(overviewsConfig);


//var chloroLayers = new Array('census_income', 'census_median_age');

//var store = new GeoExt.data.LayerStore({
//    map: map,
//    layers: chloroLayers
//});

/*

    var groupLayerNoSwitcher1 = function(layers, groupName){
        var lay = new OpenLayers.Layer.WMS(groupName,
            GeowebcacheURL, {
                layers: layers.reverse(), 
                tiled: 'false',
                transparent: true,
                format: 'image/png'                 
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                displayInLayerSwitcher: false,
                isBaseLayer: false,
                visibility: false,
                printUrl: GeoserverWMS,
                singleTile:false,
		tileSize: new OpenLayers.Size(256,256),
		noDisplayLegend:false
            }
        );
        return lay;
    };
    
    var groupLayerLeafNoSwitcher1 = function(groupName){
        return {
            nodeType: 'gx_layer',
            layer: groupName,
            isLeaf: false,
            loader: {
                param: 'LAYERS'
            }
        };
    };

    layers.push(
        groupLayerNoSwitcher1([
	    'odot_cities_cuyahoga'
         ], 'Municipal Boundaries')
    );

    layers.push(
        groupLayerNoSwitcher1([
	'census_per_renter'
         ], 'Chloropleth')
    );

   
/*	var chloropleth = new OpenLayers.Layer.WMS('Chloropleth',
                GeoserverWMS, {
                    layers: [
                        'census_per_bach',                    ],
                    transparent: true,
                    format: 'image/png'
                }, {
                    isBaseLayer: false,
                    buffer: 0,
                    // exclude this layer from layer container nodes
                    displayInLayerSwitcher: false
//                    visibility: false
                }
            );
*/

/*
    /////////////////////////////////////////////////////
    var groupLayer1 = function(layers, groupName){
        var lay = new OpenLayers.Layer.WMS(groupName,
            GeowebcacheURL, {
                layers: layers.reverse(), 
                tiled: 'false',
                transparent: true,
                format: 'image/png'                 
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                displayInLayerSwitcher: true,
                isBaseLayer: false,
                visibility: true,
                printUrl: GeoserverWMS,
                singleTile:false,
		tileSize: new OpenLayers.Size(256,256)
            }
        );
        return lay;
    };
    
    var groupLayer1Leaf = function(groupName){
        return {
            nodeType: 'gx_layer',
            layer: groupName,
            isLeaf: false,
            loader: {
                param: 'LAYERS'
            }
        };
    };
    
    layers.push(
        groupLayer1([
            'reservation_boundaries_public_private_cm_dissolved_mask_gradien'
        ], 'Mask')
    );
*/
// for non-background group layers
    
    /////////////////////////////////////////////////////
    var groupLayer = function(layers, groupName){
        var lay = new OpenLayers.Layer.WMS(groupName,
            GeowebcacheURL, {
                layers: layers.reverse(), 
                tiled: 'false',
                transparent: true,
                format: 'image/png'                 
            },
            {
                buffer: 0,
                displayOutsideMaxExtent: true,
                displayInLayerSwitcher: true,
                isBaseLayer: false,
                visibility: false,
                printUrl: GeoserverWMS,
                singleTile:false,
		tileSize: new OpenLayers.Size(1024,1024)
            }
        );
        return lay;
    };
    
    var groupLayerLeaf = function(groupName){
        return {
            nodeType: 'gx_layer',
            layer: groupName,
            isLeaf: false,
            loader: {
                param: 'LAYERS'
            }
        };
    };
/*    
    layers.push(
        groupLayer([
            'parcel_annotations_lor',
	    'parcel_annotations_sum',
            'parcel_annotations_med',
            'parcel_annotations_lak',
            'parcel_annotations_cuy',   
            'parcel_annotations_lor_label',
	    'parcel_annotations_sum_label',
            'parcel_annotations_med_label',
            'parcel_annotations_lak_label',
            'parcel_annotations_cuy_label'
//            'parcel_annotations_cuy_owner' 
//            'parcel_annotations_cuy_view'      	
        ], 'Parcels (Yellow)'),
        groupLayer([
            'parcel_annotations_lor_black',
	    'parcel_annotations_sum_black',
            'parcel_annotations_med_black',
            'parcel_annotations_lak_black',
            'parcel_annotations_cuy_black',   
            'parcel_annotations_lor_label',
	    'parcel_annotations_sum_label',
            'parcel_annotations_med_label',
            'parcel_annotations_lak_label',
            'parcel_annotations_cuy_label'      	
        ], 'Parcels (Black)')
    );
*/



    var ctrlBtns = [];

    ctrlBtns.push(' ');
    ctrlBtns.push(new GeoExt.Action({
        control: new OpenLayers.Control.ZoomToMaxExtent(),
        map: map,
        text: 'Zoom',
        tooltip: 'Zoom to max map extent'
    }),'|',
/* {
        text: 'Fit print extent',
        tooltip: 'Fit print extent into current screen',
        handler: function(){
            printForm.printPage.fit(mapPanel.map, {mode: "screen"});
        }
    }, '|', */ {
        text: 'Fit map',
        tooltip: 'Fit map into print extent',
        handler: function(){
            map.zoomToExtent(
                extentLayer.features[0].geometry.getBounds()
            );
        }
    },'|', 
    {
        text: 'Graticule',
        enableToggle: true,
        pressed: false,
        tooltip: 'show/hide graticule',
        handler: function(button, evt){
            var gratLayer = graticule.gratLayer;
            
            if(button.pressed){
                gratLayer.setVisibility(true);
            } else {
                gratLayer.setVisibility(false);
            }
        }
    },'->', {
        text: 'Print (on/off)',
        enableToggle: true,
        pressed: false,
        tooltip: 'show/hide print extents',
        handler: function(button, evt){
            if(button.pressed){
                printForm.showExtent();
                Ext.getCmp('print-btn').enable();
		printForm.printPage.fit(mapPanel.map, {mode: "screen"})
            } else {
                printForm.hideExtent();
                map.removeLayer(extentLayer);
                Ext.getCmp('print-btn').disable();
            }
        }
    }, '|' ,{
        id: 'print-btn',        
        cls: 'x-btn-text-icon',
        icon: 'printer.png',      
        text: 'Print',
        tooltip: 'Print PDF',
        enableToggle: false,
        handler: function(button, evt){
            map.zoomToExtent(
                extentLayer.features[0].geometry.getBounds()
            );
            printForm.printExtent.print(printForm.printOptions);
        }
    }
);    

    ctrlBtns.push('-');
    ctrlBtns.push(new GeoExt.Action({
        text: 'Navigate',
        control: new OpenLayers.Control.Navigation({
            mouseWheelOptions: {interval:150, cumulative: true}
        }),
        map: map,
        allowDepress: true,
        pressed: true,
        tooltip: 'navigation',
        toggleGroup: 'nav'
    }));
    
    ctrlBtns.push('-');
    ctrlBtns.push({xtype: 'tbtext', text: 'Measure:'});
    
    ctrlBtns.push(
        new GeoExt.ux.MeasureLength({
            map: map,
            controlOptions: {
                geodesic: true,
                displaySystem: 'english'
            },
            toggleGroup: 'nav'
        })
    );
    
    ctrlBtns.push(
        new GeoExt.ux.MeasureArea({
            map: map,
            decimals: 0,
            controlOptions: {
                geodesic: true,
                displaySystem: 'english'
            },            
            toggleGroup: 'nav'
        })
     );


//	skipLayerSwitcher[i].setDisplayInLayerSwitcher(false)

    mapPanel = new GeoExt.MapPanel({
        border: true,
        region: 'center',
        map: map,
        layers: layers,
        tbar: ctrlBtns
    });
        
    var extentLayer = new OpenLayers.Layer.Vector('print', {
        displayInLayerSwitcher: false,
        styleMap: new OpenLayers.StyleMap(new OpenLayers.Style(Ext.applyIf({
            pointRadius: 4,
            graphicName: 'circle',
            rotation: '${getRotation}',
            strokeColor: '${getStrokeColor}',
            fillOpacity: '${getFillOpacity}'
        }, OpenLayers.Feature.Vector.style['default']), {
            context: {
                getRotation: function(feature) {
                    return printForm.printPage.rotation;
                },
                getStrokeColor: function(feature) {
                    return feature.geometry.CLASS_NAME == 'OpenLayers.Geometry.Point' ?
                        '#000' : '#aaaaaa';
                },
                getFillOpacity: function(feature) {
                    return feature.geometry.CLASS_NAME == 'OpenLayers.Geometry.Point' ?
                        0 : 0.25;
                }
            }
        })
    )});
           
    legendPanel = new GeoExt.LegendPanel({
        map: map,
        width: 200,
        region: 'east',
        title: 'Legend',
        collapsible: true,
        defaults: {
            style: 'padding:5px',
            imageFormat: 'image/png',            
            baseParams: {
                LEGEND_OPTIONS: 'forceLabels:on;fontSize:12',
                WIDTH: 14, HEIGHT: 14
            }
        },
        filter: function(record) {
            return !record.get('layer').noDisplayLegend &&
                skipLegendLayers.indexOf(record.get('layer').name) == -1;
        }
    });
  
    printForm = new GeoExt.ux.SimplePrint({
        mapPanel: mapPanel,
        layer: extentLayer, // optional
        autoFit: false,
        printProvider: printProvider,
        //printOptions: {legend: legendPanel},      
        labelAlign: 'top',
        labelWidth: 65,
        defaults: {width: 190},
        bodyStyle: {padding: '20px 0px 10px 10px'},
        border: false,
        width: 210 
    });
    
     /** api: events[beforeprint]
     *  Triggered when the print method is called.
     *  
     *  Listener arguments:
     *  * printProvider - :class:`GeoExt.data.PrintProvider` this
     *    PrintProvider
     *  * map - ``OpenLayers.Map`` the map being printed
     *  * pages - Array of :class:`GeoExt.data.PrintPage` the print
     *    pages being printed
     *  * options - ``Object`` the options to the print command
     */
     /** api: event[encodelayer]
     *  Triggered when a layer is encoded. This can be used to modify
     *  the encoded low-level layer object that will be sent to the
     *  print service.
     *  
     *  Listener arguments:
     *
     *  * printProvider - :class:`GeoExt.data.PrintProvider` this
     *    PrintProvider
     *  * layer - ``OpenLayers.Layer`` the layer which is about to be 
     *    encoded.
     *  * encodedLayer - ``Object`` the encoded layer that will be
     *    sent to the print service.
     */
     printProvider.on({
        'encodelayer' : function(provider, layer, encodedLayer){
            if(layer.printUrl){
                encodedLayer.baseURL = provider.getAbsoluteUrl(layer.printUrl);
                if(layer.printLayerName){
                    encodedLayer.layers = [layer.printLayerName].join(",").split(",");
                }
            }
            return encodedLayer;
        },
        'beforeprint' : function(provider, map, pages, options){
            var scale = map.getScale();
            var legends = [];
            
            for(var i = 0; i<overviewsConfig.length; i++){
                var layer = overviewsConfig[i];
                var layerName = layer[1];
                
                if(skipLegendLayers.indexOf(layerName) === -1){
                    var mapLayer = map.getLayersByName(layerName)[0];
                    
                    if(mapLayer && mapLayer.visibility){                    
                        var layerRules = LEGEND.sldGetRules(layer[3]);                        
                        var scaleRules = LEGEND.filterRulesForScale(layerRules, scale);
                        
                        var layerLegend = { name : layerName };
                        var layerClasses = [];                       
                        
                        if(scaleRules.length === 1 && scaleRules[0].name === 'default'){                            
                            layerClasses.push({
                                name : '',
                                icons : [
                                    LEGEND.sldGetRuleLegendGraphic(
                                            host+GeoserverWMS, 
                                            layer[0], 
                                            null, 
                                            iconWidth, iconHeight)]
                            });
                        } else {                            
                            for(var j=0;j<scaleRules.length; j++){
                                layerClasses.push({
                                    name : scaleRules[j].title || scaleRules[j].name || '',
                                    icons : [
                                        LEGEND.sldGetRuleLegendGraphic(
                                            host+GeoserverWMS, 
                                            layer[0], 
                                            scaleRules[j].name, 
                                            iconWidth, iconHeight)]
                                });
                            }
                        }
                       
                        if(layerClasses.length > 0){
                            layerLegend['classes'] = layerClasses;
                            legends.push(layerLegend);
                        }
                    }
                }
            }
            
            provider.customParams.legends = legends;
            
            var fName = printForm2.getForm().findField('outputFilename');
            if(!fName.getValue()){
                fName.setValue(defaultPdfFilename);
            }
        },
        scope: printProvider
    });
     
     
    printProvider.on({
        'printexception' : function(provider, resp){
            this.hide();
            //include 5 first lines
            var infoText = resp.responseText.split('\r\n');
            if(infoText.length > 5){
                infoText = infoText.slice(0,5).join('<br />');
            }
            
            Ext.MessageBox.alert('Print failure',
                '<b>'+resp.statusText +'</b>'+'<br /><br />'+infoText);
        },
        scope: printForm.busyMask
    });
    
    
    // add custom fields to the form
    printForm.insert(0, {
        xtype: 'textfield',
        name: 'mapTitle',
        fieldLabel: 'Title',
        value: 'CUSTOM TITLE',
        plugins: new GeoExt.plugins.PrintPageField({
            printPage: printForm.printPage
        })
    });
/*
    printForm.insert(5, {
        xtype: 'textfield',
        fieldLabel: 'hillshade',
        name: 'hillshade',
        value: 'false',
        plugins: new GeoExt.plugins.PrintPageField({
            printPage: printForm.printPage
        })
    });
*/     
    var printPanel = new Ext.Panel({
        title: 'Printing',
        layout: 'fit',
        defaults:{autoScroll: true}
    });

    printPanel.add(printForm);
    printPanel.doLayout();
    
    var printForm2 = new Ext.form.FormPanel({
        id: 'form2',
        title : 'Print options & metadata',
        labelAlign: 'top',
        labelWidth: 65,
        defaults: {width: 190},
        bodyStyle: {padding: '20px 0px 10px 10px'},
        border: false,
        width: 210,
        autoScroll: true, 
        defaultType: 'textfield',
        items: [{
            fieldLabel: 'Title',
            name: 'metaTitle',
            value: 'Cleveland Metroparks GIS Print',
            plugins: new GeoExt.plugins.PrintProviderField({
                printProvider: printProvider
            })
        },{
            fieldLabel: 'Author',
            name: 'metaAuthor',
            value: 'Cleveland Metroparks',
            plugins: new GeoExt.plugins.PrintProviderField({
                printProvider: printProvider
            })
        }, {
            fieldLabel: 'Subject',
            name: 'metaSubject',
            value: 'Cleveland Metroparks GIS Print',
            plugins: new GeoExt.plugins.PrintProviderField({
                printProvider: printProvider
            })
        },{
            fieldLabel: 'Keywords',
            name: 'metaKeywords',
            value: '',
            plugins: new GeoExt.plugins.PrintProviderField({
                printProvider: printProvider
            })
        },{
            fieldLabel: 'PDF Output filename',
            name: 'outputFilename',
            id : 'outputFilename',
            value: defaultPdfFilename,
            plugins: new GeoExt.plugins.PrintProviderField({
                printProvider: printProvider
            })
        }
        ,{
            fieldLabel: 'Disable Layer Merging',
            xtype: 'checkbox', 
            name: 'layersMerging',
            checked: false,
            handler: function(cbox, checked){
                printProvider.customParams.layersMerging=!checked;
            }
        }
        ]
    });
  

//        var wms = new OpenLayers.Layer.WMS( 'Testing',
//            GeoserverWMS, {layers: 'census_median_age'} );
//        map.addLayer(wms);
  
    
    var treeConfig = new OpenLayers.Format.JSON().write([
        {
            nodeType: 'gx_baselayercontainer',
            expanded: true
        },
        {
            nodeType: 'gx_overlaylayercontainer',
            expanded: true
        }
/*	{
            nodeType: 'gx_layer',
            layer:  'Chloropleth',
//            layerStore: store,
            isLeaf: false,
            // create subnodes for the layers in the LAYERS param. If we assign
            // a loader to a LayerNode and do not provide a loader class, a
            // LayerParamLoader will be assumed.
            loader: {
            param: 'LAYERS'
	    }          
	}  */
    ], true);
    
    var layerTree = new Ext.tree.TreePanel({
        bodyStyle: {padding: '10px 0px 00px 0px'},    
        title: 'GIS Layers',
        autoScroll: true,
        loader: new Ext.tree.TreeLoader({
            // applyLoader has to be set to false to not interfer with loaders
            // of nodes further down the tree hierarchy
            applyLoader: false
        }),        
        root: {
            nodeType: 'async',
            // the children property of an Ext.tree.AsyncTreeNode is used to
            // provide an initial set of layer nodes. We use the treeConfig
           // from above, that we created with OpenLayers.Format.JON.write.
            children: Ext.decode(treeConfig)
        },
        
        rootVisible: false,
        lines: true
    });

    /*
    var groupConfig = new OpenLayers.Format.JSON().write([
        groupLayerLeaf('Water bodies'),
        groupLayerLeaf('Transportation'),
        groupLayerLeaf('Countour lines'),
        groupLayerLeaf('Green Areas')  
    ], true);

    var groupTree = new Ext.tree.TreePanel({        
        title: 'Layers GetCap',
        autoScroll: true,
        loader: new Ext.tree.TreeLoader({
            // applyLoader has to be set to false to not interfer with loaders
            // of nodes further down the tree hierarchy
            applyLoader: false
        }),        
        root: {
            nodeType: 'async',
            // the children property of an Ext.tree.AsyncTreeNode i used to
            // provide an initial set of layer nodes. We use the treeConfig
            // from above, that we created with OpenLayers.Format.JSON.write.
            children: Ext.decode(groupConfig)
        },
        
        rootVisible: false,
        lines: false
    });
    */

    var panels = new Ext.Panel({
        width: 250,
        split: false,
        collapsible: true,
        autoScroll: true,    
        region: 'west',
        border: true,
        layout:'accordion',
        items: [layerTree, printPanel, printForm2]
    });

    var zoohortLink = [ '              .                 ',
		        '<a href="http://cmac-srv-gis/gis/pdnr_gis.html" target="_blank">Old GIS</a>',

//			'              .                 ',
//			'<a href="http://192.168.100.153/geoserver/www/printing" target="_blank">New GIS</a>',
			'              |                 ',
			'<a href="http://192.168.100.153/geoserver/www/zoohort" target="_blank">Zoo Horticulture</a>',
			' | ', 'Most data used is from public sources.  Remaining map data (c) <a href="www.openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA.'
		] ;
 

    var topPanel = new Ext.Panel({
	title: 'CENSUS',        
	width: 500,
	height: 45,
        split: false,
        collapsible: true,
        autoScroll: true,    
        region: 'north',
        border: true,
        layout:'fit',
        items: [],
	html:  zoohortLink
    });
    
    var bottomPanel = new Ext.Panel({
	title: 'Query',        
	width: 500,
	height: 100,
        split: false,
        collapsible: true,
        autoScroll: true,    
        region: 'south',
        border: true,
        layout:'fit',
        items: [],
	html:  zoohortLink
    });

    new Ext.Viewport({
        layout: 'fit',
        hideBorders: true,
        items: {
            layout: 'border',
            deferredRender: false,
            items: [topPanel, mapPanel, panels, legendPanel, bottomPanel]
        }
    });

/*
    //add graticule layer last in order to print it on top
    var graticule = new OpenLayers.Control.Graticule({
       numPoints: 2,
       labelled: true,
       visible: false,
       targetSize: 500,
       labelFormat: 'dms',
       layerName: "Graticule (Geographic Grid)",
       lineSymbolizer: {
           'strokeWidth': 1.5,
           'strokeColor': '#000000',
           'strokeDashstyle': 'dashdot',
           'strokeOpacity': 0.7
       },
       labelSymbolizer: {
           'strokeColor': '#ffffff',
           'fontColor': '#000000',
           'fontWeight': 'bold'
       }
    });
    map.addControl(graticule);
  */

    var panel = new OpenLayers.Control.NavToolbar();
    map.addControl(panel);
	
    hist = new OpenLayers.Control.NavigationHistory();
    map.addControl(hist);

    panel.addControls([hist.next, hist.previous]);
    map.addControl(panel);

    printForm.printPage.fit(mapPanel.map, {mode: "screen"})
    printForm.hideExtent();
    map.removeLayer(extentLayer);
    Ext.getCmp('print-btn').disable();

    /*
    var myMask = new Ext.LoadMask(printPanel.body, {msg:'Loading form...'});
    myMask.show();
    printProvider.on('loadcapabilities', function() {
        myMask.hide();
        printPanel.add(printForm);
        printPanel.doLayout();
    });
    */

    // if statement allows for the use of permalinks
//    if(!map.getCenter()){
	    map.zoomToExtent(
		new OpenLayers.Bounds(2112700,583900,2280000,719000)
//		new OpenLayers.Bounds(2112821,560287,2274487,706832)
	    );
//    }

	// avoid pink tiles
	OpenLayers.IMAGE_RELOAD_ATTEMPTS = 3;
	OpenLayers.Util.onImageLoadErrorColor = "transparent"; 

	map.events.register("click", map, queryDatabase );
   
}); 

function queryDatabase(e) {

	  // Read the map coordinates from the click event
	  var lonlat = map.getLonLatFromViewPortPx(e.xy);

	  // Read the table we are going to query from the page
	  var table = document.getElementById("table").value;

	  // Construct the query URL
	  var url = "/geoserver/www/query/01-click-query.jsp";
	  url += "?lon=" + lonlat.lon;
	  url += "&lat=" + lonlat.lat;
	  url += "&table=" + table;

	  // Load the URL into an iframe
	  document.getElementById("query").src = url;
}
