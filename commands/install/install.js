var fs = require('fs-extra');
var prompt = require('prompt');
var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var path = require('path');

var installLogic = {install : install};

module.exports = installLogic;

//disable some display choices
prompt.message = "wpm".magenta.italic;
prompt.delimiter = ":";

var initial = require('./initialModules.js');
var start = require('./startInstall.js');


function install()
{	


	//we need to be able to clean up after the install procedure (clear any cached objects)
	//this is a bit of hack
	var removeTemporaryFiles = function()
	{
		try
		{

			var afterFunction = function(aInfo)
			{
				return function()
				{
					gConfig.removeActiveRetrieval(aInfo);
				}
			};

			//now we delete the cache before declaring it a success or failure
			//in the future, we should only delete the cache on success -- and install should be able to resume at the appropriate steps
			//we'll need a better mechanism for skipping through these functions than (skip: true)
			//that's why it's just easier to destroy the cache right now
			var active = gConfig.allActiveRetrievals();
			for(var i=0; i < active.length; i++)
			{
				var location = gConfig.getPackageLocation(active[i]);
				var directory = location.directory;

				//let's do the remove thing
				// console.log("Rem dir: ", directory);
				qUtils.qRemoveDirectory(directory)
					.then(afterFunction(active[i]), function(err)
						{	
							console.log('Failure at cache removal: ', err )
							throw err;
						});

			}

			//all gone!
			

		}
		catch(e)
		{
			console.log("Failed to remove cached files. This isn't allowed: ", e);
			return;
		}
	}





	initial(arguments)
		.then(start)
		.done(function(finished)
		{
			removeTemporaryFiles();

			if(finished.count)
			{
				console.log('\t Modules installed. OK.'.green);
			}
			else
			{
				console.log('\t Finished: No module dependencies for installation.'.cyan)
			}

		}, function(err)
		{
			removeTemporaryFiles();

			console.log('\t Error: '.red, err);
			console.log('\t Installation failed.'.red);
		});

	// prepare(options)
	// 	.then(verify)
	// 	.then(confirm)
	// 	.done(function(vals)
	// 	{
	// 		removeTemporaryFile();

	// 		if(vals.failed)
	// 		{
	// 			console.log('\t Publishing failed'.red);
	// 		}
	// 		else if(vals.success)
	// 		{
	// 			console.log('\t Publishing successfully complete!'.green);
	// 		}
	// 		else
	// 			console.log('\t Publishing failed'.red);

	// 	}, function(err)
	// 	{
	// 		removeTemporaryFile();
	// 	});


}




