var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var cache = require('../../utils/cache.js');

var Error = require ("errno-codes");

var Q = require('q');
var path = require('path');

module.exports = prepare;

var handlePrepareErrors = function(finished, reject)
{
	return function(err)
	{
		if(err.errno == undefined)
		{
			console.log("Unplanned custom error: ".red, err);
			reject.apply(this, err);
			return;
		}

		switch(err.errno)
		{
			case Error.ENOENT.errno:
				console.log("\t No defined WIN Module here. Need ".red + gConfig.packageName().red + " file".red);
				finished.apply(this, {success: false});
				break;
			default:
				console.log("Unplanned error: ".red, Error.get(err.errno));
				reject.apply(this, err);
				break;
		}
		// console.log('\tError: '.red, err);

		//called when we're all done
		//since we did actually fail still
	}	
}

var handlePrepareFinished = function(finished)
{
	return function(jsonFinished)
	{
		//called when we're all done
		finished.apply(this, arguments);
	}
}
//From SO: 
//http://stackoverflow.com/questions/3000649/trim-spaces-from-start-and-end-of-string
function trim1 (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

function prepare()
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(this, arguments); };
	var finished = function() { defer.resolve.apply(this, arguments); };
	
	//we prepare for submission
	console.log('\t Preparing module...'.magenta);

	//check for win.json inside file
	var commandDir = process.cwd();

	//what do we call the win module file (we pull from a function so it can be adjusted easily in the future)
	var packName = gConfig.packageName();

	var modLocation = path.resolve(commandDir, "./" + packName);
	var ignoreLocation = path.resolve(commandDir, "./winignore");

	var moduleProperties, moduleFileName;

	var skipSteps = false;

	qUtils.qReadJSON(modLocation)
		.then(function(modJSON)
		{
			//we have our mod file, let's take a look
			console.log(modJSON);

			moduleProperties = modJSON;

			//we'll create a function for this later
			//todo: function to verify json properties (separate file preferable)
			if(!modJSON.name || !modJSON.version)
			{
				var both = !modJSON.name && !modJSON.version;

				var isMissing = !modJSON.name ? "a proper name." : "";
				isMissing += (both ? " and " : "");
				isMissing += !modJSON.version ? "a proper version." : "";

				console.log("\t Package missing ".red + isMissing.red);
				
				skipSteps = true;
				return {success:false};
			}

			//attempt to read
			return qUtils.qExists(ignoreLocation);

		})
		.then(function(exists)
		{
			if(skipSteps)
				return {success: false};

			console.log('\t Custom ignore? '.magenta, exists ? " yes ".green : " no ".cyan);
			//readJSON if it exists
			if(exists)
				return qUtils.qReadFile(ignoreLocation);
			else
				return "";
		})
		.then(function(ignoreString)
		{
			if(skipSteps)
				return {success: false};

			var iString = ignoreString.toString();

			//split it by lines
			var iSplit = iString.split('\n');

			var tSplits = [];
			for(var i=0; i < iSplit.length; i++)
			{
				var ts = trim1(iSplit[i]);
				if(ts != "")
					tSplits.push(ts);
			}

			//combine our custom ignore file with our default ignores (later, we'll combine with gitignore)
			//todo: combine with gitignore and maybe npmignore, etc
			var ignore = gConfig.ignoreMap(commandDir, tSplits);

			// console.log('Ignoring: ', ignore);

			//now we have our ignore mapping, let's read in the director
			var filter = function()
			{
				console.log("Base: ", this.basename, " type: ", this.type);//, " directory: ", this.dirname);
				console.log("\t Allow In? ".cyan, !ignore[this.basename] ? " Yes " : " Nope ");

				//anything in the mapping should NOT be saved
				return !ignore[this.basename];
			}

			var tempDirectory = gConfig.getTempDirectory();

			var tarBallName = moduleProperties.name + "@" + moduleProperties.version + ".tar.gz";
			moduleFileName = tarBallName;

			//lets name the tarball
			var tarBallLocation = path.resolve(tempDirectory, "./" + tarBallName);
			// console.log(tarBallName);

			return cache.qCreateTarball(commandDir, tarBallLocation, filter);
		})
		.then(function(tarballLocation)
		{
			if(skipSteps)
				return {success: false};

			//for now just return success
			return {success: true, location: tarballLocation, fileName: moduleFileName, properties: moduleProperties};
		})
		.done(handlePrepareFinished(finished), handlePrepareErrors(finished, reject));

	return defer.promise;
}