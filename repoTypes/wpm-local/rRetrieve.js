var gConfig = require('../../config.js');
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
	self.getFullModule = function(baseURL, moduleInfo)
	{
		var defer = Q.defer();

		var singleCall = false;
		var reject = function() { if(!singleCall) { singleCall = true; defer.reject.apply(defer, arguments); } };
		var success = function() {  if(!singleCall) { singleCall  = true; defer.resolve.apply(defer, arguments);} };
		
		//first check if we've already grabbed this particular object
		console.log("Minfo: ",moduleInfo);

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

		var tarWriter, tRequest;

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
				success({success:true});
			}			
		}


		//ready to make some get requests to the server
		tRequest = request.get(getTarBase);

		//if the server response comes back anything other than 200, we've failed :(
		tRequest.on('response', function(res)
		{
			//uh oh-- not two hundy --erorrrrorororor
			if(res.statusCode != 200)
			{
				//tRequest.end();
				// tarWriter.emit("error", {error: "Tarball Request failed!"});
				tRequest.end();
				tRequest.emit("error", {error: "Tarball Request failed!"});
				tarWriter.end();
				//reject({error: "Tarball Request failed!"});
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

			//finished writing the tarball to the temporary location
			console.log('\t Finished writing tarball to temporary'.cyan);		

			//finish teh module install here (we've written to file)
			finishModuleInstall();
			//hack to end prematurely
			finishModuleInstall();

		})

		tRequest.pipe(tarWriter);
	
		return defer.promise;
	}


	return self;
}

//export a single instance (require should cache this one object)

module.exports = WPMLocalRetrieve();
