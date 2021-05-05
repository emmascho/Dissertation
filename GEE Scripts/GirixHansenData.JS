var mangrove = ee.ImageCollection("LANDSAT/MANGROVE_FORESTS");
var hansen = ee.Image("UMD/hansen/global_forest_change_2019_v1_7"); // Forest loss 30m pixels - yearly
var hansen19 = hansen.select(['loss','lossyear', 'gain']);

// Load country boundaries from LSIB.
var countries = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017');
// Get a feature collection with just the Madagascar feature.
var madagascar = countries.filter(ee.Filter.eq('country_na', 'Madagascar'));

//Add Giri layer for mangrove extent 
Map.addLayer(
  mangrove, 
  {palette:'#7E4F9E'}, 
  'Madagascar mangrove extent');

//‘mask’ the two datasets, keeps only pixels at the intersection of two images.
var HansenMangrove = mangrove.first().selfMask().multiply(hansen19.selfMask()); //find common areas between Mangrove and Hansen, keeping the Mangrove band

// Create variables for forest gain and loss
var gain = HansenMangrove.select(['gain']);
var loss= HansenMangrove.select(['loss']);
var lossYear = HansenMangrove.select(['lossyear']); //variable for loss by year


Map.centerObject(point, 13);

// Add the loss layer in yellow.
Map.addLayer(loss.updateMask(loss),
            {palette: ['#F5E627']}, 'Loss');

// Add the gain layer in blue. This is barely apparent (sadly)
Map.addLayer(gain.updateMask(gain),
            {palette: ['#5AE3B5']}, 'Gain');
            


// Calculating overall GAINS and LOSSES per year (gains not done since they are not per year)

var lossAreaImage = loss.multiply(ee.Image.pixelArea());

              
//groups creates a nested list of yearly forest loss area
var lossByYear = lossAreaImage.addBands(lossYear).reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1
    }),
  geometry: madagascar,
  scale: 30,
  maxPixels: 1e13
});
print(lossByYear);

//Changing output to match in years
var statsFormatted = ee.List(lossByYear.get('groups'))
  .map(function(el) {
    var d = ee.Dictionary(el);
    return [ee.Number(d.get('group')).format("20%02d"), d.get('sum')];
  });
var statsDictionary = ee.Dictionary(statsFormatted.flatten());
print(statsDictionary);

//making a simple bar chart of 
var chart = ui.Chart.array.values({
  array: statsDictionary.values(),
  axis: 0,
  xLabels: statsDictionary.keys()
}).setChartType('ColumnChart')
  .setOptions({
    title: 'Yearly Mangrove Loss',
    hAxis: {title: 'Year', format: '####'},
    vAxis: {title: 'Area (square meters)'},
    legend: { position: "none" },
    lineWidth: 1,
    pointSize: 3
  });
print(chart);
