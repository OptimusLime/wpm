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

	//TODO: This has got to change. This shouldn't be in a repository specific location
	self.getInstallDirectory = function(currentDirectory, downloadInfo)
	{
		// console.log("Getinstall dl".cyan, downloadInfo)
		return path.resolve(currentDirectory + "/win_modules/" + downloadInfo.moduleInfo.userName + "-" + downloadInfo.moduleInfo.packageName);
	}

	self.installCount = 0;


	var activeFullInstalls = {};
	self.activeInstallName = function(packageInfo)
	{
		return packageInfo.repoName + "/" + packageInfo.userName +  "/" + packageInfo.packageName +  "/" + packageInfo.packageVersion;
	}
	self.removeActive = function(packInfo)
	{
		if(packInfo)
		{
			var iName = self.activeInstallName(packInfo);
			delete activeFullInstalls[iName];
		}
	}

	self.fullyInstallModule = function(currentDirectory, processArgs)
	{
		var parentPackageInfo, manualInstall;
		if(typeof processArgs == "object" && processArgs.packageName)
		{
			parentPackageInfo = processArgs;
		}
		else if(processArgs && processArgs.length)
		{
			manualInstall = processArgs;
		}

		self.installCount++;
		if(self.installCount > 4)
			throw new Error("Install count too high for testing");

		//what exactly are we installing
		console.log('Full install in : '.magenta + currentDirectory.magenta, "To Process: ", processArgs);

		var installDefer = Q.defer();
		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; installDefer.reject.apply(installDefer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; installDefer.resolve.apply(installDefer, arguments);} };

		//if we have infomration about the previous call, we let it be known we're actively installing this object
		if(parentPackageInfo)
		{

			var iName = self.activeInstallName(parentPackageInfo);
			console.log('\t Active now: '.red, activeFullInstalls);
			if(activeFullInstalls[iName])
			{
				//this is a loop! We're actively trying to install something we're currently attempting to install!
				console.log('Infinite dependency loop: '.red, parentPackageInfo);
				process.nextTick(function()
				{
					reject({error: "Infinite chain of dependencies."});
				
				});

				return installDefer.promise;
				
			}
			else
				activeFullInstalls[iName] = parentPackageInfo;
		}


		qGrabInitial(currentDirectory, processArgs)
			.then(function(initialPackageList)
			{
				//we've reached an initial package list
				//now we have some recursion to be done

				// console.log("Init packages: ", initialPackageList);
				if(initialPackageList.length == 0)
				{
					console.log('No packages to install: '.cyan, processArgs)
					//we're done -- nothing to install
					skipRemainingSteps = true;
					self.removeActive(parentPackageInfo);
					success({success: true, message: "No module dependencies to install. Installation finished.".cyan});
					return;
				}

				var pFetchInformation, eInformation;

				//now we need to fetch those modules
				return fetchPackages(initialPackageList)
					.then(function(packageFetch)
					{	
						// console.log('\t Packages fetched you see.'.cyan, packageFetch);
						console.log("Pack fetch: ", packageFetch);

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
						return Q.allSettled(extractPromises)
							.then(function(state)
								{
									var allReturned = [];
									for(var i=0; i < state.length; i++)
									{
										if(state[i].state == "rejected"){
											throw new Error(state[i].reason);
											return;
										}
										allReturned.push(state[i].value);
									}
									//send em all back please
									return allReturned;
								}, function(err)
								{
									throw err;
								});	
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
							//console.log("Extracted: ", extracted);
							//now we can fully install each piece -- but we want our flow library to only go one at a time
							console.log('Where to execute full install: ', extracted.extractDirectory);
							fullInstallPromises.push(repoInstallManager.fullyInstallModule(extracted.extractDirectory, initialInfo));
						}
						//one at a time for flow control
						// var result = defer.promise;
						// fullInstallPromises.forEach(function (f) {
						//     result = result.then(f);
						// });
						// // console.log('It'.rainbow);
						// return result;

						return Q.allSettled(fullInstallPromises)
							.then(function(state)
								{
									var allReturned = [];
									for(var i=0; i < state.length; i++)
									{
										if(state[i].state == "rejected"){
											throw new Error(state[i].reason);
											return;
										}
										allReturned.push(state[i].value);
									}
									//send em all back please
									return allReturned;
								}, function(err)
								{
									throw err;
								});	
					})
					.then(function()
					{
						console.log('Finished installing in '.green + currentDirectory, 
							(parentPackageInfo ? ' with parent: ' : ''), (parentPackageInfo ? parentPackageInfo : ""));
						//done fetching for this module!
						self.removeActive(parentPackageInfo);
						//once we're finished, we can return, and the next object can happen 
						success({success:true, message: "Module Installation success.".green });
						//errors will be caught by the larger q function
					})
					.fail(function(err){ throw err;});

			})
			.fail(function(err)
			{
				reject(err);
				return;
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

		console.log("\nExtract Module: ", downloadInfo.moduleInfo, "\n to: ", rootDirectory + "\n");

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
