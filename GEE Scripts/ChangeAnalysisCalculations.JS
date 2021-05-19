
//// Adding Sentinel 1 Base Imagery /////


var year = '2020';
var startDate = '2020-01-01';
var endDate = '2020-07-28';



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

// Adding Sentinel 2 Base imagery///

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



// Map.addLayer(contemporary,{palette:'#300051'},'2020 base map');
////////// Calculate area by class//////////
var names = ['0 mangrove', '1 aquaculture', '2 agriculture', '3 urban', '4 water','5 bare ground','6 other forest'];
var count = historic.eq([0, 1, 2, 3, 4, 5, 6]).rename(names);
var total = count.multiply(ee.Image.pixelArea());
var area = total.reduceRegion(ee.Reducer.sum(),roi, 30,null, null, false,1e13);
print('Area by class (m2)', area);


// create feature class
var areaSize = ee.Feature(null,area);

// export data 
Export.table.toDrive({
  collection: ee.FeatureCollection([areaSize]),
  description: 'Area 2000s',
  fileFormat: 'CSV'
});


//// Gain Calculations////

// Define the layers of interest
  // Contemporary


var cont_view = true;
var hist_view = false;


var cont_res = contemporary;
var mid_res= mid;
var hist_res = historic;
  

// Redefine the ROI
var ROI_dis = roi; 

// Define the layers of interest
  // Contemporary
  if(cont_view === true){ 
    var class_res = cont_res;
    }
  if( hist_view === true){ 
    var class_res = hist_res;
    }

// Contemporary. mangrove
var cmang = cont_res.eq(0).clip(roi);
var midmang= mid_res.eq(0).clip(roi);
var hmang = hist_res.eq(0).clip(roi);

// Aquaculture
var caqua = cont_res.eq(1).clip(roi);
var midaqua= mid_res.eq(1).clip(roi);
var haqua = hist_res.eq(1).clip(roi);

//Agriculture//
var cagri = cont_res.eq(2).clip(roi);
var midagri= mid_res.eq(2).clip(roi);
var hagri = hist_res.eq(2).clip(roi);

//Urban//
var curb = cont_res.eq(3).clip(roi);
var midurb= mid_res.eq(3).clip(roi);
var hurb = hist_res.eq(3).clip(roi);

///Natural factors///

//Water//
var cwat = cont_res.eq(4).clip(roi);
var midwat= mid_res.eq(4).clip(roi);
var hwat = hist_res.eq(4).clip(roi);


// Bare Ground // Just to see if they are just cut down without replacement
var cbg = cont_res.eq(5).clip(roi);
var midbg= mid_res.eq(5).clip(roi);
var hbg = hist_res.eq(5).clip(roi);

//OtherForest// 
//often get mistaken in classifications with mangroves depending on season,other trees not so likely to be where mangroves are due to harsh conditions///

var cof = cont_res.eq(6).clip(roi);
var midof= mid_res.eq(6).clip(roi);
var hof = hist_res.eq(6).clip(roi);



//// NOW BETWEEN 1980s and 2000s///


//// Gain Calculations////

// Define the layers of interest
  // Mid as 2000s


var mid_view = true;
var hist_view = false;


var mid_res = mid;
var hist_res = historic;
  

// Redefine the ROI
var ROI_dis = roi; 

// Define the layers of interest
  // Contemporary
  if(mid_view === true){ 
    var class_res = cont_res;
    }
  if( hist_view === true){ 
    var class_res = hist_res;
    }


////// MANGROVE GAINS ///////
var mang_gain = cmang.subtract(hmang).eq(1).selfMask();
Map.addLayer(mang_gain.clip(roi), {palette: '#ffdc0b'}, 'gain');

var area_gain = ee.Image.pixelArea().updateMask(mang_gain);
var gain = area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove gain: ', ee.Number(gain.get('area')).divide(1e6));      

///// GAINS BETWEEN 1980s and 2000s ////

var mang_mid_gain = midmang.subtract(hmang).eq(1).selfMask();
Map.addLayer(mang_mid_gain.clip(roi), {palette:'#916800'} ,'gain');

