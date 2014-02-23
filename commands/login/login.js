
var prompt = require('prompt');
var request = require('request');
var Q = require('q');

var baseURL = "http://localhost:3000";
var userLogic = {login : login, signup : signup};

module.exports = userLogic;


//disable some display choices
prompt.message = "wpm".magenta.italic;
prompt.delimiter = ":";

var promptCheckEmail = function(defer)
{
	//we use Q to maintain a flow
	var defer = defer || Q.defer();

	//we're going to be constructing a user object
	//with email, username, and password
	var user = {};

	//we prompt the user for an email
	//not that this cannot be empty (and later we will have checks on the formating)
	prompt.get([{
		name: 'email',
		description: 'Enter email',
		required: true
	}], function(err, result)
	{
		if(!result)
		{
			defer.reject("Request cancelled");
			return;
		}
		console.log('\t Checking email is not in use...'.cyan);

		request.get(baseURL + '/email/' + result.email, function(err, response, body)
			{
				if(err)
				{
					//if we run into any issues, just reject ourselves
					defer.reject(err);
					return;
				}
				//if we don't hit an error, instead we'll check if the email exists or not
				var bodyJSON = JSON.parse(body);
				//parse the body, check it exists
				if(bodyJSON.exists)
				{
					//we've discovered that the email is in use
					//tell the user, and start the prompt again
					console.log('Error, email in use, please use other email.'.red);
					//note that we pass defer onwards -- we're still in the prompt stage
					//we will move to the next stage when this is resolved (or aborted by user)
					promptCheckEmail(defer);
				}
				else
				{
					console.log('\t Email not in use. '.green, 'Please confirm e-mail address.');
					//the email is good to go, add it to user info, pass the user along
					user.email = result.email;
					defer.resolve(user);
				}
			});
	});

	return defer.promise;
}


var promptConfirmEmail = function(user) {

	//we use Q to maintain a flow
	var defer = Q.defer();

	//we're going to be adding to the user object
	//confirming the user email

	//we prompt the user for an email
	//not that this cannot be empty (and later we will have checks on the formating)
	prompt.get([{
		name: 'confirmEmail',
		description: 'Confirm email',
		required: true,
		conform: function(value) {
			var email = user.email;
			//if the emails match, return true
			//otherwise -- oops!
			return email == value;
		}
	}], function(err, result)
	{
		if(!result)
		{
			defer.reject("Request cancelled");
			return;
		}

		if(err)
		{
			//if we run into any issues, just reject ourselves
			console.log('E-mail confirm failed!'.red);
			defer.reject(err);
		}
		else
		{
			console.log('\t E-mail confirmed!'.green);
			defer.resolve(user);
		}		
	});

	return defer.promise;
}

var promptCheckUsername = function(user, defer)
{
	//we use Q to maintain a flow
	var defer = defer || Q.defer();

	//we pass in user info, we'll update with username when verified

	//we prompt the user for an email
	//not that this cannot be empty (and later we will have checks on the formating)
	prompt.get([{
		name: 'username',
		description: 'Enter desired username',
		required: true
	}], function(err, result)
	{
		console.log('\t Checking username is available...'.cyan);
		if(!result)
		{
			defer.reject("Request cancelled");
			return;
		}

		request.get(baseURL + '/username/' + result.username, function(err, response, body)
			{
				if(err)
				{
					//if we run into any issues, just reject ourselves
					defer.reject(err);
					return;
				}
				//if we don't hit an error, instead we'll check if the email exists or not
				var bodyJSON = JSON.parse(body);
				//parse the body, check it exists
				if(bodyJSON.exists)
				{
					//we've discovered that the username is in use
					//tell the user, and start the prompt again
					console.log('\t Error, username in use, please choose something else.'.red);
					//note that we pass defer onwards -- we're still in the prompt stage
					//we will move to the next stage when this is resolved (or aborted by user)
					promptCheckUsername(user, defer);
				}
				else
				{
					console.log('\t Username available!'.green);
					//the username is good to go, add it to user info, pass the user along
					user.username = result.username;
					defer.resolve(user);
				}
			});
	});

	return defer.promise;
}

