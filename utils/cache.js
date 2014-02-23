var fstream = require('fstream'),
	tar = require('tar'),
	zlib = require('zlib');

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

	console.log('pull dir: ', dirPath);
	console.log('Write to: ', outFile);

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

globalCache.qUnzipTarball = function(incoming, tmpDirectory) {
	var defer = Q.defer();

	var reject = function() {
		defer.reject.apply(this, arguments);
	};
	var success = function() {
		defer.resolve.apply(this, arguments);
	};

	//going to write out to a particular directory
	var writer = fstream.Writer({
		'path': tmpDirectory
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


	//let's pull a file from the depths of hell
	fstream.Reader({
		'path': incoming,
		'type': 'File'
	})
		.pipe(zlib.Gunzip())
		.pipe(tar.Extract())
		.pipe(writer);

	return defer.promise;
}