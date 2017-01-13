OpenLayers.DOTS_PER_INCH = 25.4 / 0.28;
Ext.BLANK_IMAGE_URL = '../ext-3.2.1/resources/images/default/s.gif';
Ext.Ajax.timeout = 3600000; //1 hour

var GeoserverURL = '/geoserver';
var GeoserverWMS = GeoserverURL + '/wms?';

var GeowebcacheURL = '/geowebcache/service/wms?';
var defaultPdfFilename = 'cm_gis';

Proj4js.defs["EPSG:3734"] = '+proj=lcc +lat_1=41.7 +lat_2=40.43333333333333 ' +
	'+lat_0=39.66666666666666 +lon_0=-82.5 +x_0=600000 +y_0=0 ' +
	'+ellps=GRS80 +datum=NAD83 +to_meter=0.3048006096012192 +no_defs ';
var EPSG_3734 = new Proj4js.Proj('EPSG:3734');

//pull some vars declaration outside of Ext.onReady func, for debugging purposes
var map, mapPanel, printMapPanel, legendPanel;
var sketch;
var printProvider, printForm;

function formatLonlats(lonLat) {
	var lat = lonLat.lat;
	var long1 = lonLat.lon;
	var ns = OpenLayers.Util.getFormattedLonLat(lat);
	var ew = OpenLayers.Util.getFormattedLonLat(long1, 'lon');
	return ns + ', ' + ew + '   (' + (Math.round(lat * 100000) / 100000) + ', ' + (Math.round(long1 * 100000) / 100000) + ')';
}

