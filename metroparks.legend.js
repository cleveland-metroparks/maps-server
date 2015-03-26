var LEGEND = {};

LEGEND.loadStyles = function(layerArray){

    var sldFormat = new OpenLayers.Format.SLD();
    var jsonFormat = new OpenLayers.Format.JSON();

    var layerRestUrl = GeoserverURL + '/rest/layers/';
    var styleRestUrl = GeoserverURL + '/rest/styles/';

    // set some delay before each request not to overwhelm the server with many style requests at once
    var delay = 1;
    Ext.each(layerArray, function(ly,i,lys){
        var layer=ly;
        var layerName = ly[0];
        var layerUrl = layerRestUrl + layerName + '.json';

        setTimeout(function(){
            var onLayerComplete = function(request){
                try{
                    var layerData = jsonFormat.read(request.responseText);
                    var styleName = layerData.layer.defaultStyle.name;
                    var layerSLDUrl = styleRestUrl + styleName + '.sld';

                    var onSLDComplete = function(reqSLD){
                        try{
                            var SLDData = sldFormat.read(reqSLD.responseXML || reqSLD.responseText);

                            var sldNamedlayer = LEGEND.sldGetNamedLayer(SLDData);
                            layer.push(sldNamedlayer);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    var onSLDFailure = function(req){
                        console.error(req.responseText);
                    }

                    //small delay before loading sld file
                    setTimeout(function(){
                        OpenLayers.loadURL(layerSLDUrl, null, null, onSLDComplete, onSLDFailure);
                    }, 25);

               } catch (err) {
                    console.error(err);
               }
            }

            var onLayerFailure = function(req){
                console.error(req.responseText);
            }

            OpenLayers.loadURL(layerUrl, null, null, onLayerComplete, onLayerFailure);
        }, ++delay*100);

    });
}

LEGEND.sldGetNamedLayer = function(inSld){
    for(var key in inSld.namedLayers){
        if(inSld.namedLayers[key])
            return  inSld.namedLayers[key];
    }
}

LEGEND.sldGetRules = function(layer){
    var rules=null;
        if(layer.userStyles[0]){
            rules = layer.userStyles[0].rules;
        }
    return rules;
}

LEGEND.filterRulesForScale = function(rules, zoomscale){
    var rulesOut = [];

    for(var i=0; i<rules.length; i++){
        var max = rules[i].maxScaleDenominator;
        var min = rules[i].minScaleDenominator;
        if((!min && !max ) || (zoomscale >= min && !max) ||
        (!min && zoomscale <= max) || (zoomscale >= min && zoomscale <= max)){
            rulesOut.push(rules[i]);
        }
    }

    return rulesOut;
}

LEGEND.sldGetRuleLegendGraphic=function(geoserverUrlWMS, geoserverLayerName, ruleName, width, height){
    var params = {
        'VERSION' : '1.1.0',
        'REQUEST' : 'GetLegendGraphic',
        'LAYER'   : geoserverLayerName,
        'HEIGHT'  : height,
        'WIDTH'   : width,
        'FORMAT'  : 'image/png',
        'TRANSPARENT' : 'true',
        'LEGEND_OPTIONS' : 'forceLabels:false',
        'EXCEPTIONS' : 'application/vnd.ogc.se_xml'
        };

    if(ruleName){
        Ext.apply(params, { 'RULE' : ruleName });
    }

    return Ext.urlEncode(params, geoserverUrlWMS);
}
