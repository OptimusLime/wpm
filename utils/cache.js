var fstream = require('fstream'),
	tar = require('tar'),
	zlib = require('zlib');

var cuid = require('cuid');
var path = require('path');

var gConfig = require('../config.js');

var Q = require('q');

//the cache handles loading and unloading tarballs and dependency chains

var globalCache = {};

module.exports = globalCache;

//I prefer to use Q for flow control
globalCache.qCreateTarball = function(dirPath, outFile, filter) {
	var defer = Q.defer();

	filter = filter || function() {
		return true;
	};

	// console.log('pull dir: ', dirPath);
	// console.log('Write to: ', outFile);

	//going to write out to a particular file
	var writer = fstream.Writer({
		'path': outFile
	});

	//ideally, we'd like to know when the deed is done
	writer.on("close", function() {
		//send back the outfile and any issues
		defer.resolve(outFile);
	});

	//catch writer errors
	writer.on("error", function(err) {
		defer.reject(err);
	});

	//catch abortions :/
	writer.on("abort", function(err) {
		defer.reject(err);
	});

	//we'll user to read through the directory
	//we don't want the top level object though, so we do a hack from github comments
	//https://github.com/isaacs/fstream/issues/9
	var reader = fstream.Reader({
		path : dirPath,
		type : 'Directory',
		filter: function()
		{
			//this is the piece that prevents top level folder from being included
			if(this.dirname == dirPath) {
                this.root = null;
            }

			return filter.apply(this, arguments);
		}
	});

	reader /* Read the source directory, filtering out some items */
		.pipe(tar.Pack()) /* Convert the directory to a .tar file */
		.pipe(zlib.Gzip()) /* Compress the .tar file */
		.pipe(writer); /* Give the output file name */

	return defer.promise;
};

globalCache.qUntar = function(incoming, tmpDirectory) {
	var defer = Q.defer();

	var reject = function() {
		defer.reject.apply(defer, arguments);
	};
	var success = function() {
		defer.resolve.apply(defer, arguments);
	};

	//going to write out to a particular directory
	var writer = tar.Extract({//fstream.Writer({
		path: tmpDirectory,
		type: 'Directory'
	});

	//ideally, we'd like to know when the deed is done
	writer.on("close", function() {
		//send back the out directory and any issues
		success(tmpDirectory);
	});

	//catch writer errors
	writer.on("error", reject);

	//catch abortions :/
	writer.on("abort", reject);

	// console.log("In file: ", incoming);

	var reader = fstream.Reader({
		path: incoming
	});
	//let's pull a file from the depths of hell
	reader
		.pipe(zlib.Gunzip())
		.pipe(writer);
		// .pipe(writer);

	return defer.promise;
};

/////////////////////////////////////////
//Handle downloading a bunch of modules, and cacheing them



var inflightRequests = {};
var completedRequests = {};

var moduleRequestName = function(rInfo)
{
	return rInfo.repoName + "/" + rInfo.userName + "/" + rInfo.packageName + "/" + rInfo.packageVersion;
}

globalCache.getTempDirectory = function() {

	return path.resolve(__dirname, "../cache/" + cuid());
}

var fullfillDownloadPromises = function(reqName, cbName)
{
	return function()
	{
		try{
		console.log("Download Finished check: ".magenta, reqName, cbName);
		//we'll fetch the inflight requests, and fullfil promises
		var ifRequest = inflightRequests[reqName];

		//but note that we were either successful or we failed
		if(cbName == "resolve")
		{
			//we were a success! Save as successful
			completedRequests[reqName] = {request: ifRequest, response: arguments};
		}

		//upon finishing, we delete the inflight aspect of the request
		delete inflightRequests[reqName];

		//loop through promises, and finish them, be it resolve or reject (stored in cbName)
		for(var i=0; i < ifRequest.promises.length; i++)
		{
			var promise = ifRequest.promises[i];
			promise[cbName].apply(promise, arguments);
		}

		console.log('Resolved/rejected download promises.');

		//no more promises, all fulfilled
		ifRequest.promises = [];
	}
	catch(e)
	{
		console.log('Error fulilling promises: ', e);
	}
	};
}

globalCache.downloadModule = function(moduleInfo)
{
	//When the module is ready, we must inform the function that made the call
	//however, we may have multiple parts of the app interested in a particular module

	//we make a promise we will eventually resolve/reject
	var defer = Q.defer();

	//pull repo from our repositories
	var repo = gConfig.getRepository(moduleInfo.repoName);

	//can use the repomanager for retrieval
	var repoManager = require('../repoTypes/' + repo.type + '/rRetrieve.js');

	console.log('Pulling module: '.magenta, moduleInfo, '\n From Repo: '.yellow, repo);


	var reqName = moduleRequestName(moduleInfo);

	//if we've already performed this module request, and we know where everything is
	//just pass that information directly!
	if(completedRequests[reqName])
	{
		console.log('Already completed request : '.magenta, reqName);
		//at the next tick, just finish this
		//must send back a promise first :)
		process.nextTick(function()
		{
			//pass on the response of the completed object, we're done!
			defer.resolve.apply(defer, completedRequests[reqName].response);
		});

		return defer.promise;
	}
	//otherwise, we haven't completed
	//Have we already issued a request for this module?
	var ifRequest = inflightRequests[reqName];
	if(!ifRequest)
	{
		//setting up request
		console.log('Creating download request: ', moduleInfo);

		//we don't have any open requests
		//so we create a request, with a promise to be fullfilled
		//where will we be storing this module?
		var tmpFullDirectory = globalCache.getTempDirectory();
		//we'll make our cached object -- which contains a list of all promises made, and where the information is stored
		var fullRequest = {promises: [defer], fullDirectory: tmpFullDirectory};
		inflightRequests[reqName] = fullRequest;
		

		//Now, we need to set up a success or failure condition that resovles all of our promises (stored in promises)
		//therefore the callbacks wrap a function that knows what the request name is
		//that will call our inflight request cache, and resolve all promises according the reject/resolve functions
		var dlSuccess = fullfillDownloadPromises(reqName, "resolve");
		var dlFailure = fullfillDownloadPromises(reqName, "reject");

		// console.log('Making full module request from repomanager: ', repo.url, tmpFullDirectory, moduleInfo);
		//now ask the repo manager to figure out how to get hte module and save it to the directory
		//when it's done, we either succeeded or failed - and our callbacks have been created to finish the request
		repoManager.getFullModule(repo.url, tmpFullDirectory, moduleInfo)
			.then(dlSuccess, dlFailure)
			.fail(function(err)
			{
				//failed calling get module
				console.log("Failed getting module: ", moduleInfo, err);
				throw err;
			})
			// .fail(dlFailure);

	}
	else
	{

		console.log('In progress, push promise: ', moduleInfo);
		//we're already looking for that object
		//simply note this by adding our own promise to this
		ifRequest.promises.push(defer);

	}

	//return a promise to finish this download for the module
	return defer.promise;
}
