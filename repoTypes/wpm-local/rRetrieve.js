var gConfig = require('../../config.js');
var gCache = require('../../utils/cache.js');
var fstream = require('fstream');
var request = require('request');
var Q = require('q');
var path = require('path');

var serverModuleBase = "/packages";
var serverInfoBase = "/packageInfo";

function WPMLocalRetrieve()
{
	var self = this;


	self.getFullModules = function(baseURL, allModuleInfo)
	{
		var promises = [];

		//loop through all the gets, and promise they will be done!
		for(var i=0; i < allModuleInfo.length; i++)
		{
			promises.push(self.getFullModule(baseURL, allModuleInfo[i]));
		}		

		//return when all have finished fetching
		return Q.all(promises);
	}

	//this will retrieve all necessary information for a particular module
	//this includes a tarball, and the properties object (two get requests)
	self.getFullModuleOld = function(baseURL, moduleInfo)
	{
		var defer = Q.defer();

		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; defer.reject.apply(defer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; defer.resolve.apply(defer, arguments);} };
		
		//first check if we've already grabbed this particular object

		var pLocation = gConfig.getPackageLocation(moduleInfo);
		var cacheFileName = moduleInfo.packageName + (moduleInfo.packageVersion == "*" ? "" : "@" + moduleInfo.packageVersion) + ".tar.gz";

		if(!pLocation)
		{
			var tmpCache = gConfig.getTempDirectory();
			pLocation = {directory: tmpCache, file: cacheFileName};

			//pass new info--
			//now we have a package location -- we'll save it 			
			gConfig.setPackageLocation(moduleInfo, pLocation);
		}

		//create our files to write, we need two
		var getTarBase = baseURL + serverModuleBase + "/" + moduleInfo.userName + "/" + moduleInfo.packageName + "/" + moduleInfo.packageVersion;
		var getInfoBase = baseURL + serverInfoBase + "/" + moduleInfo.userName + "/" + moduleInfo.packageName + "/" + moduleInfo.packageVersion;

		var tarWriter, tRequest, infoRequest, packageParameters;

		var finished = false;

		var finishModuleInstall = function()
		{
			if(!finished)
			{
				finished = true;
			}
			else
			{
				//if we made it thus far with no error, we have succeeded in fetching information and tarball
				success({success:true, parameters: packageParameters});
			}			
		}
		var closeAllPipes = function(err)
		{
			tRequest.end();
			tRequest.emit("error", {error: err});
			// infoRequest.end();
			// infoRequest.emit("error", {error: "Info Request failed!"});
			tarWriter.end();
		}


		infoRequest = request.get(getInfoBase, function(err, response, body)
			{
				//the request is over
				if(err)
				{
					closeAllPipes("Info Request Error- " + err.toString());
					reject(err);
					return;
				}
				else if(response.statusCode != 200)
				{
					//this will throw an error on the other object
					closeAllPipes("Info Request failed: " + response.statusCode);
					//to be sure, we'll throw an error first anyways
					reject({success:false, error: "Information request was denied."});
					return;
				}
				else
				{
					packageParameters = JSON.parse(body);
					finishModuleInstall();
				}
			});




		//ready to make some get requests to the server
		tRequest = request.get(getTarBase);

		//if the server response comes back anything other than 200, we've failed :(
		tRequest.on('response', function(res)
		{
			//uh oh-- not two hundy --erorrrrorororor
			if(res.statusCode != 200)
			{
				//uh oh, error on the response, close everything up -- this will throw an error
				closeAllPipes("Tarball request failed!");
			}
		})
		
		//if we get any type of error in the response, reject immediately
		tRequest.on("error", reject);

		//open a file for writing 
		tarWriter = fstream.Writer({
			path: path.resolve(pLocation.directory, "./" + pLocation.file)
		});

		tarWriter.on("error", reject);

		//when finished, we must check for the other file being done as well
		tarWriter.on("close", function()
		{
			//if we didn't fail out already print this
			if(!singleCall)
			{
				//finished writing the tarball to the temporary location
				console.log('\t Finished writing tarball to temporary'.cyan);		
			}
			//finish teh module install here (we've written to file)
			finishModuleInstall();

		})

		tRequest.pipe(tarWriter);
	
		return defer.promise;
	}
	self.getFullModule = function(baseURL, directoryToSave, moduleInfo)
	{
		var defer = Q.defer();

		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; defer.reject.apply(defer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; defer.resolve.apply(defer, arguments);} };
		
		//first check if we've already grabbed this particular object

		var cacheFileName = moduleInfo.packageName + (moduleInfo.packageVersion == "*" ? "" : "@" + moduleInfo.packageVersion) + ".tar.gz";
		var fullSaveLocation = path.resolve(directoryToSave, "./" + cacheFileName)
		//create our files to write, we need two
		var getTarBase = baseURL + serverModuleBase + "/" + moduleInfo.userName + "/" + moduleInfo.packageName + "/" + moduleInfo.packageVersion;
		var getInfoBase = baseURL + serverInfoBase + "/" + moduleInfo.userName + "/" + moduleInfo.packageName + "/" + moduleInfo.packageVersion;

		var tarWriter, tRequest, infoRequest, packageParameters;

		var finished = false;

		var finishModuleInstall = function()
		{
			if(!finished)
			{
				finished = true;
			}
			else
			{
				//if we made it thus far with no error, we have succeeded in fetching information and tarball
				success({success:true, 
					parameters: packageParameters, 
					moduleInfo: moduleInfo, 
					tarball: fullSaveLocation, 
					saveDirectory: directoryToSave});
			}			
		}
		var closeAllPipes = function(err)
		{
			tRequest.end();
			tRequest.emit("error", {error: err});
			// infoRequest.end();
			// infoRequest.emit("error", {error: "Info Request failed!"});
			tarWriter.end();
		}


		infoRequest = request.get(getInfoBase, function(err, response, body)
			{
				//the request is over
				if(err)
				{
					closeAllPipes("Info Request Error- " + err.toString());
					reject(err);
					return;
				}
				else if(response.statusCode != 200)
				{
					//this will throw an error on the other object
					closeAllPipes("Info Request failed: " + response.statusCode);
					//to be sure, we'll throw an error first anyways
					reject({success:false, error: "Information request was denied."});
					return;
				}
				else
				{
					packageParameters = JSON.parse(body);
					finishModuleInstall();
				}
			});




		//ready to make some get requests to the server
		tRequest = request.get(getTarBase);

		//if the server response comes back anything other than 200, we've failed :(
		tRequest.on('response', function(res)
		{
			//uh oh-- not two hundy --erorrrrorororor
			if(res.statusCode != 200)
			{
				//uh oh, error on the response, close everything up -- this will throw an error
				closeAllPipes("Tarball request failed!");
			}
		})
		
		//if we get any type of error in the response, reject immediately
		tRequest.on("error", reject);

		//open a file for writing 
		tarWriter = fstream.Writer({
			path: fullSaveLocation
		});

		tarWriter.on("error", reject);

		//when finished, we must check for the other file being done as well
		tarWriter.on("close", function()
		{
			//if we didn't fail out already print this
			if(!singleCall)
			{
				//finished writing the tarball to the temporary location
				console.log('\t Finished writing tarball to temporary'.cyan);		
			}
			//finish teh module install here (we've written to file)
			finishModuleInstall();

		})

		tRequest.pipe(tarWriter);
	
		return defer.promise;
	}

	return self;
}

//export a single instance (require should cache this one object)

module.exports = WPMLocalRetrieve();