var area_mid_gain = ee.Image.pixelArea().updateMask(mang_mid_gain);
var gain_mid = area_mid_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove gain: 1980s-2000s ', ee.Number(gain_mid.get('area')).divide(1e6));      

//////GAIN BETWEEN 2000s and 2020 ///

var mang_2020_gain = cmang.subtract(midmang).eq(1).selfMask();
Map.addLayer(mang_2020_gain.clip(roi), {palette:'#916800'} ,'gain 2000-2020');

var area_2020_gain = ee.Image.pixelArea().updateMask(mang_2020_gain);
var gain_2020 = area_2020_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove gain: 1980s-2000s ', ee.Number(gain_2020.get('area')).divide(1e6));      



///// LOSS //////

// Loss Mangroves ////
var mang_loss = hmang.subtract(cmang).eq(1).selfMask();
Map.addLayer(mang_loss.clip(roi), {palette:'#ff9020'}, 'loss');
var area_loss = ee.Image.pixelArea().updateMask(mang_loss);
var loss = area_loss.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove loss: 1980s-2000s ', ee.Number(loss.get('area')).divide(1e6));

//// LOSS BETWEEN 1980s-2000s ///


var mang_mid_loss = midmang.subtract(cmang).eq(1).selfMask();
Map.addLayer(mang_mid_loss.clip(roi), {palette:'#ff9020'}, 'loss');
var area_mid_loss = ee.Image.pixelArea().updateMask(mang_loss);
var loss_mid = area_mid_loss.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove loss: 1980s-2000s', ee.Number(loss_mid.get('area')).divide(1e6));


//// LOSS BETWEEN 2000s-2020 ///


var mang_2020_loss = midmang.subtract(cmang).eq(1).selfMask();
Map.addLayer(mang_2020_loss.clip(roi), {palette:'#ff9020'}, 'loss of mangroves 2000s-2020');
var area_2020_loss = ee.Image.pixelArea().updateMask(mang_2020_loss);
var loss_2020 = area_2020_loss.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove loss: 2000s-2020', ee.Number(loss_2020.get('area')).divide(1e6));



////// MANGROVE PERSISTENCE ////


var mangper = hmang.eq(1).and(cmang.eq(1)).selfMask();
Map.addLayer(mangper.clip(roi), {palette: '#00a164'}, 'persistence');
var area_per = ee.Image.pixelArea().updateMask(mangper);
var per = area_per.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove persistence : ', ee.Number(per.get('area')).divide(1e6));


var palette =[
              '#00a164',//persistence (green)
              '#ffdc0b' ,//Gains (yellow)
              '#ff9020',//Losses (orange)
];


var mangrove_change=mangper.addBands(mang_loss).addBands(mang_gain);

Map.addLayer(mangrove_change,{}, "mangrove changes");


/// 1980s-2000s//// 

var mang_mid_per = midmang.eq(1).and(hmang.eq(1)).selfMask();
Map.addLayer(mang_mid_per.clip(roi), {palette: '#00a164'}, 'persistence');
var area_mid_per = ee.Image.pixelArea().updateMask(mang_mid_per);
var per_mid = area_mid_per.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove persistence 1980s-2000s: ', ee.Number(per_mid.get('area')).divide(1e6));


var palette =[
              '#00a164',//persistence (green)
              '#ffdc0b' ,//Gains (yellow)
              '#ff9020',//Losses (orange)
];

//// PERISTANCE 2000s-2020 //// 

var mang_2020_per = midmang.eq(1).and(cmang.eq(1)).selfMask();
Map.addLayer(mang_2020_per.clip(roi), {palette: '#00a164'}, 'persistence 2000s-2020');
var area_2020_per = ee.Image.pixelArea().updateMask(mang_2020_per);
var per_2020 = area_2020_per.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Mangrove persistence 2000s-2020: ', ee.Number(per_2020.get('area')).divide(1e6));



///// IMPACT OF LAND COVERS ON MANGROVE LOSSES/////


//GAINS between 1980s and 2020///



/// Aquaculture TOTAL GAINS///
//Seeing if historic mangroves have been replaced by aquaculture pixels//


var Aqua_gain = caqua.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Aqua_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of aqua over mangroves');

