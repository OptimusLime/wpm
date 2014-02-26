var fs = require('fs-extra');
var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var Q = require('q');

module.exports = startInstall;

var repo = gConfig.getCurrentRepository();
var baseURL = repo.url;
var repoType = repo.type;
var repoName = repo.name;

var repoManager = require('../../repoTypes/' + repoType + '/rRetrieve.js');


var extractPackageInformation = function(name)
{
	var split = name.split("/");
	console.log("Name: ", name, " split: ", split);

	if(split.length == 2)
	{
		return {userName: split[0], packageName: split[1]};
	}
	else if(split.length == 3)
	{
		return {repoName: split[0], userName: split[1], packageName: split[2]};
	}
	else
	{
		throw new Error("Impropper section package format." + name + " Number of sections != 2 or 3 -- it equals " + split.length)
	}
}

function startInstall(initialModules)
{
	//we need to parse out appropriate information

	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	console.log('Install module: ', initialModules);

	if(!initialModules.length)
	{
		//nothing to install
		success({count: initialModules.length});
	}
	else
	{
		//we have actual objects to install now

		//we need to make a fetch for the objects
		//get our repository, now let's make a fetch all together


		var allModuleInformation = [];

		for(var i=0; i < initialModules.length; i++)
		{
			var module = initialModules[i];

			var pInfo = extractPackageInformation(module.name);
			if(!pInfo.repoName)
				pInfo.repoName = repoName;

			//versioning info added to the extracted object
			pInfo.packageVersion = module.version;

			//ready to send for the package
			allModuleInformation.push(pInfo);

			//note that we have an object in motion -- and it's not the types responsibility to know that
			//though maybe it should be? Like a call and cleanup thing?
			gConfig.addActiveRetrieval(pInfo);
		}

		console.log("All Modules Info: ", allModuleInformation);

		repoManager.getFullModules(baseURL, allModuleInformation)
			.done(function(modules)
			{
				console.log('Modules after initial get: ', modules);
				for(var i=0; i < modules.length; i++)
				{
					if(!modules[i].success)
					{
						reject({error: modules[i].error});
					}
				}

				//pass on how many we fetched
				success({count: initialModules.length, modules: modules});

			}, function(err)
			{
				reject(err);
			})


		//reject({error: "No install routine"});
	}


	return defer.promise;
}
