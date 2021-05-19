
// Load country boundaries from LSIB.
var countries = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
// Get a feature collection with just the Madagascar feature.
var madagascar = countries.filter(ee.Filter.eq('country_na', 'Madagascar'));
//This only gets land cover and masks water


var year = '2020';
var startDate = '2020-01-01';
var endDate = '2020-07-28';

//////SRTM 30m res Digital Elevation Model//////
//needs rescaling after, apply to bands, needs to be done separately as asset

var dataset = ee.Image('USGS/SRTMGL1_003');

var elevation = dataset.select('elevation');
var slope = ee.Terrain.slope(elevation);

//Masking areas above 35m with SRTM
var elevationmask = elevation.select('elevation').lt(35);
var elevationMask=elevationmask.clip(roi);



////////Adding Sentinel 1///////
//needs to be done separately as asset


// Filtering of image collection
var collectionVVdes = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filterDate(startDate,endDate)
  .filterBounds(roi)
  .filter(ee.Filter.eq('resolution_meters',10))
  .select(['VV'])
  
  .map(function(image) {
          var edge = image.lt(-90.0);//selects data edge lower than (lt) -90
          var maskedImage = image.mask().and(edge.not());
        return image.updateMask(maskedImage);
        });

 print(collectionVVdes);

// Adding VV+VH polarisation to account for water and mangroves
var s1VVmean = collectionVVdes.mean();

var s1VVimage= ee.Image(s1VVmean);
var s1VV = s1VVimage.clip(roi);
Map.addLayer(s1VV, {min: -20, max: -5} ,'VVdes');

// VV std
var s1VVstdCollection= collectionVVdes.reduce(ee.Reducer.stdDev());
var s1VVstdimage= ee.Image(s1VVstdCollection);
var s1VVstd= s1VVstdimage.clip(roi);
Map.addLayer(s1VV, {min: -20, max: -5} ,'VVdes stdev');