var AquaArea_gain = ee.Image.pixelArea().updateMask(Aqua_gain);
var Aquagain = AquaArea_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Aquaculture gain over mangroves: 2020', ee.Number(Aquagain.get('area')).divide(1e6));      

// 218.266 km2 of mangrove pixels replaced by aquaculture



///GAINS IN 80s//// 


var Aqua_1980_gain = haqua.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Aqua_1980_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of aqua over mangroves in 1980s');

var Aqua_1980_Area_gain = ee.Image.pixelArea().updateMask(Aqua_1980_gain);
var Aqua1980gain = Aqua_1980_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Aquaculture gain over mangroves: 1980s ', ee.Number(Aqua1980gain.get('area')).divide(1e6));      




///GAINS IN 2000s//// 
//out of the overall losses, investigates which have occured in aquaculture in each time period//


var Aqua_mid_gain = midaqua.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Aqua_mid_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of aqua over mangroves 2000s');

var Aqua_mid_Area_gain = ee.Image.pixelArea().updateMask(Aqua_mid_gain);
var Aquamidgain = Aqua_mid_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Aquaculture gain over mangroves: 2000s ', ee.Number(Aquamidgain.get('area')).divide(1e6));      


/// GAINS IN 2020/// 



var Aqua_2020_gain = caqua.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Aqua_2020_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of aqua over mangroves in 2020');

var Aqua_2020_Area_gain = ee.Image.pixelArea().updateMask(Aqua_2020_gain);
var Aqua2020gain = Aqua_2020_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Aquaculture gain over mangroves: 2020 ', ee.Number(Aqua2020gain.get('area')).divide(1e6));      






/// AGRICULTURE///

////TOTAL///


var Agri_gain = cagri.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Agri_gain.clip(roi), {palette: '#176705'}, 'Agriculture gain over mangroves');

var AgriArea_gain = ee.Image.pixelArea().updateMask(Agri_gain);
var Agrigain = AgriArea_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Agriculture gain over mangroves: 2020 ', ee.Number(Agrigain.get('area')).divide(1e6));      

////1980s///


var Agri_1980_gain = hagri.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Agri_1980_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of agric over mangroves 1980');

var Agri_1980_Area_gain = ee.Image.pixelArea().updateMask(Agri_1980_gain);
var Agri1980gain = Agri_1980_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Agricukture gain over mangroves:1980s ', ee.Number(Agri1980gain.get('area')).divide(1e6));      





/// 2000s///


var Agri_mid_gain = midagri.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Agri_mid_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of agri over mangroves 2000s');

var Agri_mid_Area_gain = ee.Image.pixelArea().updateMask(Agri_mid_gain);
var Agrimidgain = Agri_mid_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Agricukture gain over mangroves:2000s ', ee.Number(Agrimidgain.get('area')).divide(1e6));      


////2020//// 



var Agri_2020_gain = cagri.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Agri_2020_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of aqua over mangroves 2020');

var Agri_2020_Area_gain = ee.Image.pixelArea().updateMask(Agri_2020_gain);
var Agri2020gain = Agri_2020_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Agricukture gain over mangroves:2020 ', ee.Number(Agri2020gain.get('area')).divide(1e6));      





////// URBAN //////

//// 2020/// 
var urban_gain = curb.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(urban_gain.clip(roi), {palette: '#7000a5'}, 'gain of urban over mangroves 2020');

var urb_gain = ee.Image.pixelArea().updateMask(urban_gain);
var Urbangain = urb_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Urban gain: ', ee.Number(Urbangain.get('area')).divide(1e6));      

////2000s///


var Urb_mid_gain = midurb.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Urb_mid_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of urban over mangroves 2000s');

var Urban_mid_Area_gain = ee.Image.pixelArea().updateMask(Urb_mid_gain);
var Urbanmidgain = Urban_mid_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of urban gain over mangroves: 2000s', ee.Number(Urbanmidgain.get('area')).divide(1e6));      

//// 1980s//// 


var Urb_1980_gain = hurb.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Urb_1980_gain.clip(roi), {palette: '#b3cde0'}, 'Gain of urban over mangroves 1980s');