Ext.onReady(function () {
	Ext.QuickTips.init();
	
	var host = document.location.protocol + '//' + document.location.host;
	var path = document.location.pathname.split('/');
	
	var iconWidth = iconHeight = 30;
	
	printProvider = new GeoExt.data.PrintProvider({
			//method: 'GET',
			method : 'POST',
			capabilities : printCapabilities,
			//url: '/geoserver202/pdf/',
			customParams : {
				app : 'config_test'
			},
//			app : 'config_test',
			customParams : {
				serviceParams : {
					locale : 'en_US'
				},
//				app : 'config_test',
				resourcesUrl : [host, path.slice(1, path.length - 1).join('/')].join('/'),
				layersMerging : true,
				preferredIntervalFractions : [0.1, 0.2, 0.4]
			}
		});
	
	var k = OpenLayers.INCHES_PER_UNIT['ft'] * OpenLayers.DOTS_PER_INCH;
	var scales = [600, 1200, 2400, 4800, 6000, 9600, 12000, 15480, 24000, 31680, 50000, 63360, 250000, 500000, 1000000].reverse();
	var resolutions = [];
	
	Ext.each(scales, function (it, i, all) {
		resolutions[i] = it / k;
	});
	
	map = new OpenLayers.Map({
			allOverlays : false,
			scales : scales,
			maxExtent : new OpenLayers.Bounds(1320000.0, 160000.0, 2731023.622047244, 1100682.4146981628),
			projection : new OpenLayers.Projection("EPSG:3734"),
			displayProjection : new OpenLayers.Projection("EPSG:4326"),
			units : 'ft',
                       	displayUnits : 'ft',
			controls : []
		});
	
	map.addControl(new OpenLayers.Control.MousePosition({
			formatOutput : formatLonlats
		}));
	map.addControl(new OpenLayers.Control.PanZoomBar());
	map.addControl(new OpenLayers.Control.ScaleLine());
	map.addControl(new OpenLayers.Control.Scale());
	map.addControl(new OpenLayers.Control.LayerSwitcher());
		
	var layers = [];
	var baseLayers = [];
	var overviews = [];

	
	// For background group layers.
	
	var excludeLegend = '';
	
	var groupLayerBg = function (layers, groupName, excludeLegend) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : 'true',
				format : 'image/jpeg'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : true,
				visibility : true,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(256, 256),
				noDisplayLegend : excludeLegend
			});
		return lay;
	};
	
	var groupLayerLeafBg = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	layers.push(
		groupLayerBg([
				'hinckley',
				'willoughby_2007',
				'aerial_2011'
			], 'Aerial (2007-13)', true),
                groupLayerBg([ 
				'zoo',
				'2016-06-14-EdgewaterRoundabout_subset',
				'seneca',
                                'hinckley',
                                'willoughby_2007',
                                'aerial_2015'
                        ], 'Aerial (2007-16) experimental', true),
		groupLayerBg([
				'summer_aerial_1',
				'summer_aerial_2'
			], 'Summer Aerial 2010', true),
		
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
		groupLayerBg([
				'aerial_2011_cir'
			], 'Color Infrared 2011 (Cuyahoga)', true),
		groupLayerBg([
				'usgs_1950s-60s'
			], '1950s-60s USGS Quads', true))
		;


	// for non-background group layers
	
	/////////////////////////////////////////////////////
	var groupLayer = function (layers, groupName) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : false,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(256, 256)
			});
		return lay;
	};
	
	var groupLayerLeaf = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	var groupLayerNoSwitcher = function (layers, groupName, gLNSvis) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeoserverWMS, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
                                }, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : gLNSvis,
				printUrl : GeoserverWMS,
				singleTile : true
			});
		return lay;
	};
	
	var groupLayerLeafNoSwitcher = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	layers.push(
/*		groupLayerNoSwitcher([
				'reservation_boundaries_public_private_cm_dissolved_mask_gradien'
			], 'Mask', true),*/
			groupLayerNoSwitcher([
				'odot_state_routes',
				'odot_us_routes',
				'odot_interstate'
			], 'Primary Roads', true));


	
	var skipLegendLayers = ['Graticule (Geographic Grid)', 'hillshade', 'Facility Labels', 'nhd_subregion', 'Parcels (Black)', 'Parcels (Yellow)', 'Transportation Labels', 'CM Grid', 'Interstate Labels', 'Extra Shields', 'Basic Vector Layer', 'Golf', 'Mask', 'Trail Bridges', 'nhd_lake_erie', 'Transportation Roads and Labels', 'Physical Infrastructure', 'Golf', 'Lake Erie', 'Address Points', 'Hinckley Lake boat docks', 'Primary Roads'];
	
	//	name of layer, display name, visibility
	var overviewsConfig = [
		['ada_chapter3', 'ADA Chapter 3: Building Blocks', false],
		['ada_chapter4', 'ADA Chapter 4: Accessible Routes', false],
		['ada_chapter5', 'ADA Chapter 5: General Site & Building Elements', false],
		['ada_chapter6', 'ADA Chapter 6: Plumbing Elements & Facilities', false],
		['ada_chapter7', 'ADA Chapter 7: Communication Elements & Features', false],
		['ada_chapter8', 'ADA Chapter 8: Special Rooms, Spaces & Elements', false],
		['ada_chapter9', 'ADA Chapter 9: Built-in Elements', false],
		['ada_chapter10_rec', 'ADA Chapter 10: Recreation Facilities', false],
		['ada_chapter10_outdoor', 'ADA Chapter 10: Outdoor Constructed Features', false],
		['pdadareports', 'PD ADA Reports', true],
//		['greenspace_trails', 'Greenspace Trails (2010)', false],
//              ['trails_leadership_network', 'Trails Leadership Network (2015)', false],
//		['cm_bridges', 'Trail Bridges', false],
//              ['confined_spaces', 'Confined Spaces Inventory', false],
//              ['hi_docks', 'Hinckley Lake boat docks', false],
		['cm_trails', 'Trails', false],
//		['unsanctioned_trails_view', 'Unsanctioned Trails', false],
//              ['cm_wetlands', 'CM Wetlands Inventory (2015)', false],
//		['cm_wetlands_2005_06', 'CM Wetlands Inventory (2005/2006)', false],
//		['wetlands_nwi', 'NWI Wetlands', false],
		['contours_2_all', 'Contours', false],
//              ['contours_2_all_yellow', 'Contours (Yellow)', false],
//		['soil_names', 'Soil Names', false],
//		['soil_hydric', 'Hydric Soils', false],
		['detailed_hydro_view', 'Detailed Hydro', false],
//		['cm_canopy_coarse', 'Forest Canopy', false],
//		['address_view', 'Address Points', false],
		['reservation_bounds', 'Cleveland Metroparks (All)', true],
//		['reservation_bounds_no_restriction', 'Cleveland Metroparks (Public Only)', false],
//		['cuva_bounds', 'Cuyahoga Valley NP', false],
//		['ta_view', 'Terrestrial Assessment - L1', false]
	].reverse();
	
	Ext.each(overviewsConfig, function (ly, i, lys) {
		overviews.push(
			new OpenLayers.Layer.WMS(
				ly[1], GeowebcacheURL, {
				srs : 'EPSG:3734',
				layers : ly[0],
				transparent : true,
				format : 'image/png',
				tiled : false
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				isBaseLayer : false,
				printUrl : GeoserverWMS,
				visibility : ly[2],
				singleTile : false //,
			}));
		layers.push(overviews[i]);
	});
	
	LEGEND.loadStyles(overviewsConfig);
	
	var groupLayerNoSwitcher1 = function (layers, groupName) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : false,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(256, 256)
			});
		return lay;
	};
	
	var groupLayerLeafNoSwitcher1 = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	layers.push(
		groupLayerNoSwitcher1([
				'cm_buildings_outline',
				'cm_buildings',
				'impervious_update'
			], 'Physical Infrastructure', false),
		groupLayerNoSwitcher1([
				'golf_view'
			], 'Golf', false),
		groupLayerNoSwitcher1([
				'nhd_lake_erie'
			], 'Lake Erie', false));
	
	/////////////////////////////////////////////////////
	var groupLayer1 = function (layers, groupName) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : true,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(256, 256)
			});
		return lay;
	};
	
	var groupLayer1Leaf = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	// for non-background group layers
	
	/////////////////////////////////////////////////////
	var groupLayer = function (layers, groupName) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : false,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(256, 256)
			});
		return lay;
	};
	
	var groupLayerLeaf = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	var groupLayerNoSwitcher = function (layers, groupName, gLNSvis) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeoserverWMS, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : gLNSvis,
				printUrl : GeoserverWMS,
				singleTile : true
			});
		return lay;
	};
	
	var groupLayerLeafNoSwitcher = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	layers.push(
		groupLayerNoSwitcher([
				'cm_use_area_labels',
				'cm_use_area_mask',
				'facility_areas_cm',
				'facilities_cm',
				'detailed_hydro_labels',
				'planet_osm_line_outside_cuy',
				'cuyahoga_street_centerlines_labels',
				'planet_osm_line',
				'supplementary_shields'
			], 'Transportation Roads and Labels', true),
		groupLayerNoSwitcher([
				'cities_and_townships'
			], 'City and Township Boundaries', false));
	
	// for non-background group layers
	
	/////////////////////////////////////////////////////
	var groupLayer = function (layers, groupName) {
		var lay = new OpenLayers.Layer.WMS(groupName,
				GeowebcacheURL, {
				layers : layers.reverse(),
				tiled : 'false',
				transparent : true,
				format : 'image/png'
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				displayInLayerSwitcher : true,
				isBaseLayer : false,
				visibility : false,
				printUrl : GeoserverWMS,
				singleTile : false,
				tileSize : new OpenLayers.Size(1024, 1024)
			});
		return lay;
	};
	
	var groupLayerLeaf = function (groupName) {
		return {
			nodeType : 'gx_layer',
			layer : groupName,
			isLeaf : false,
			loader : {
				param : 'LAYERS'
			}
		};
	};
	
	layers.push(
		groupLayer([
				'parcels_yellow'
			], 'Parcels (Yellow)'),
		groupLayer([
				'parcels'
			], 'Parcels (Black)'));


