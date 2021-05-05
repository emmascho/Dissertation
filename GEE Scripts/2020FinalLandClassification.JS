//2020 Classification Madagascar

//Assets were imported with land class polygons for training done in QGIS
//Roi was also an asset

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
//Map.addLayer(s1VV, {min: -20, max: -5} ,'VVdes');

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

//Map.addLayer(s1VH, {min: -20, max: -5} ,'VHdes');

// Export the image to an Earth Engine asset.
//Export.image.toDrive({
//  image: s1VH,
//  description: 'means1VHdes',
//  scale: 30,
//  region: roi,
//  fileFormat: 'GeoTIFF',
//  maxPixels: 1e13
//});


// Standard Deviation  (Note:adding Stdev added +3% in validation accuracy)
// VH std
var s1VHstdCollection= collectionVHdes.reduce(ee.Reducer.stdDev());
var s1VHstdimage= ee.Image(s1VHstdCollection);
var s1VHstd= s1VHstdimage.clip(roi);

//Map.addLayer(s1VV, {min: -20, max: -5} ,'VHdes stdev');


// Export the image to an Earth Engine asset.
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

////// Adding NDVI for degradation /////
//improved validation accuracy by 2%//

var red = s2ROI.select('red');
var nir = s2ROI.select('nir');
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
//Map.addLayer(ndvi, ndviParams, 'NDVI', false);



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
//Map.addLayer(SRTMMask, {},'SRTM Mask',false);
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
//Map.addLayer(maskedComposite, vizParams, 'masked');


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
var meanDict = elevation.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: Mangrove,
  scale: 30
});

// Other forest types found to be at ~113.7 m on average 
// Mangroves found to be at ~13.8m


// Get the mean from the dictionary and print it.
var mean = meanDict.get('elevation');
print('Mean elevation', mean);


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



 Export the image to an Earth Engine asset.
Export.image.toAsset({
 image: classified,
 description: 'exporting-map-to-Assest',
 assetId: 'users/emschoenm/FirstAttempt2020',
 scale: 30,
 region: roi,
pyramidingPolicy: {
   '.default': 'sample',
 },
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

