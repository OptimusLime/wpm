var fs = require('fs-extra');
var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var Q = require('q');
var semver = require('semver');
var path = require('path');

module.exports = readPackageList;

var versionFromString = function(vString)
{
	return	(vString == "*" || vString == "latest") ? "*" : semver.clean(dependencies[key]);
}

//given a directory, tell me what win.json says about the directory
//success = list of dependencies
//failure = no file
function readPackageList(directory)
{
	//we need to parse out appropriate information
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	//let's parse the install args to find out what we're attempting to install
	// console.log("Args: ", installArgs);

	var options = arguments[arguments.length -1] || {};

	var packageList = [];

	//we have to potentially pull from a local win.json file
	var winJSONName = gConfig.packageName();

	//we have what we need, let's try and get our property file
	qUtils.qReadJSON(path.resolve(directory, "./" + winJSONName))
		.done(function(moduleProperties)
		{
			var dependencies = moduleProperties.dependencies;

			if(dependencies)
			{
				for(var key in dependencies){
					
					var version = versionFromString(dependencies[key]);
					if(!version)
						reject({error: "\t Improper version: " + " Key: " + key + " Version: " + dependencies[key]});

					packageList.push({name: key, version: version});
				}
			}

			var installDevs = options.development;
			var devDependencies = moduleProperties.devDependencies;
			if(installDevs && devDependencies)
			{					
				//add dev deps as well
				for(var key in devDependencies){

					var version = versionFromString(devDependencies[key]);
					if(!version)
						reject({error: "\t Improper dev version: " + " Key: " + key + " Version: "+ devDependencies[key]});

					packageList.push({name: key, version: version});
				}
			}

			var cleanList = gConfig.cleanPackageLists(packageList);

			//we have to install things! Send them along.
			//don't worry about
			success(cleanList);
		}, 
		function(err)
		{
			//couldn't find the file, we're done here!
			reject({error: "\t No " + winJSONName + " file present for install.".red});
		})

	return defer.promise;
}
