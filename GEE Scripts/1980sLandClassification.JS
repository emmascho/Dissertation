// Load country boundaries from LSIB.
var countries = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
// Get a feature collection with just the Madagascar feature.
var madagascar = countries.filter(ee.Filter.eq('country_na', 'Madagascar'));

var year = '1987';
var startDate = '1984-01-01';
var endDate = '1994-10-28';


//// Adding Landsat 5TM data ////
var Landsat5TM = ee.ImageCollection("LANDSAT/LT05/C01/T1")
.filterBounds(roi)
.filter(ee.Filter.lt('CLOUD_COVER', 20)) //filters to get data with less than 20% clouds
.sort('CLOUD_COVER')
.filterDate(startDate, endDate)
.map(function(img){
                      var t = img.select([ 'B1','B2','B3','B4','B5','B6','B7']).divide(10000);//Rescale to 0-1
                      var out = t.copyProperties(img).copyProperties(img,['system:time_start']);
                    return out;
                      })
                      .select(['B1','B2','B3','B4','B5','B6','B7'],['blue','green','red','NIR','SWIR1','TIR','SWIR2']);
print('Landsat 5TM1 images of the area during the study period <10% Cloud cover',Landsat5TM);// print list of all images with<15% cloud = 509 images to cover the whole area

                  
print('5TM images of the area during the study period',Landsat5TM);
//oldest tile from 1985, but few, majority 1990

var vizParams = {bands: ['red', 'green', 'blue'], min: 0, max: 0.3};


var s2final = ee.Image(cloudmask_composite);
var s2ROI = s2final.clip(roi);

var cloudmask_composite = Landsat5TM.median();
Map.addLayer(cloudmask_composite.clip(roi), {bands: ['red', 'green', 'blue']}, 'landsat 5TM image composite-median');
var Landsat5TMfinal = ee.Image(cloudmask_composite);
var Landsat5TMroi = Landsat5TMfinal.clip(roi);

////// Adding NDVI for degradation /////
//improved validation accuracy by 2%//

var red = Landsat5TMroi.select('red');
var nir = Landsat5TMroi.select('NIR');
var ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
var NDVI=ndvi.clip(roi);

var ndviParams = {min: -1, max: 1, palette: ['blue', 'white', 'green']};
Map.addLayer(NDVI, ndviParams, 'NDVI', false);

//// Adding SRTM data ////

var dataset = ee.Image('USGS/SRTMGL1_003');

var elevation = dataset.select('elevation');
var slope = ee.Terrain.slope(elevation);

//Masking areas above 35m with SRTM
var elevationmask = elevation.select('elevation').lt(35);
var elevationMask=elevationmask.clip(roi);

// Adding JERS1 1996 mosaic //
//increased accuracy by 3% overall

var JERS= ee.Image(JERS1);
var JERS1roi= JERS.clip(roi);

Map.addLayer(JERS1roi, {},'JERS1 mosaic');

/// Merging Bands ////

var mergedCollection = Landsat5TMroi.addBands(slope).addBands(elevation).addBands(NDVI).addBands(JERS1roi);

var bandNames = mergedCollection.bandNames();

print('Band names: ', bandNames); // ee.List of band namesds(slope).addBands(elevation).addBands(NDVI);

/// Classification image ////
// Use these bands for classification.
var bands = ['blue','green','red','NIR','SWIR1','TIR','SWIR2','slope','elevation','NDVI','b1','b2','b3','b4'];
var finalBands = mergedCollection.select(bands);

/////// MASKING /////
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
//This might underestimate these categories//
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


// Export the image to Drive .
Export.image.toDrive({
  image: classified,
  description: 'exporting-1980s-map-toDrive',
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

//accuracy of 76% before JERS1
//accurayc of 0.795% now
//Increased cloud cover to 20 and reduced to 10 year period=0.83% accuracy

/// Change ANALYSIS////


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
var area = total.reduceRegion(ee.Reducer.sum(),roi, 30,null, null, false,1e13);
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
var areaSize = ee.Feature(null,area);

// export data 
Export.table.toDrive({
  collection: ee.FeatureCollection([areaSize]),
  description: 'area 1980s',
  fileFormat: 'CSV'
});