var promptPassword = function(user) {

	//we use Q to maintain a flow
	var defer = Q.defer();

	//we're going to be adding to the user object
	//confirming the user email

	//we prompt the user for an email
	//not that this cannot be empty (and later we will have checks on the formating)
	prompt.get([{
		name: 'password',
		description: 'Enter password',
		hidden: true,
		required: true,
		conform: function(value) {
			return true;
		}
	}], function(err, result)
	{
		if(!result)
		{
			defer.reject("Request cancelled");
			return;
		}
		
		if(err)
		{
			//if we run into any issues, just reject ourselves
			console.log('\t Password issues!'.red);
			defer.reject(err);
		}
		else
		{
			user.password = result.password;
			defer.resolve(user);
		}		
	});

	return defer.promise;
}

var confirmPassword = function(user) {

	//we use Q to maintain a flow
	var defer = Q.defer();

	//we're going to be adding to the user object
	//confirming the user email

	//we prompt the user for an email
	//not that this cannot be empty (and later we will have checks on the formating)
	prompt.get([{
		name: 'confirmPassword',
		description: 'Confirm password',
		hidden: true,
		required: true,
		conform: function(value) {
			var password = user.password;
			return value == password;
		}
	}], function(err, result)
	{
		if(!result)
		{
			defer.reject("Request cancelled");
			return;
		}

		if(err)
		{
			//if we run into any issues, just reject ourselves
			console.log('\t Password confirm issues!'.red);
			defer.reject(err);
		}
		else
		{
			console.log('\t Password confirmed'.green);
			defer.resolve(user);
		}		
	});

	return defer.promise;
}


function signup(env, options) {
	
	
	//
	// Start the prompt
	//
	prompt.start();


	//
	// Get email, confirmed email properties from the user: email and confirmedEmail
	//

	promptCheckEmail() //first we call to check email against the server (no duplicates)
		.then(promptConfirmEmail) //then we confirm that you want that email
		.then(promptCheckUsername) //then we check desired username against the server
		.then(promptPassword) //then we set a password!
		.then(confirmPassword) //then we confirm the password!
		.done(function(user)
		{
			//we're ready to signup with user info!
			console.log('\t Got through signup info : '.green);
			console.log(user);

			//we're ready to post to signup, yo!
			request.post(baseURL + '/signup', {
			'form' : {email : user.email},
			'auth': {
				'user': user.username,
				'pass': user.password,
				'sendImmediately': true
				}
			}, 
			function(err, response, body)
			{
				if(err)
					throw err;

				console.log('Returning from sign-up: ', body);
				if(response.statusCode == 401 || !body)
				{
					console.log('\t User creation failed. :/ '.red);
				}
				else
				{
					var bodyJSON = JSON.parse(body);

					if(bodyJSON.success)
					{
						console.log('User successfully created: '.green, user.username);
					}
					else
					{
						console.log('User creation failed. :/ '.red);
					}
				}

			});
		},
		 function(err)
		{
			console.log('Signup flow failed (!) : '.red, err);
		})
	
}

function login(env, options)
{

	//let's do a login to the website huzzah!
	console.log("\t Attempting treacherous login mwahahaha".red);
	//
	// Start the prompt
	//
	prompt.start();

	//
	// Get two properties from the user: username and email
	//
	prompt.get([
		{
			name: 'username',
			description: 'Enter username',
			required: true
		},
		{
			name: 'password',
			description: 'Enter password',
			hidden: true,
			required: true
		}], 
		function (err, result) {
		//
		// Log the results.
		//

			if(!result)
			{
				console.log("Login cancelled.".red);
				return;
			}


		var username = result.username;
		var password = result.password;

		//and now, we attempt to signin to our server
		request.post(baseURL + "/login", {
			'auth': {
				'user': username,
				'pass': password,
				'sendImmediately': true
			}
		},
		function(err, response, body)
		{
			if(err)
				throw err;

			if(response.statusCode == 401 || !body)
			{
				console.log('\t Login failed. Check username/password.'.red);
			}
			else
			{
				var bodyJSON = JSON.parse(body);

				if(bodyJSON.success)
				{
					//we've made it, by god it worked!
					console.log('\t Login success!'.green);

					//now we save that information locally to prevent future hassle
				}
				else
				{
					console.log('\t Login failed. Check username/password.'.red);
				}	
			}
		});
	});

}