var prompt = require('prompt');
var request = require('request');
var Q = require('q');
var fs = require('fs-extra');

var gConfig = require('../../config.js');

var publishLogic = {publish : publish};

module.exports = publishLogic;

//disable some display choices
prompt.message = "wpm".magenta.italic;
prompt.delimiter = ":";

var prepare = require('./prepare.js');
var verify = require('./verifyUpload');
var confirm = require('./confirmUpload');


function publish()
{
	if(!gConfig.isLoggedIn())
	{
		console.log("\t Must be logged in to publish!".red);
		return;
	}	

	//in case no options are passed
	var options = arguments[arguments.length -1] || {};

	//options will tell us what was passed in through options

			//successfully tarred the object, now what do we do?
			//WHY WE SEND IT TO THE INTERNET
			// qUtils.qRequestPost()

	
	var removeTemporaryFile = function()
	{
		try
		{
			//now we delete the cache before declaring it a success or failure
			//in the future, we should only delete the cache on success -- and publish should be able to resume at the appropriate steps
			//we'll need a better mechanism for skipping through these functions than (skip: true)
			//that's why it's easier to destroy the cache
			var active = gConfig.getActivePublish();
			var location = gConfig.getPackageLocation(active);
			var directory = location.directory;

			//let's do the remove thing
			fs.removeSync(directory);
			gConfig.removePackageLocation(active);

		}
		catch(e)
		{
			console.log("Failed to remove cached files. This isn't allowed.")
			return;
		}
	}

	//we need to pull in ignore configurations
	prepare(options)
		.then(verify)
		.then(confirm)
		.done(function(vals)
		{
			removeTemporaryFile();

			if(vals.failed)
			{
				console.log('\t Publishing failed'.red);
			}
			else if(vals.success)
			{
				console.log('\t Publishing successfully complete!'.green);
			}
			else
				console.log('\t Publishing failed'.red);

		}, function(err)
		{
			removeTemporaryFile();
		});


}




