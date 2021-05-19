
var year = '2004';
var startDate = '1999-01-01';
var endDate = '2009-10-30';

//////SRTM 30m res Digital Elevation Model//////


var dataset = ee.Image('USGS/SRTMGL1_003');

var elevation = dataset.select('elevation');
var slope = ee.Terrain.slope(elevation);

//Masking areas above 35m with SRTM
var elevationmask = elevation.select('elevation').lt(35);
var elevationMask=elevationmask.clip(roi);

//// Adding Landsat 5TM data ////
// Changing time period of landsat 5 separtely and adding 1998-2000 period improved classification by 7%
var Landsat5TM = ee.ImageCollection("LANDSAT/LT05/C01/T1")
.filterBounds(roi)
.filter(ee.Filter.lt('CLOUD_COVER', 20)) //filters to get data with less than 15% clouds
.sort('CLOUD_COVER')
.filter(ee.Filter.date('1998-01-01','2009-10-30'))
.map(function(img){
                      var t = img.select([ 'B1','B2','B3','B4','B5','B6','B7']).divide(10000);//Rescale to 0-1
                      var out = t.copyProperties(img).copyProperties(img,['system:time_start']);
                    return out;
                      })
                      .select(['B1','B2','B3','B4','B5','B6','B7'],['blue','green','red','NIR','SWIR1','TIR','SWIR2']);
print('Landsat 5TM1 images of the area during the study period <10% Cloud cover',Landsat5TM);// print list of all images with<15% cloud = 509 images to cover the whole area

                  
print('5TM images of the area during the study period',Landsat5TM);


var vizParams = {bands: ['red', 'green', 'blue'], min: 0, max: 0.3};


var composite = ee.Image(Landsat5TM);
var compoRoi = composite.clip(roi);

var cloudmask_composite = Landsat5TM.median();
Map.addLayer(cloudmask_composite.clip(roi), {bands: ['red', 'green', 'blue']}, 'landsat 5TM image composite-median');
var Landsat5TMfinal = ee.Image(cloudmask_composite);
var Landsat5TMroi = Landsat5TMfinal.clip(roi);


// Adding Landsat 7 ETM+ Data //
//Note all satellites are Tier 1 images, so highest quality data //


var Landsat7 = ee.ImageCollection("LANDSAT/LE07/C01/T1")
.filterBounds(roi)
.filter(ee.Filter.lt('CLOUD_COVER', 17)) //filters to get data with less than 15% clouds
.sort('CLOUD_COVER')
.filterDate(startDate, endDate)
.map(function(img){
                      var t = img.select([ 'B1','B2','B3','B4','B5','B6_VCID_1','B6_VCID_2','B7','B8']).divide(10000);//Rescale to 0-1
                      var out = t.copyProperties(img).copyProperties(img,['system:time_start']);
                    return out;
                      })
                      .select(['B1','B2','B3','B4','B5','B6_VCID_1','B6_VCID_2','B7','B8'],['blue','green','red','NIR','SWIR1','Low-gain Thermal Infrared 1','High-gain Thermal Infrared 1','SWIR2','panchromatic']);
print('Landsat 7 images of the area during the study period <17% Cloud cover',Landsat7);// print list of all images with<15% cloud = 509 images to cover the whole area

var Landsat7Composite = Landsat7.median();
Map.addLayer(Landsat7Composite.clip(roi), {bands: ['red', 'green', 'blue']}, 'landsat 7 image composite-median');
var Landsat7final = ee.Image(cloudmask_composite);
var Landsat7roi = Landsat7final.clip(roi);

// Adding Palsar 2 bands //

//Add PALSAR2 bands

var PALSAR = ee.ImageCollection('JAXA/ALOS/PALSAR/YEARLY/SAR')
                  .filterDate('2007-01-01', '2008-07-28')
                  .filterBounds(roi)
 //25m res of palsar changed to 30 for Landsat

var meanPALSAR = PALSAR.mean();
var HHmean = meanPALSAR.select('HH');
var HVmean = meanPALSAR.select('HV');

var HHmeanImage = ee.Image(HHmean);
var HHmeanRoi = HHmean.clip(roi);

var HVmeanImage = ee.Image(HVmean);
var HVmeanRoi = HVmean.clip(roi);

//Map.addLayer(HHmean.clip(roi), {} ,'HHmean Palsar');
//Map.addLayer(HVmean.clip(roi), {} ,'HVmean Palsar');


////// Adding NDVI for degradation ///// 


var red = Landsat7roi.select('red');
var nir = Landsat7roi.select('NIR');
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');

var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
Map.addLayer(ndvi, ndviParams, 'NDVI', false);


//// Merging all bands ////

var mergedCollection = Landsat5TMroi.addBands(slope).addBands(elevation).addBands(HVmeanRoi).addBands(HHmeanRoi).addBands(ndvi);

var bandNames = mergedCollection.bandNames();

print('Band names: ', bandNames); // ee.List of band names

/// Classification image ////
// Use these bands for classification.Not really used this only for masks
var bands = ['blue','green','red','NIR','SWIR1','SWIR2','TIR','slope','elevation','HH','HV','NDVI'];
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



// Export the image to an Earth Engine asset.
//Export.image.toAsset({
//  image: classified,
//  description: 'exporting-map-to-Assest',
//  assetId: 'users/emschoenm/FirstAttempt2020',
//  scale: 30,
//  region: roi,
//  pyramidingPolicy: {
//    '.default': 'sample',
//  },
//  maxPixels: 1e13
//});


// Export the image to Drive.
Export.image.toDrive({
  image: classified,
  description: 'exporting-2000-map-toDrive',
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
//0.894% with 70%-30% split 
//0.911% accuracy with 10 year period w/ Landsat 5 and 7


///// Change Analysis //////


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
var area = total.reduceRegion(ee.Reducer.sum(),polygons, 30,null, null, false,1e13);
print('Area by class (m2)', area);


var exportAccuracy = ee.Feature(null, {matrix: testAccuracy.array()});
var exportAccuracyNumber = ee.Feature(null, {matrix: testAccuracy.accuracy()});

//exporting accuracy to drive table //
Export.table.toDrive({
  collection: ee.FeatureCollection(exportAccuracy),
  description: 'AccuracyMatrix'+'_'+roi + year + '_'+ randomSeed,
  fileFormat: 'CSV'
});

// create feature class
var areaSize = ee.Feature(roi,area);

// export data 
Export.table.toDrive({
  collection: ee.FeatureCollection([areaSize]),
  description: 'area',
  fileFormat: 'CSV'
});
