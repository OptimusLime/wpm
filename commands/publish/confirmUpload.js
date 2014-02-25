var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');

var Error = require ("errno-codes");

var Q = require('q');
var path = require('path');

var baseURL = "http://localhost:3000";
var repoType = "wpm-local";

var repoManager = require('../../repoTypes/' + repoType + '/rPublish.js');

module.exports = confirm;

var customError = 
{
	NotLoggedIn : 1000,
	NotVerified : 2000
};

var handleConfirmErrors = function(finished, reject)
{
	return function(err)
	{
		if(err.errno == undefined)
		{
			console.log("Confirm: Unplanned custom error: ".red, err);
			reject.apply(this, err);
			return;
		}

		switch(err.errno)
		{
			// case Error.ENOENT.errno:
			// 	console.log("\t No defined WIN Module here. Need ".red + gConfig.packageName().red + " file".red);
			// 	finished.apply(this, {success: false});
			// 	break;
			case customError.NotLoggedIn:
				console.log("\t Not logged in!".red);
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

var handleConfirmFinished = function(finished)
{
	return function(jsonFinished)
	{
		// console.log('Finished: ', jsonFinished);
		//called when we're all done
		finished.apply(this, arguments);
	}
}
//From SO: 
//http://stackoverflow.com/questions/3000649/trim-spaces-from-start-and-end-of-string
function trim1 (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

function confirm(verifyResults)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(this, arguments); };
	var finished = function() { defer.resolve.apply(this, arguments); };
	
	if(verifyResults.failed)
	{
		return {failed: true};
	}

	//we Confirm for submission
	console.log('\t Confirming Upload with Registry'.magenta);

	if(!gConfig.isLoggedIn())
	{
		var error = new Error();
		error.errno = customError.NotLoggedIn;
		handleConfirmErrors(finished, reject)(error)
		return;
	}
	//if we weren't verfied, we can't continue
	else if(!verifyResults.success)
	{
		var error = new Error();
		error.errno = customError.NotVerified;
		handleConfirmErrors(finished, reject)(error)
		return;
	}

	var skipSteps = false;
	
	try
	{

		console.log(verifyResults);

		var getRequest = repoManager.confirmModuleRequest(baseURL, verifyResults);		
	
		console.log('Requesting confirm: ', getRequest.url);

		//now we reach out and make a registry request with how to proceed
		//call the module API with username and module properties
		qUtils.qRequestGet(getRequest.url, getRequest.options)
			.then(function(regResponse)
			{
				var body = regResponse.body;
				var fullResponse = regResponse.response;

				if(!body || fullResponse.statusCode != 200)
				{
					console.log('\t Registry error: '.red + fullResponse.statusCode.toString().red);
					skipSteps = true;
					return {success: false};
				}

				var bodyJSON = JSON.parse(body);

				if(bodyJSON.success)
				{
					//otherwise http 200, all good
					console.log('\t Registry confirmed package accepted.'.green);

					//time to remove the temporary directory in the cache
					return {success:true};
				}
				else
					return {success: false, error: bodyJSON.error};

			})
			.done(handleConfirmFinished(finished), handleConfirmErrors(finished, reject));

	}
	catch(e)
	{
		console.log(e);
		throw e;
	}

	return defer.promise;
}