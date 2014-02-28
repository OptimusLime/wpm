var path = require('path');
var genericInstall = {};

module.exports = genericInstall;

genericInstall.getInstallDirectory = function(currentDirectory, parameters, moduleInfo)
{
			// console.log("Getinstall dl".cyan, downloadInfo)
	return path.resolve(currentDirectory + "/win_modules/encodings/" + moduleInfo.userName + "-" + moduleInfo.packageName);
}


