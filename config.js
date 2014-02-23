var globalConfig = {fileName: 'wpm_cf.json'};
var fs = require('fs');
var path = require('path');

module.exports = globalConfig;

globalConfig.getOrCreateConfig = function()
{
	if(!globalConfig.config)
	{
		var file = {currentUser:{}};
		//this will set our config object as well as writing to file
		globalConfig.syncSaveConfig(file);		
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

globalConfig.saveUser = function(user)
{
	var config = globalConfig.getOrCreateConfig();

	config.currentUser.username = user.username;
	config.currentUser.password = user.password;

	globalConfig.syncSaveConfig(config);

};