//special loader for layers that need to be on top of many other things - AND show in the legend..

	var topMost = [
		['greenspace_trails', 'Greenspace Trails', false]
	].reverse();
	
	Ext.each(topMost, function (ly, i, lys) {
		overviews.push(
			new OpenLayers.Layer.WMS(
				ly[1], GeowebcacheURL, {
				srs : 'EPSG:3734',
				layers : ly[0],
				transparent : true,
				format : 'image/png',
				tiled : false
			}, {
				buffer : 0,
				displayOutsideMaxExtent : true,
				isBaseLayer : false,
				printUrl : GeoserverWMS,
				visibility : ly[2],
				singleTile : false //,
			}));
		layers.push(overviews[i]);
	});
	
	LEGEND.loadStyles(topMost);

        var reservation_bounds = new OpenLayers.Layer.WMS("Reservation Boundaries",
            GeoserverWMS, 
            {'layers': 'metroparks:reservation_bounds', transparent: true, format: 'image/png'},
            {isBaseLayer: false}
        );

// check legend use of overviewsConfig to see how to use a exclude (or include) list to only GetFeatureInfo for needed layers.  The above is a hack... .

	////// WMS GetFeatureInfo
	var info = new OpenLayers.Control.WMSGetFeatureInfo({
			drillDown : false,
			queryVisible : true,
			panMapIfOutOfView : false,
			url : GeoserverWMS,
//			layers : [reservation_bounds],
//			layers: overviewsConfig[16],
			layerUrls : [GeowebcacheURL],
			eventListeners : {
				getfeatureinfo : function (event) {
					popup = new OpenLayers.Popup.FramedCloud(
							"popinfo",
							map.getLonLatFromPixel(event.xy),
							null,
							event.text,
							null,
							true);
					map.addPopup(popup, true);
				}
			}
		});
	
	map.addControl(info);
	info.activate();
	
	//  end of popup code

	
	var ctrlBtns = [];
	


	ctrlBtns.push(' ');
	ctrlBtns.push(new GeoExt.Action({
			control : new OpenLayers.Control.ZoomToMaxExtent(),
			map : map,
			text : 'Zoom',
			tooltip : 'Zoom to max map extent'
		}), '|', {
		text : 'Fit map',
		tooltip : 'Fit map into print extent',
		handler : function () {
			map.zoomToExtent(
				extentLayer.features[0].geometry.getBounds());
		}
	}, '|', {
		text : 'Graticule',
		enableToggle : true,
		pressed : false,
		tooltip : 'show/hide graticule',
		handler : function (button, evt) {
			var gratLayer = graticule.gratLayer;
			
			if (button.pressed) {
				gratLayer.setVisibility(true);
			} else {
				gratLayer.setVisibility(false);
			}
		}
	}, '->', {
		text : 'Print (on/off)',
		enableToggle : true,
		pressed : false,
		tooltip : 'show/hide print extents',
		handler : function (button, evt) {
			if (button.pressed) {
				printForm.showExtent();
				Ext.getCmp('print-btn').enable();
				printForm.printPage.fit(mapPanel.map, {
					mode : "screen"
				})
			} else {
				printForm.hideExtent();
				map.removeLayer(extentLayer);
				Ext.getCmp('print-btn').disable();
			}
		}
	}, '|', {
		id : 'print-btn',
		cls : 'x-btn-text-icon',
		icon : 'printer.png',
		text : 'Print',
		tooltip : 'Print PDF',
		enableToggle : false,
		handler : function (button, evt) {
			map.zoomToExtent(
				extentLayer.features[0].geometry.getBounds());
			printForm.printExtent.print(printForm.printOptions);
		}
	});
	
	ctrlBtns.push('-');
	ctrlBtns.push(new GeoExt.Action({
			text : 'Navigate',
			control : new OpenLayers.Control.Navigation({
				mouseWheelOptions : {
					interval : 150,
					cumulative : true
				}
			}),
			map : map,
			allowDepress : true,
			pressed : true,
			tooltip : 'navigation',
			toggleGroup : 'nav'
		}));
	
	ctrlBtns.push('-');
	ctrlBtns.push({
		xtype : 'tbtext',
		text : 'Measure:'
	});
	
	ctrlBtns.push(
		new GeoExt.ux.MeasureLength({
			map : map,
			controlOptions : {
				geodesic : true,
				displaySystem : 'english'
			},
			toggleGroup : 'nav'
		}));
	
	ctrlBtns.push(
		new GeoExt.ux.MeasureArea({
			map : map,
			decimals : 0,
			controlOptions : {
				geodesic : true,
				displaySystem : 'english'
			},
			toggleGroup : 'nav'
		}));
	
	//	skipLayerSwitcher[i].setDisplayInLayerSwitcher(false)
	
	mapPanel = new GeoExt.MapPanel({
			border : true,
			region : 'center',
			map : map,
			layers : layers,
			tbar : ctrlBtns
		});
	
	var extentLayer = new OpenLayers.Layer.Vector('Print Area', {
			displayInLayerSwitcher : false,
			styleMap : new OpenLayers.StyleMap(new OpenLayers.Style(Ext.applyIf({
						pointRadius : 4,
						graphicName : 'circle',
						rotation : '${getRotation}',
						strokeColor : '${getStrokeColor}',
						fillOpacity : '${getFillOpacity}'
					}, OpenLayers.Feature.Vector.style['default']), {
					context : {
						getRotation : function (feature) {
							return printForm.printPage.rotation;
						},
						getStrokeColor : function (feature) {
							return feature.geometry.CLASS_NAME == 'OpenLayers.Geometry.Point' ?
							'#000' : '#aaaaaa';
						},
						getFillOpacity : function (feature) {
							return feature.geometry.CLASS_NAME == 'OpenLayers.Geometry.Point' ?
							0 : 0.25;
						}
					}
				}))
		});
	
	legendPanel = new GeoExt.LegendPanel({
			map : map,
			width : 200,
			region : 'east',
			title : 'Legend',
			collapsible : true,
			defaults : {
				style : 'padding:5px',
				imageFormat : 'image/png',
				baseParams : {
					LEGEND_OPTIONS : 'forceLabels:on;fontSize:12',
					WIDTH : 14,
					HEIGHT : 14
				}
			},
			filter : function (record) {
				return !record.get('layer').noDisplayLegend &&
				skipLegendLayers.indexOf(record.get('layer').name) == -1;
			}
		});
	
	printForm = new GeoExt.ux.SimplePrint({
			mapPanel : mapPanel,
			layer : extentLayer, // optional
			autoFit : false,
			printProvider : printProvider,
			//printOptions: {legend: legendPanel},
			labelAlign : 'top',
			labelWidth : 65,
			defaults : {
				width : 190
			},
			bodyStyle : {
				padding : '20px 0px 10px 10px'
			},
			border : false,
			width : 210
		});
	
	printProvider.on({
		'encodelayer' : function (provider, layer, encodedLayer) {
			if (layer.printUrl) {
				encodedLayer.baseURL = provider.getAbsoluteUrl(layer.printUrl);
				if (layer.printLayerName) {
					encodedLayer.layers = [layer.printLayerName].join(",").split(",");
				}
			}
			return encodedLayer;
		},
		'beforeprint' : function (provider, map, pages, options) {
			var scale = map.getScale();
			var legends = [];
			
			for (var i = 0; i < overviewsConfig.length; i++) {
				var layer = overviewsConfig[i];
				var layerName = layer[1];
				
				if (skipLegendLayers.indexOf(layerName) === -1) {
					var mapLayer = map.getLayersByName(layerName)[0];
					
					if (mapLayer && mapLayer.visibility) {
						var layerRules = LEGEND.sldGetRules(layer[3]);
						var scaleRules = LEGEND.filterRulesForScale(layerRules, scale);
						
						var layerLegend = {
							name : layerName
						};
						var layerClasses = [];
						
						if (scaleRules.length === 1 && scaleRules[0].name === 'default') {
							layerClasses.push({
								name : '',
								icons : [
									LEGEND.sldGetRuleLegendGraphic(
										host + GeoserverWMS,
										layer[0],
										null,
										iconWidth, iconHeight)]
							});
						} else {
							for (var j = 0; j < scaleRules.length; j++) {
								layerClasses.push({
									name : scaleRules[j].title || scaleRules[j].name || '',
									icons : [
										LEGEND.sldGetRuleLegendGraphic(
											host + GeoserverWMS,
											layer[0],
											scaleRules[j].name,
											iconWidth, iconHeight)]
								});
							}
						}
						
						if (layerClasses.length > 0) {
							layerLegend['classes'] = layerClasses;
							legends.push(layerLegend);
						}
					}
				}
			}
			
			provider.customParams.legends = legends;
			
			var fName = printForm2.getForm().findField('outputFilename');
			if (!fName.getValue()) {
				fName.setValue(defaultPdfFilename);
			}
		},
		scope : printProvider
	});
	
	printProvider.on({
		'printexception' : function (provider, resp) {
			this.hide();
			//include 5 first lines
			var infoText = resp.responseText.split('\r\n');
			if (infoText.length > 5) {
				infoText = infoText.slice(0, 5).join('<br />');
			}
			
			Ext.MessageBox.alert('Print failure',
				'<b>' + resp.statusText + '</b>' + '<br /><br />' + infoText);
		},
		scope : printForm.busyMask
	});
	
	// add custom fields to the form
	printForm.insert(0, {
		xtype : 'textfield',
		name : 'mapTitle',
		fieldLabel : 'Title',
		value : 'Cleveland Metroparks',
		plugins : new GeoExt.plugins.PrintPageField({
			printPage : printForm.printPage
		})
	});
	
	printForm.insert(4, {
		xtype : 'box',
		anchor : '',
		isFormField : true,
		fieldLabel : 'Scale Conversion',
		autoEl : {
			tag : 'div',
			children : [{
					tag : 'img',
					src : '/geoserver/www/img/scale_key.png'
				}, {
					tag : 'div',
					style : 'margin:0 0 4px 0'
				}
			]
		}
	});
	
	var printPanel = new Ext.Panel({
			title : 'Printing',
			layout : 'fit',
			defaults : {
				autoScroll : true
			}
		});
	
	printPanel.add(printForm);
	printPanel.doLayout();
	
	var printForm2 = new Ext.form.FormPanel({
			id : 'form2',
			title : 'Print options & metadata',
			labelAlign : 'top',
			labelWidth : 65,
			defaults : {
				width : 190
			},
			bodyStyle : {
				padding : '20px 0px 10px 10px'
			},
			border : false,
			width : 210,
			autoScroll : true,
			defaultType : 'textfield',
			items : [{
					fieldLabel : 'Title',
					name : 'metaTitle',
					value : 'Cleveland Metroparks GIS Print',
					plugins : new GeoExt.plugins.PrintProviderField({
						printProvider : printProvider
					})
				}, {
					fieldLabel : 'Author',
					name : 'metaAuthor',
					value : 'Cleveland Metroparks',
					plugins : new GeoExt.plugins.PrintProviderField({
						printProvider : printProvider
					})
				}, {
					fieldLabel : 'Subject',
					name : 'metaSubject',
					value : 'Cleveland Metroparks GIS Print',
					plugins : new GeoExt.plugins.PrintProviderField({
						printProvider : printProvider
					})
				}, {
					fieldLabel : 'Keywords',
					name : 'metaKeywords',
					value : '',
					plugins : new GeoExt.plugins.PrintProviderField({
						printProvider : printProvider
					})
				}, {
					fieldLabel : 'PDF Output filename',
					name : 'outputFilename',
					id : 'outputFilename',
					value : defaultPdfFilename,
					plugins : new GeoExt.plugins.PrintProviderField({
						printProvider : printProvider
					})
				}, {
					fieldLabel : 'Disable Layer Merging',
					xtype : 'checkbox',
					name : 'layersMerging',
					checked : false,
					handler : function (cbox, checked) {
						printProvider.customParams.layersMerging = !checked;
					}
				}
			]
		});
	
	var treeConfig = new OpenLayers.Format.JSON().write([{
					nodeType : 'gx_baselayercontainer',
					expanded : true
				}, {
					nodeType : 'gx_overlaylayercontainer',
					expanded : true
				}
			], true);
	
	var layerTree = new Ext.tree.TreePanel({
			bodyStyle : {
				padding : '10px 0px 00px 0px'
			},
			title : 'GIS Layers',
			autoScroll : true,
			loader : new Ext.tree.TreeLoader({
				applyLoader : false
			}),
			root : {
				nodeType : 'async',
				// the children property of an Ext.tree.AsyncTreeNode is used to
				// provide an initial set of layer nodes. We use the treeConfig
				// from above, that we created with OpenLayers.Format.JON.write.
				children : Ext.decode(treeConfig)
			},
			
			rootVisible : false,
			lines : true
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
			width : 250,
			split : false,
			collapsible : true,
			closable : false,
			autoScroll : true,
			region : 'west',
			border : true,
			layout : 'accordion',
			items : [layerTree, printPanel, printForm2]
		});
	
	var zoohortLink = ['              . <small>Additional Maps:</small>                 || ',
		'<a href="http://cmac-srv-gis/gis/pdnr_gis.html" target="_blank">Old GIS</a>',
		
		//			'              .                 ',
		//			'<a href="http://192.168.100.153/geoserver/www/printing" target="_blank">New GIS</a>',
		'              |                 ',
		'<a href="../zoohort" target="_blank">Zoo Horticulture</a>',
		'              |                 ',
		'<a href="census.html" target="_blank">Census</a>',
		'              |                 ',
		'<a href="nr.html" target="_blank">Natural Resources</a>',
		'              |                 ',
		'<a href="../landmaps/index.html" target="_blank">Landmaps</a>',
		' || ', '<small>Most data used are from public sources.  Remaining map data &copy; <a href="www.openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA.</small>'
	];
	
	var topPanel = new Ext.Panel({
			title : 'WELCOME TO THE CLEVELAND METROPARKS GIS',
			width : 500,
			height : 45,
			split : false,
			collapsible : true,
			autoScroll : true,
			region : 'north',
			border : true,
			layout : 'fit',
			items : [],
			html : zoohortLink
		});
	
	new Ext.Viewport({
		layout : 'fit',
		hideBorders : true,
		items : {
			layout : 'border',
			deferredRender : false,
			items : [topPanel, mapPanel, panels, legendPanel]
		}
	});
	
	//add graticule layer last in order to print it on top
	var graticule = new OpenLayers.Control.Graticule({
			numPoints : 2,
			labelled : true,
			visible : false,
			targetSize : 500,
			labelFormat : 'dms',
			layerName : "Graticule (Geographic Grid)",
			lineSymbolizer : {
				'strokeWidth' : 1.5,
				'strokeColor' : '#000000',
				'strokeDashstyle' : 'dashdot',
				'strokeOpacity' : 0.7
			},
			labelSymbolizer : {
				'strokeColor' : '#ffffff',
				'fontColor' : '#000000',
				'fontWeight' : 'bold'
			}
		});
	map.addControl(graticule);
	
	var panel = new OpenLayers.Control.NavToolbar();
	map.addControl(panel);
	
	hist = new OpenLayers.Control.NavigationHistory();
	map.addControl(hist);
	
	panel.addControls([hist.next, hist.previous]);
	map.addControl(panel);
	
	printForm.printPage.fit(mapPanel.map, {
		mode : "screen"
	})
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
		new OpenLayers.Bounds(2112700, 583900, 2280000, 719000)
		//		new OpenLayers.Bounds(2112821,560287,2274487,706832)
	);
	//    }
	
	// avoid pink tiles
	OpenLayers.IMAGE_RELOAD_ATTEMPTS = 3;
	OpenLayers.Util.onImageLoadErrorColor = "transparent";
	
});

