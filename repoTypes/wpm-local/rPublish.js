var gConfig = require('../../config.js');
var fstream = require('fstream');
var request = require('request');
var Q = require('q');

function WPMLocalPublish()
{
	var self = this;


	self.checkModuleRequest = function(baseURL, moduleInfo)
	{
		//assumed to have been authorized when calling this function
		var auth = gConfig.authUser();

		var packedModuleLocation = moduleInfo.location;
		var moduleProperties = moduleInfo.properties;
		var moduleFileName = moduleInfo.fileName;
		var checksum = moduleInfo.checksum;

		//then we make a request location for the local type
		var url = baseURL + "/packages/" + auth.username + "/" + moduleProperties.name;
	
		var postOptions = {
			// url: url,
			//Authorization for current logged in user
			form : {
				properties : moduleProperties,
				localLocation : packedModuleLocation,
				fileName : moduleFileName,
				checksum: checksum 
			},
			auth :
			{
				username: auth.username,
				password: auth.password,
				sendImmediately : true
			}
		};
	
		return {url: url, options: postOptions};
	}

	self.confirmModuleRequest = function(baseURL, uploadResponse)
	{
		//grab the parameters from our upload repsonse
		var confirmParams = uploadResponse.parameters;

		//deep in its bowels, we can find the confirmation URL
		var url = baseURL + confirmParams.confirmURL;

		//why not authorize ourselves before attending the confirmation ceremony
		var auth = gConfig.authUser();
		var getOptions = {
			//Authorization for current logged in user
			auth :
			{
				username: auth.username,
				password: auth.password,
				sendImmediately : true
			}
		};

		//simple authorized request to the confirm URL should do it
		return {url: url, options: getOptions};
	}

	self.uploadModule = function(baseURL, moduleLocation, registryResponse)
	{
		var defer = Q.defer();

		//don't resolve/reject more than once
		var acted = false;
		var reject = function() { if(!acted) { acted = true; defer.reject.apply(defer, arguments); } };
		var success = function() {  if(!acted) { acted = true; defer.resolve.apply(defer, arguments); } };
		
		var auth = gConfig.authUser();

		//we've stuffed the module into a tarball @ moduleLocation,
		//Now we need to upload to wherever the registry response tells us
		var reader = fstream.Reader(
		{
			path : moduleLocation
			//going to
		});

		//we're going to read in our tarball, and pipe it to a post request

		var upParams = registryResponse.parameters;

		var uploadURL = baseURL + upParams.url;

		var postOptions = {
			//Authorization for current logged in user
			auth :
			{
				username: auth.username,
				password: auth.password,
				sendImmediately : true
			}
		};

		// console.log("Posting: ", uploadURL);
		console.log("\t Uploading package to registry...".magenta);

		//on close, everything was sent, but we need confirmation from the server
		//so we use the callback
		var uploadRequest = request.post(uploadURL, postOptions, 
			function(err, response, body)
			{
				if(err) reject(err);
				else
				{
					//no error, check the body for success
					if(response.statusCode == 200)
					{
						var bodyJSON = JSON.parse(body);
						console.log("BJ: ",bodyJSON);

						if(bodyJSON.success)
							success({success:true, parameters: bodyJSON.parameters});
						else
							success({success:false, error: bodyJSON.error});

					}
					else //unknown error from the body
						reject({success:false, code: response.statusCode, error: body});
				}
			});
		
		//catch our upload errors
		uploadRequest.on("error", reject);

		//now we pipe our file to the uploadrequest
		//we'll find out if it worked or not
		reader.pipe(uploadRequest);
	
		return defer.promise;
	}



	return self;
}

//export a single instance (require should cache this one object)

module.exports = WPMLocalPublish();
