## Method & Code for Land Classification in GEE

#### METHOD
Land Classification with polygons done in QGIS, with features ID, Class and Area
- ID: 1-20 (depending on number of polygons)
- Class: Applied one number per class so
0 --> Mangrove
1 --> Aquaculture
2 --> Agriculture
3 --> Urban
4 --> Water
5 --> BareGround
6 --> OtherForest

Criterias
- Mangrove: based on own knowledge & WWF map
- Aquaculture: own knowledge, Madagascar map of aquaculture regions + Google maps, mainly shrimp farms and fish
- Agriculture: includes slash and burn sitees, sites near house, highly irrigated sites (circular plots)
- Urban : defined as over 5000 habitants, map by Malagasy gov 
- Water: includes ocean, sea, river, lakes and sites near mangroves
- BareGround: includes sand, bare ground near trees, sediment deposits
- OtherForest: other terra firme forests and potentially shrubs, non-mangroves

### Code
https://code.earthengine.google.com/488961c5b73b6c2f7b692a7c2ef26a31


#### Preliminary cloud score chart to define less cloudy areas + time

var s2 = ee.ImageCollection('COPERNICUS/S2') // adding Sentinel 2 data
                    .filterDate(startDate, endDate)
                    .filterBounds(roi);


var getCloudScores = function(img){
    var value = ee.Image(img).get('CLOUDY_PIXEL_PERCENTAGE');
    return ee.Feature(null, {'score': value});
};

//graph of cloud score in percentage
var s2clouds = s2.map(getCloudScores);
print ('cloud score', ui.Chart.feature.byFeature(s2clouds));


var getCloudScores = function(img){
    var value = ee.Image(img).get('CLOUDY_PIXEL_PERCENTAGE');
    return ee.Feature(null, {'score': value});
};

//graph of cloud score in percentage
var s2clouds = s2.map(getCloudScores);
print ('cloud score', ui.Chart.feature.byFeature(s2clouds)); 

### Classification

var year = '2020';
var startDate = '2020-01-01';
var endDate = '2020-07-28';


var bands = ['aerosol', 'blue', 'green', 'red', 'red1','red2','red3','nir','red4','h2o', 'cirrus','swir1', 'swir2'];

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
var s2leastCloud = ee.Image(image.first());// only gives first image with less clouds


var vizParams = {bands: ['red', 'green', 'blue'], min: 0, max: 0.3};

var cloudmask_composite = image.median();
Map.addLayer(cloudmask_composite.clip(roi), {bands: ['red', 'green', 'blue'], min: 0, max: 0.3}, 's2 image composite-median');

var s2final = ee.Image(cloudmask_composite);


// Purposefully chose area with less clouds after investigation, so dry season = July month 
// note that this is also the period when deforestations are at their highest
//Note that west coast (ROI) is drier than East coast so cloud cover may be lower

/////CLASSIFICATION////

// Make a FeatureCollection from the hand-made geometries.
//First need to make them variables so as not to do a collection of collection (I think?)
// Manually created polygons.

var polygons = ee.FeatureCollection([
  ee.Feature(Water),
  ee.Feature(Urban),
  ee.Feature(Agriculture),
  ee.Feature(Aquaculture),
  ee.Feature(Mangrove),
  ee.Feature(BareGround)
]).flatten()



// Get the values for all pixels in each polygon in the training.
var training = s2final.sampleRegions({
  // Get the sample from the polygons FeatureCollection.
  collection: polygons,
  // Keep this list of properties from the polygons. 
  //Class column was made from QGIS w/ 0 attribute to all components of mangrove, 1 to all polygons in aquaculture etc
  properties: ['Class'],
  // Set the scale to get Sentinel pixels in the polygons.
  scale: 20
});


// Create the classifier
var classifier = ee.Classifier.smileRandomForest(10)
 .train({
      features: training, 
      classProperty: 'Class', 
      inputProperties: bands
});



// Classify the input imagery
var classified = s2final.classify(classifier,'classification');


// Create a palette to display the classes
var palette =['52F19C',//Mangrove (green)
              '5274F1',//Aquaculture(dark blue)
              'B98F4F',//Agriculture(brown)
              'FCFF8B',//Urban (yellow)
              'D7E9F3',//Water (blue)
              'F8F5F0',// Bare Ground(white)
];

// Display the classified map
Map.addLayer(classified, {min: 0, max: 5, palette: palette}, 'Classified');
