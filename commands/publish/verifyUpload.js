var gConfig = require('../../config.js');
var qUtils = require('../../utils/qUtils.js');

var Error = require ("errno-codes");

var Q = require('q');
var path = require('path');

var baseURL = "http://localhost:3000";
var repoType = "wpm-local";

var repoManager = require('../../repoTypes/' + repoType + '/rPublish.js');

module.exports = verify;

var customError = 
{
	NotLoggedIn : 1000 
};

var handleVerifyErrors = function(finished, reject)
{
	return function(err)
	{
		if(err.errno == undefined)
		{
			console.log("Verify: Unplanned custom error: ".red, err);
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

var handleVerifyFinished = function(finished)
{
	return function(jsonFinished)
	{
		console.log('Finished: ', jsonFinished);
		//called when we're all done
		finished.apply(this, arguments);
	}
}
//From SO: 
//http://stackoverflow.com/questions/3000649/trim-spaces-from-start-and-end-of-string
function trim1 (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

function verify(prepareResults)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(this, arguments); };
	var finished = function() { defer.resolve.apply(this, arguments); };
	
	
	//we Verify for submission
	console.log('\t Verifying Upload with Registry...'.magenta);

	if(!gConfig.isLoggedIn())
	{
		var error = new Error();
		error.errno = customError.NotLoggedIn;
		handleVerifyErrors(finished, reject)(error)
		return;
	}

	var skipSteps = false;
	

	try
	{

		var postRequest = repoManager.checkModuleRequest(baseURL, prepareResults);		
	
		// console.log('Requesting post: ', options);

		//now we reach out and make a registry request with how to proceed
		//call the module API with username and module properties
		qUtils.qRequestPost(postRequest.url, postRequest.options)
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

				//otherwise 
				console.log('\t Registry responded, preparing package. '.green);

				//when we get the green light, then we initiate the upload to the appropriate place
				var bodyJSON = JSON.parse(body);

				//Let's figure out where to send our upload. We use our retrieve logic for this registry type. 
				console.log(bodyJSON);

				//send where the file is, and what the server responded
				//this function handles the full upload
				return repoManager.uploadModule(baseURL, prepareResults.location, bodyJSON);

			})
			.done(handleVerifyFinished(finished), handleVerifyErrors(finished, reject));

	}
	catch(e)
	{
		console.log(e);
		throw e;
	}

	return defer.promise;
}