var Urban_1980_Area_gain = ee.Image.pixelArea().updateMask(Urb_1980_gain);
var Urban1980gain = Urban_1980_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of urban gain over mangroves: 1980s', ee.Number(Urban1980gain.get('area')).divide(1e6));      







/// Non-Anthropohenic / NATURAL  sources of mangrove losses ///
//Water// 
//Sea-level rise??//


//// 2020//// 



var Wat_2020_gain = cwat.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Wat_2020_gain.clip(roi), {palette: '#b3cde0'}, 'Gain of water over mangroves 2020');

var Water_2020_Area_gain = ee.Image.pixelArea().updateMask(Wat_2020_gain);
var Water2020gain = Water_2020_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Water gain over mangroves:2020 ', ee.Number(Water2020gain.get('area')).divide(1e6));      





////2000s/// 



var Wat_mid_gain = midwat.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Urb_mid_gain.clip(roi), {palette: '#b3cde0'}, 'Edit: gain of urban over mangroves 2000s');

var Water_mid_Area_gain = ee.Image.pixelArea().updateMask(Wat_mid_gain);
var Watermidgain = Water_mid_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });

print('(Area(km²) of Water gain over mangroves: 2000s', ee.Number(Watermidgain.get('area')).divide(1e6));      

//// 1980s//// 
//// 1980s///



var Wat_1980s_gain = hwat.selfMask().multiply(mang_loss.selfMask()); ///conting areas of mangroves replaced by aquaculture
Map.addLayer(Wat_1980s_gain.clip(roi), {palette: '#b3cde0'}, 'Gain of water over mangroves 1980s');

var Urban_1980_Area_gain = ee.Image.pixelArea().updateMask(Wat_1980s_gain);
var Urban1980gain = Urban_1980_Area_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('(Area(km²) of Water gain over mangroves:1980s ', ee.Number(Urban1980gain.get('area')).divide(1e6));      



/// Bare Ground//
// Landward migration? or unreplaced deforestation ///


///2020/// 
var bg_gain = cbg.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(bg_gain.clip(roi), {palette: '#f6e8ba'}, 'gain of bare ground over mangroves');

var bgd_gain = ee.Image.pixelArea().updateMask(bg_gain);
var Bgdgain = bgd_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Bare Ground gain 2020: ', ee.Number(Bgdgain.get('area')).divide(1e6));      


////2000s ///

var bg_mid_gain = midbg.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(bg_mid_gain.clip(roi), {palette: '#00b8ff'}, 'gain of bg over mangroves 2000s');

var bg_mid_gain = ee.Image.pixelArea().updateMask(bg_mid_gain);
var Bgmidgain = bg_mid_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of BG gain: 2000s', ee.Number(Bgmidgain.get('area')).divide(1e6));      

//// 1980s///


var bg_1980_gain = hbg.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(bg_1980_gain.clip(roi), {palette: '#00b8ff'}, 'gain of bg over mangroves 1980s');

var bg_1980_gain = ee.Image.pixelArea().updateMask(bg_1980_gain);
var Bg1980gain = bg_1980_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of BG gain: 1980s', ee.Number(Bg1980gain.get('area')).divide(1e6));      





// OTHER FOREST types (terra firme)//


var of_gain = cof.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(of_gain.clip(roi), {palette: '#11d000'}, 'gain of other forests over mangroves');

var oft_gain = ee.Image.pixelArea().updateMask(of_gain);
var Oftgain = oft_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of Other forest gain: ', ee.Number(Oftgain.get('area')).divide(1e6));      


//// 1980s-2000s ///

var of_mid_gain = midof.selfMask().multiply(mang_loss.selfMask());
Map.addLayer(of_mid_gain.clip(roi), {palette: '#00b8ff'}, 'gain of of over mangroves 1980s');

var OF_mid_gain = ee.Image.pixelArea().updateMask(of_mid_gain);
var Ofmidgain = OF_mid_gain.reduceRegion({
                                     reducer: ee.Reducer.sum(),
                                     geometry: roi, 
                                     scale: 30,
                                     maxPixels: 1e13,
                                     bestEffort: true
                                     });
print('Area(km²) of OF gain: 2000s', ee.Number(Ofmidgain.get('area')).divide(1e6));      







