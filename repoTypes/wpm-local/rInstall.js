var gConfig = require('../../config.js');
var gCache = require('../../utils/cache.js');
var fstream = require('fstream');
var request = require('request');
var Q = require('q');
var path = require('path');

var serverModuleBase = "/packages";
var serverInfoBase = "/packageInfo";

var readPackage = require('../../commands/install/readPackage.js');
var fetchPackages = require('../../commands/install/fetchPackages.js');


function WPMLocalInstall()
{
	var self = this;
		
	var qGrabInitial = function(rootDirectory, processArgs)
	{
		var defer = Q.defer();
		var reject = function() { defer.reject.apply(defer, arguments); };
		var success = function() { defer.resolve.apply(defer, arguments); };

		processArgs = processArgs || [];


		if(processArgs.length > 1)
		{
			//the packge list for this call
			var packageList = [];

			//process the args passed in to node -- using the default repo -- can modify with option later todo
			for(var i=0; i < processArgs.length -1; i++)
				packageList.push({name: processArgs[i], version : "*"});

			//need to clean up and convert to some usable form
			var cleanList = gConfig.cleanPackageLists(packageList);

			//easy to pull the packages from here! Send it forth...
			success(cleanList);
		}
		else
		{
			//read package, passing success/failure
			readPackage(rootDirectory)
				.done(success, reject);
		}

		return defer.promise;
	}

	self.getInstallDirectory = function(currentDirectory, downloadInfo)
	{
		return currentDirectory + "/win_modules";
	}

	self.fullyInstallModule = function(currentDirectory, processArgs)
	{

		var installDefer = Q.defer();
		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; installDefer.reject.apply(installDefer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; installDefer.resolve.apply(installDefer, arguments);} };


		qGrabInitial(currentDirectory, processArgs)
			.then(function(initialPackageList)
			{
				//we've reached an initial package list
				//now we have some recursion to be done

				console.log("Init packages: ", initialPackageList);

				if(initialPackageList.length == 0)
				{
					//we're done -- nothing to install
					skipRemainingSteps = true;
					return {success: true, message: "No module dependencies to install. Installation finished.".cyan};
				}

				var pFetchInformation, eInformation;


				//now we need to fetch those modules
				fetchPackages(initialPackageList)
					.then(function(packageFetch)
					{	
						console.log('\t Packages fetched you see.'.cyan, packageFetch);

						//make it accessible in other methods
						pFetchInformation = packageFetch;

						//we have all information about what was fetched
						var extractPromises = [];

						//check for parameter files
						for(var i=0; i < pFetchInformation.length; i++)
						{
							//all fetch info -- should have parameters JSON object
							var fetch = pFetchInformation[i];
							var initialInfo = initialPackageList[i];

							var repoName = initialInfo.repoName;
							//grab the full repo object -- we need to offload to the repo type
							var fRepo = gConfig.getRepository(repoName);

							//
							var repoInstallManager = require('../../repoTypes/' + fRepo.type + '/rInstall.js');

							//where shall we install this object?
							var installLocation = repoInstallManager.getInstallDirectory(currentDirectory, fetch);

							//push the promise to the end of our array
							extractPromises.push(repoInstallManager.extractModuleToDirectory(installLocation, fetch));

						}

						//Extract all our objects
						return Q.all(extractPromises);
					})
					.then(function(extractReturns)
					{
						eInformation = extractReturns;

						var defer = Q.defer();

						//now we've extracted, so we must fully install each one
						var fullInstallPromises = [];

						for(var i=0; i < eInformation.length; i++)
						{
							var fetch = pFetchInformation[i];
							var initialInfo = initialPackageList[i];
							var extracted = eInformation[i];

							//grab the full repo object -- we need to offload to the install manager
							var repoName = initialInfo.repoName;
							var fRepo = gConfig.getRepository(repoName);
							var repoInstallManager = require('../../repoTypes/' + fRepo.type + '/rInstall.js');
							console.log("Extracted: ", extracted);
							//now we can fully install each piece -- but we want our flow library to only go one at a time
							fullInstallPromises.push(repoInstallManager.fullyInstallModule(extracted.extractDirectory));
						}

						//one at a time for flow control
						var result = defer.promise;
						fullInstallPromises.forEach(function (f) {
						    result = result.then(f);
						});
						return result;
					})
					.done(function()
					{
						//once we're finished, we can return, and the next object can happen 
						success({success:true});
						//errors will be caught by the larger q function
					})
					.fail(function(err){ console.log('Fetch err.'); throw err;});

			})

		return installDefer.promise;
	}


	//Given a directory, and the download information, install the module
	self.extractModuleToDirectory = function(rootDirectory, downloadInfo)
	{
		//Promise to return an installed module
		var defer = Q.defer();

		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; defer.reject.apply(defer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; defer.resolve.apply(defer, arguments);} };

		console.log("Extract Module: ", rootDirectory, downloadInfo);

		//goign to untar our object to the given directory
		var parameters = downloadInfo.parameters;

		//where is the tar object???
		var tarLocation = downloadInfo.tarball;

		//let's untar the tar into our install directory
		gCache.qUntar(tarLocation, rootDirectory)
			.done(function(installedLocation)
			{
				//finished untarring the object, is there anything left to do, really?
				success({success:true, extractDirectory: rootDirectory, extractInformation: downloadInfo});

			}, reject);		

		return defer.promise;

	}

	return self;
}

//export a single instance (require should cache this one object)

module.exports = WPMLocalInstall();
