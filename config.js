var globalConfig = {fileName: 'wpm_cf.json', packageMapFile: 'wpm_packages.json'};
var fs = require('fs-extra');
var path = require('path');
var cuid = require('cuid');
// var semver = require('semver');

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

///////////////////////////////////////////////////////
//Everything to do with package cache locations locally -- where things are temporarily stored
//TODO: Make this a cache object on it's own (then you could also do the same for current user -- as the same type of object)

var currentPublish;
globalConfig.setActivePublish = function(repository, userName, packageName, packageVersion)
{
	currentPublish = {repoName: repository, userName:userName, packageName: packageName, packageVersion:packageVersion};
}
globalConfig.getActivePublish = function()
{
	return currentPublish;
} 

//What about retrievals? Can have many active retrievals
//need to keep all of them known
var activeRetrieval = {};

var retrievalName = function(rInfo)
{
	return rInfo.repoName + "/" + rInfo.userName + "/" + rInfo.packageName + "/" + rInfo.packageVersion;
}
globalConfig.addActiveRetrieval = function(rInfo)
{
	activeRetrieval[retrievalName(rInfo)] = rInfo;
}

globalConfig.allActiveRetrievals = function()
{
	var all = [];
	for(var key in activeRetrieval)
		all.push(activeRetrieval[key]);

	return all;
}
globalConfig.removeActiveRetrieval = function(rInfo)
{
	var key = retrievalName(rInfo);
	delete activeRetrieval[key];
}


globalConfig.getPackageMapName = function(packageInfo)
{
	return packageInfo.repoName + "/" +  packageInfo.userName + "/" + packageInfo.packageName + "@" + packageInfo.packageVersion;
}

globalConfig.getOrCreatePackageMap = function()
{
	if(globalConfig.packageMap == undefined)
	{
		try
		{
			var packageMap = fs.readJSONSync(path.resolve(__dirname, './' + globalConfig.packageMapFile));

			console.log(packageMap);
			// console.log(packageMap[packageLocations]);

			//already parsed json is loaded into the package map
			globalConfig.packageMap = packageMap;
		}	
		catch(e)
		{
			//we hit an error, if the file doesn't exist or something
			//jsut overwrite it!
			var file = {packageLocations:{}};
			//this will set our config object as well as writing to file
			globalConfig.syncSavePackageMap(file);
		}	
	}

	return globalConfig.packageMap;
}
globalConfig.syncSavePackageMap = function(obj)
{
	try{
		var err = fs.outputJSONSync(path.resolve(__dirname, './' + globalConfig.packageMapFile), obj);
	}
	catch(e)
	{
		//error writing packageMap
		console.log('Error writing global config!', e);
		throw e;
	}

	globalConfig.packageMap = obj;
}

globalConfig.getPackageLocation = function(packageInfo)
{
	//check for any information 
	var pMap =  globalConfig.getOrCreatePackageMap();

	//use the repository, username, packagename, and version
	var pName = globalConfig.getPackageMapName(packageInfo);

	return pMap.packageLocations[pName];
}

globalConfig.setPackageLocation = function(packageInfo, locationInformation)
{
	//check for any information 
	var pMap =  globalConfig.getOrCreatePackageMap();

	//use the repository, username, packagename, and version
	var pName = globalConfig.getPackageMapName(packageInfo);

	var mapped = pMap.packageLocations[pName];
	if(mapped && mapped.directory != packageInfo.directory)
	{
		throw new Error("Colliding packages! Package being cached overwrites " + 
			"another package cache. Rare that this happens -- probably publishing and retrieving the same package");
	}

	pMap.packageLocations[pName] = locationInformation;
	globalConfig.syncSavePackageMap(pMap);
}

globalConfig.removePackageLocation = function(packageInfo)
{
	//check for any information 
	var pMap =  globalConfig.getOrCreatePackageMap();

	//use the repository, username, packagename, and version
	var pName = globalConfig.getPackageMapName(packageInfo);

	delete pMap.packageLocations[pName];

	globalConfig.syncSavePackageMap(pMap);
}

//////////////////////////////////////////////
//Storing current repository information

var repositories = 
{
	"wpm" : {url: "http://localhost:3000", type: "wpm-local"}
};
var currentRepo = "wpm";

//tell us what repository we're subscribed to
globalConfig.getCurrentRepository = function()
{
	//just fetch current repo named now (default)
	var repo = repositories[currentRepo];

	//add the name in the return information
	repo.name = currentRepo;

	//return the repo info
	return repo;
}	

//Get information about a particular repository given a name
globalConfig.getRepository = function(repoName)
{
	return repositories[repoName];
}






