var globalConfig = {fileName: 'wpm_cf.json'};
var fs = require('fs');
var path = require('path');
var cuid = require('cuid');


module.exports = globalConfig;

var defaultPkgName = "win.json";
//in the future, this should be loaded from a file of ignores (that other components can contribute to)
var defaultIgnore = 
[
".git",
 "node_modules"
];

globalConfig.getOrCreateConfig = function()
{
	if(globalConfig.config == undefined)
	{
		try
		{
			var rf = fs.readFileSync(path.resolve(__dirname, './' + globalConfig.fileName));

			//parse the file into the config object (no need to sync)
			globalConfig.config = JSON.parse(rf);
		}	
		catch(e)
		{
			//we hit an error, if the file doesn't exist or something
			//jsut overwrite it!

			var file = {currentUser:{}, packageName: defaultPkgName};
			//this will set our config object as well as writing to file
			globalConfig.syncSaveConfig(file);
		}	
	}

	return globalConfig.config;
};

globalConfig.syncSaveConfig = function(obj)
{

	try{
		var err = fs.writeFileSync(path.resolve(__dirname, './' + globalConfig.fileName), JSON.stringify(obj));
	}
	catch(e)
	{
		//error writing config
		console.log('Error writing global config!');
		throw err;
	}

	globalConfig.config = obj;
};

globalConfig.packageName = function () {
	return globalConfig.getOrCreateConfig().packageName;
}

//prefix is if you want to add a list of objects
globalConfig.ignoreMap = function(prefix, ignoreObjects) {
	// need all the ignorable directories
	var mapped = {};
	ignoreObjects = ignoreObjects || [];

	//compile ALL ignorable files/directories
	var allIgnore = ignoreObjects.concat(defaultIgnore);
	
	for(var i=0; i < defaultIgnore.length; i++)
	{
		mapped[defaultIgnore[i]] = defaultIgnore[i];
	}

	return mapped;
}

globalConfig.getTempDirectory = function() {

	return path.resolve(__dirname, "./cache/" + cuid());
}


//==============================
//User related functions =======
//==============================

globalConfig.saveUser = function(user)
{
	var config = globalConfig.getOrCreateConfig();

	config.currentUser.username = user.username;
	config.currentUser.password = user.password;

	globalConfig.syncSaveConfig(config);

};

globalConfig.logout = function(user)
{
	var config = globalConfig.getOrCreateConfig();

	config.currentUser = {};

	globalConfig.syncSaveConfig(config);
}

globalConfig.isLoggedIn = function()
{
	//must have valid user, and not empty!
	return globalConfig.currentUser() != undefined;
}
globalConfig.currentUser = function()
{
	var config = globalConfig.getOrCreateConfig();

	//must have valid user, and not empty!
	return config.currentUser.username;
}

globalConfig.authUser = function()
{
	var config = globalConfig.getOrCreateConfig();

	//must have valid user, and not empty!
	return config.currentUser;
}


