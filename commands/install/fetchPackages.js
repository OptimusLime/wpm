var fs = require('fs-extra');
var gConfig = require('../../config.js');
var gCache = require('../../utils/cache.js');
var qUtils = require('../../utils/qUtils.js');
var Q = require('q');

module.exports = fetchPackages;

function fetchPackages(allModuleInformation)
{

	//we have actual objects to install now

	//we need to make a fetch for the objects
	//get our repository, now let's make a fetch all together


	// console.log("All Modules Info: ", allModuleInformation);

	try
	{
	//going to fetch each module from it's repo manager
	var moduleFetchPromises = [];

	for(var i=0; i < allModuleInformation.length; i++)
	{
		//Call the cache to fetch all objects 
		moduleFetchPromises.push(gCache.downloadModule(allModuleInformation[i]));
	}
	// console.log("Fetch reqs: ".green,moduleFetchPromises);

	//if we don't have any modules, we shouldn't be fetching
	if(moduleFetchPromises.length ==0)
		return Q(moduleFetchPromises);
	else
		return Q.all(moduleFetchPromises);
	}
	catch(e)
	{
		console.log(e);
	}
}