// Export the image to an Earth Engine asset.
Export.image.toDrive({
  image: s1VVstd,
  description: 'stdevs1VVdes',
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

// Export the image to an Earth Engine asset.
Export.image.toDrive({
  image: s1VV,
  description: 'means1VVdes',
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});


//// Adding Sentinel VH layer /////
var collectionVHdes = ee.ImageCollection('COPERNICUS/S1_GRD')
 .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
 .filter(ee.Filter.eq('instrumentMode', 'IW'))
 .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filterDate(startDate,endDate)
  .filterBounds(roi)
  .filter(ee.Filter.eq('resolution_meters',10))
  .select(['VH'])
  
  .map(function(image) {
          var edge = image.lt(-90.0);//idk what this value is
          var maskedImage = image.mask().and(edge.not());
          return image.updateMask(maskedImage);
        });

// Adding VV+VH polarisation to account for water and mangroves
var s1VHmean = collectionVHdes.mean();


var s1VHimage= ee.Image(s1VHmean);
var s1VH = s1VHimage.clip(roi);

Map.addLayer(s1VH, {min: -20, max: -5} ,'VHdes');

 //Export the image to drive.
Export.image.toDrive({
image: s1VH,
description: 'means1VHdes',
 scale: 30,
 region: roi,
 fileFormat: 'GeoTIFF',
 maxPixels: 1e13
});


// Standard Deviation  (Note:adding Stdev added +3% in validation accuracy)
// VH std
var s1VHstdCollection= collectionVHdes.reduce(ee.Reducer.stdDev());
var s1VHstdimage= ee.Image(s1VHstdCollection);
var s1VHstd= s1VHstdimage.clip(roi);

Map.addLayer(s1VV, {min: -20, max: -5} ,'VHdes stdev');


// Export the image to drive.
Export.image.toDrive({
  image: s1VHstd,
  description: 'stdevs1VHdes',
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});


///// Adding Sentine-2 Data ////


var image = ee.ImageCollection('COPERNICUS/S2')
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) //filters to get data with less than 15% clouds
    .sort('CLOUDY_PIXEL_PERCENTAGE')
    .filterBounds(roi)
    .map(function(img){
                      var t = img.select([ 'B1','B2','B3','B4','B5','B6','B7','B8','B8A', 'B9','B10', 'B11','B12']).divide(10000);//Rescale to 0-1
                      var out = t.copyProperties(img).copyProperties(img,['system:time_start']);
                    return out;
                      })
                      .select(['B1','B2','B3','B4','B5','B6','B7','B8','B8A', 'B9','B10', 'B11','B12'],['aerosol', 'blue', 'green', 'red', 'red1','red2','red3','nir','red4','h2o', 'cirrus','swir1', 'swir2']);
print('S2 images of the area during the study period <10% Cloud cover',image);// print list of all images with<15% cloud = 509 images to cover the whole area



// Obtain the least cloudy image and clip to the ROI

var vizParams = {bands: ['red', 'green', 'blue'], min: 0, max: 0.3};

var cloudmask_composite = image.median();
Map.addLayer(cloudmask_composite.clip(roi), {bands: ['red', 'green', 'blue'], min: 0, max: 0.3}, 's2 image composite-median');

var s2final = ee.Image(cloudmask_composite);
var s2ROI = s2final.clip(roi);



// Export the image to drive.
Export.image.toDrive({
  image: s2ROI,
  description: 'Sentinel 2 median composite',
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});


////// Adding NDVI for degradation /////
//improved validation accuracy by 2%//

var red = s2ROI.select('red');
var nir = s2ROI.select('nir');
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
Map.addLayer(ndvi, ndviParams, 'NDVI', false);

// Tried adding NDWI by Xu et al., 2006 as a water mask but resulted in a 3% decrease in accuracy///



//// Merging all bands ////
//Maybe change to s1 as base image?? Adding all bands gave more urban areas, less other forest and a tad less aqua

var mergedCollection = s2ROI.addBands(slope).addBands(elevation).addBands(s1VH).addBands(s1VV).addBands(s1VHstd).addBands(s1VVstd).addBands(ndvi);

var bandNames = mergedCollection.bandNames();

print('Band names: ', bandNames); // ee.List of band names


/// Classification image ////
// Use these bands for classification.Not really used this only for masks
var bands = ['aerosol','blue', 'green', 'red', 'red1','red2','red3','nir','red4','h2o','swir1', 'swir2','cirrus','VV','slope','elevation','VH','VH_stdDev','VV_stdDev','NDVI'];
var finalBands = mergedCollection.select(bands);

/////MASKING/////
//ELevation Mask//

var SRTMMask = finalBands.updateMask(elevationmask);
Map.addLayer(SRTMMask, {},'SRTM Mask',false);
var finalImage= SRTMMask;



//Water Mask//

// Load or import the Hansen et al. forest change dataset.
var hansenImage = ee.Image('UMD/hansen/global_forest_change_2015');

// Select the land/water mask.
var datamask = hansenImage.select('datamask');

// Create a binary mask.
var mask = datamask.eq(1);

// Update the composite mask with the water mask!!!
var maskedComposite = finalImage.updateMask(mask);
Map.addLayer(maskedComposite, vizParams, 'masked');


// Make a water image out of the mask.
//var water = mask.not();

// Mask water with itself to mask all the zeros (non-water).
//water = water.mask(water);

// Make an image collection of visualization images.
//var mosaic = ee.ImageCollection([
//  finalBands.visualize(vizParams),
//  water.visualize({palette: '000044'}),
//]).mosaic();

//var waterMask=mosaic.clip(roi);

// Display the mosaic.
//Map.addLayer(waterMask, {}, 'water mask');
//var FinalMask= waterMask.and(elevationMask);
//Map.addLayer(FinalMask, {}, 'mask ');

//var image= SRTMMask.addBands(mosaic);
//Map.addLayer(image, {}, 'masked image');


// Purposefully chose area with less clouds after investigation, so dry season = July month 
// note that this is also the period when deforestations are at their highest
//Note that west coast (ROI) is drier than East coast so cloud cover may be lower

/////CLASSIFICATION////

// Make a FeatureCollection from the hand-made geometries.
// Manually created polygons.

var polygons = ee.FeatureCollection([
  ee.Feature(Water),
  ee.Feature(Urban),
  ee.Feature(Agriculture),
  ee.Feature(Aquaculture),
  ee.Feature(Mangrove),
  ee.Feature(BareGround),
  ee.Feature(OtherForest)
]).flatten();



// Compute the mean elevation in the polygon.
var medianDict = elevation.reduceRegion({
  reducer: ee.Reducer.median(),
  geometry: Aquaculture,
  scale: 30
});

// Other forest types found to be at ~113.7 m on average 
// Mangroves found to be at ~13.8m
// Aquaculture found to be at ~3.43m on average


// Get the mean from the dictionary and print it.
var median = medianDict.get('elevation');
print('median elevation', median);


///////// Random Pixel sampling approach //////////

// Assign random column to sample
var randomSeed = 0; 

var n = randomSeed;
var randomMangrove = Mangrove.randomColumn('random', n);
var randomAquaculture = Aquaculture.randomColumn('random', n);
var randomAgriculture = Agriculture.randomColumn('random', n);
var randomUrban = Urban.randomColumn('random', n);
var randomWater = Water.randomColumn('random', n);
var randomBareGround = BareGround.randomColumn('random', n);
var randomOtherForest = OtherForest.randomColumn('random', n);

// 70:30 for training and testing, as classes such as urban+aquaculture have few polygons
//This might underestimate these categories
var split = 0.7;

var trainingSample = randomBareGround.filter(ee.Filter.lt('random', split))
  .merge(randomMangrove.filter(ee.Filter.lt('random', split)))
  .merge(randomAquaculture.filter(ee.Filter.lt('random', split)))
  .merge(randomAgriculture.filter(ee.Filter.lt('random', split)))
  .merge(randomUrban.filter(ee.Filter.lt('random', split)))
  .merge(randomWater.filter(ee.Filter.lt('random', split)))
  .merge(randomOtherForest.filter(ee.Filter.lt('random', split)));
  
var testingSample = randomBareGround.filter(ee.Filter.gte('random', split))
  .merge(randomMangrove.filter(ee.Filter.gte('random', split)))
  .merge(randomAquaculture.filter(ee.Filter.gte('random', split)))
  .merge(randomAgriculture.filter(ee.Filter.gte('random', split)))
  .merge(randomUrban.filter(ee.Filter.gte('random', split)))
  .merge(randomWater.filter(ee.Filter.gte('random', split)))
  .merge(randomOtherForest.filter(ee.Filter.gte('random', split)));



// Get the values for all pixels in each polygon in the training.
var training = maskedComposite.sampleRegions({
  // Get the sample from the polygons FeatureCollection.
collection: trainingSample,
  // Keep this list of properties from the polygons. 
  //Class column was made from QGIS w/ 0 attribute to all components of mangrove, 1 to all polygons in aquaculture etc
properties: ['Class'],
  // Set the scale to get Sentinel pixels in the polygons.
 scale: 30
});


// Create the classifier
var classifier = ee.Classifier.smileRandomForest(10)
 .train({
      features: training, 
      classProperty: 'Class', 
      inputProperties: bandNames,
});



// Classify the input imagery
var classified = maskedComposite.classify(classifier,'classification');


// Create a palette to display the classes
var palette =['482173',//Mangrove (purple)
              '4682b4',//Aquaculture(light navy blue)
              '1eba90',//Agriculture(light green)
              'bddf26',//Urban (yellow)
              '170b63',//Water (dark blue)
              'FFCB9C',//Bare Ground(light brown)
              '077c66',//Other Forest (dark/forest green)
];

// Display the classified map
Map.addLayer(classified, {min: 0, max: 6, palette: palette}, 'Classified');


 //Export the image to an Earth Engine asset.
Export.image.toAsset({
  image: classified,
  description: 'exporting-map-to-Assest',
  assetId: 'users/emschoenm/2020Classification',
  scale: 30,
  region: roi,
  pyramidingPolicy: {
    '.default': 'sample',
  },
  maxPixels: 1e13
});

// Export the image to an Earth Engine asset.
Export.image.toDrive({
  image: classified,
  description: 'exporting-2020-map-toDrive',
  scale: 30,
  region: roi,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

//// Confusion Matrix & Accuracy //////

// Sample the input to get validation data
var validation = maskedComposite.sampleRegions({
  collection: testingSample,
  properties: ['Class'],
  scale: 30,
});

// Get a confusion matrix representing resubstitution accuracy.
//describes how well the classifier was able to correctly label resubstituted training data, 
//i.e. data the classifier had already seen
print('RF error matrix: ', classifier.confusionMatrix());
print('RF accuracy: ', classifier.confusionMatrix().accuracy());
//RF accuracy of 0.998 

// Classify the validation data
var validated = validation.classify(classifier);

// Get a confusion matrix representing expected accuracy
var testAccuracy = validated.errorMatrix('Class', 'classification');
print ('Validation accuracy exported to "Tasks"');
print('Validation error matrix: ', testAccuracy);
print('Validation overall accuracy: ', testAccuracy.accuracy());
// 0.757 overall validation accuracy with a 50%-50% split
//0.869% with 70%-30% split 

////// Change ANALYSIS //////


// Create a legend
var labels = ['Mangrove','Aquaculture', 'Agriculture', 'Urban', 'Water', 'Bare ground', 'Other Forest'];
var add_legend = function(title, lbl, pal) {
  var legend = ui.Panel({style: {position: 'bottom-left'}}), entry;
  legend.add(ui.Label({value: title, style: { fontWeight: 'bold', fontSize: '18px', margin: '0 0 4px 0', padding: '0px' } }));
  for (var x = 0; x < lbl.length; x++){
    entry = [ ui.Label({style:{color: pal[x], border:'1px solid black', margin: '0 0 4px 0'}, value: '██'}),
      ui.Label({ value: labels[x], style: { margin: '0 0 4px 4px' } }) ];
    legend.add(ui.Panel(entry, ui.Panel.Layout.Flow('horizontal')));
  } Map.add(legend); };
  
add_legend('Legend', labels, palette);




////////// Calculate area by class//////////
var names = ['0 mangrove', '1 aquaculture', '2 agriculture', '3 urban', '4 water','5 bare ground','6 other forest'];
var count = classified.eq([0, 1, 2, 3, 4, 5, 6]).rename(names);
var total = count.multiply(ee.Image.pixelArea());
var area = total.reduceRegion(ee.Reducer.sum(),roi, 30,null,null,false,1e13);
print('Area by class (m2)', area);
//check that this measures all the classes and not just the area of the polygons 

var exportAccuracy = ee.Feature(null, {matrix: testAccuracy.array()});
var exportAccuracyNumber = ee.Feature(null, {matrix: testAccuracy.accuracy()});

//exporting accuracy to drive table //
Export.table.toDrive({
  collection: ee.FeatureCollection(exportAccuracy),
  description: 'AccuracyMatrix2020'+'_'+roi + year + '_'+ randomSeed,
  fileFormat: 'CSV'
});

// create feature class
var areaSize = ee.Feature(roi, area);

//Area size unit is in m2

// export data 
Export.table.toDrive({
  collection: ee.FeatureCollection([areaSize]),
  description: 'area 2020',
  fileFormat: 'CSV'
});



