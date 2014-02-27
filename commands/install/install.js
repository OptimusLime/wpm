var fs = require('fs-extra');
var prompt = require('prompt');
var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');
var path = require('path');
var Q = require('q');

var installLogic = {install : install};

module.exports = installLogic;

//disable some display choices
prompt.message = "wpm".magenta.italic;
prompt.delimiter = ":";



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


	//here is the outline of what needs to happen

	//recursive function

	//grab initial direct dependencies of objects we want to download
	//from this very directory!	
	var currentDirectory = process.cwd();
	var skipRemainingSteps = false;
	//we know that the current directory is a WIN repository (it must be to trigger an install command)	
	var fRepo = gConfig.getRepository("wpm");
	var repoInstallManager = require('../../repoTypes/' + fRepo.type + '/rInstall.js');

	//now we're going to start by fully installing ourselves!
	repoInstallManager.fullyInstallModule(currentDirectory)
		.done(function(finalValues)
		{
			//pass on the message from installation
			console.log(finalValues.message);
			// console.log('\t Modules installed. OK.'.green);
		},function(err)
		{
			console.log('\t Error: '.red, err);
			console.log('\t Installation failed.'.red);
		});
			


	// qGrabInitial(currentDirectory, arguments)
	// 	.then(function(initialPackageList)
	// 	{
	// 		//we've reached an initial package list
	// 		//now we have some recursion to be done

	// 		console.log("Init packages: ", initialPackageList);

	// 		if(initialPackageList.length == 0)
	// 		{
	// 			//we're done -- nothing to install
	// 			skipRemainingSteps = true;
	// 			return {success: true, message: "No module dependencies to install. Installation finished.".cyan};
	// 		}

	// 		//now we need to fetch those modules
	// 		fetchPackages(initialPackageList)
	// 			.done(function(pFetchInformation)
	// 			{
	// 				//we have all information about what was fetched

	// 				//check for parameter files
	// 				for(var i=0; i < pFetchInformation.length; i++)
	// 				{
	// 					//all fetch info -- should have parameters JSON object
	// 					var fetch = pFetchInformation[i];
	// 					var initialInfo = initialPackageList[i];

	// 					var repoName = initialInfo.repo;

	// 					//grab the full repo object -- we need to offload to the repo type
	// 					var fRepo = globalConfig.getRepository(repoName);

	// 					var repoInstallManager = require('../../repoTypes/' + fRepo.type + '/rRetrieve.js');

	// 					repoInstallManager.installModuleToDirectory(currentDirectory, fetch)

	// 				}


	// 				//errors will be caught by the larger q function
	// 			}, function(err){ console.log('Fetch err.'); throw err;});

	// 	})
	// 	.done(function(finalValues)
	// 	{
	// 		if(skipRemainingSteps)
	// 		{
	// 			console.log(finalValues.message);
	// 			return;
	// 		}
	// 		else
	// 		{
	// 			console.log('\t Modules installed. OK.'.green);
	// 		}

	// 	},function(err)
	// 	{
	// 		console.log('\t Error: '.red, err);
	// 		console.log('\t Installation failed.'.red);
	// 	});
			


	// initial(arguments)
	// 	.then(start)
	// 	.done(function(finished)
	// 	{
	// 		removeTemporaryFiles();

	// 		if(finished.count)
	// 		{
	// 			console.log('\t Modules installed. OK.'.green);
	// 		}
	// 		else
	// 		{
	// 			console.log('\t Finished: No module dependencies for installation.'.cyan)
	// 		}

	// 	}, function(err)
	// 	{
	// 		removeTemporaryFiles();

	// 		console.log('\t Error: '.red, err);
	// 		console.log('\t Installation failed.'.red);
	// 	});

	


}




