var fs = require('fs-extra');
var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var Q = require('q');
var semver = require('semver');
var path = require('path');
module.exports = initialModules;


var versionFromString = function(vString)
{
	return	(vString == "*" || vString == "latest") ? "*" : semver.clean(dependencies[key]);
}


function initialModules(installArgs)
{
	//we need to parse out appropriate information

	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	//let's parse the install args to find out what we're attempting to install
	// console.log("Args: ", installArgs);

	var options = arguments[arguments.length -1] || {};

	var packageList = [];


	if(installArgs.length > 1)
	{
		for(var i=0; i < installArgs.length -1; i++)
			packageList.push({name: installArgs[i], version : "*"});

		//easy to pull the packages from here! Send it forth...
		success(packageList);
	}
	else
	{
		//we have to potentially pull from a local win.json file

		var commandDir = process.cwd();
		var packFileName = gConfig.packageName();

		//we have what we need, let's try and get our property file
		qUtils.qReadJSON(path.resolve(commandDir, "./" + packFileName))
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

				//we have to install things! Send them along.
				//don't worry about
				success(packageList);
			}, 
			function(err)
			{
				//couldn't find the file, we're done here!
				reject({error: "\t No " + packFileName + " file present for install.".red});
			})
	}

	return defer.promise;
}
