var Q = require('q');
var fs = require('fs-extra');
var request = require('request');
var crypto = require('crypto');

var qGlobal = {};


//send out our global object
module.exports = qGlobal;

qGlobal.qReadFile = function(file)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	fs.readFile(file, function(err, buffer)
	{
		if(err) reject(err);
		else success(buffer);
	});

	return defer.promise;
}

qGlobal.qReadJSON = function(file)
{
	// if(!file){
	// 	var err = new Error("No arguments provided");
	// 	err.name = "QNoArguments";
	// 	reject(err);
	// }

	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	fs.readJSON(file, function(err, data)
	{
		if(err) reject(err);
		else success(data);
	});

	return defer.promise;
}

qGlobal.qRemoveDirectory = function(dirName)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	//check if something exists or not
	fs.remove(dirName, function(err)
	{
		if(err) reject(err);
		else success();
	});

	return defer.promise;
}


qGlobal.qExists = function(pathLocation)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	//check if something exists or not
	fs.exists(pathLocation, function(exists)
	{
		success(exists);
	});

	return defer.promise;
}

qGlobal.qMD5Checksum = function(fileLocation)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	
	
	var shasum = crypto.createHash('md5');

	//pull in our designated fileLocation (probably newly created tarball)
	var s = fs.ReadStream(fileLocation);

	//update on data for the checksum
	s.on('data', function(d) {
	  shasum.update(d);
	});

	//when we're all done, create our checksum hex, and send along
	s.on('end', function() {
  		var d = shasum.digest('hex');
 		success(d);
	});

	//make sure to catch any errors
	s.on("error", reject);


	return defer.promise;
}


//Making HTTP Requests using q flow control

qGlobal.qGenericRequest = function(reqMethod, url, options)
{
	var defer = Q.defer();
	var reject = function() { defer.reject.apply(defer, arguments); };
	var success = function() { defer.resolve.apply(defer, arguments); };
	try
	{
		reqMethod(url, options, function(err, res, body)
		{
			// console.log('Returned res: ', arguments);
			if(err) reject(err);
			else
				//pass the body on, although, in some instance, we might need more information -- i'll consider sending the response as well
				success({body: body, response: res});
		});
	}
	catch(e)
	{
		console.log(e);
		throw e;
	}

	return defer.promise;
};

qGlobal.qRequestPost = function(url, options)
{
	return qGlobal.qGenericRequest(request.post, url, options);
};

qGlobal.qRequestGet = function(url, options)
{
	return qGlobal.qGenericRequest(request.get, url, options);
};


