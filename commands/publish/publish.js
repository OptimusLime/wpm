var prompt = require('prompt');
var request = require('request');
var Q = require('q');

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

			
	//we need to pull in ignore configurations
	prepare(options)
		.then(verify)
		.then(confirm)
		.done(function(vals)
		{
			if(vals.success)
				console.log('\t Publishing successfully complete!'.green);
			else
				console.log('\t Publishing failed'.red);

		}, function(err)
		{

		});


}




