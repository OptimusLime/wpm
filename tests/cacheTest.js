var assert = require("assert");
var fs = require('fs-extra');
var fstream = require('fstream');
var path = require('path');

var gCache = require('../utils/cache.js')

var testDir = __dirname + "/tmp/";
var testLocation = function(desired)
{
	return path.resolve(testDir + desired);
}


describe('Tarballs', function() {
	describe('Tar and untar', function() {

		it('should tar file then untar file successfully', function(done) {

			var testString = "Hello world. Watch the magic trick! \n";
			var testDirName = "test1";
			var test1Dir = testLocation(testDirName);
			var outfile = testLocation(testDirName + ".tar.gz");

			console.log('temp dir: ', test1Dir);

			var writer = fstream
				.Writer({
					path: testLocation(testDirName + "/testString")
				});

			writer.on("ready", function() {
				writer.write(testString);
				writer.end();
			})

			writer.on("close", function() {

				//no write error, lets' continue

				console.log('Writing ended');
				//test1 dir should exist, so let's tar the whole thing -- no filtering
				gCache.qCreateTarball(test1Dir, outfile, function() { return true;})
					.done(function() {
						//finished with tarring and untarring
						console.log('Done tarring');

						//let's remove the test directory (so it may be untarred to the same place)

						var sync = fs.removeSync(test1Dir);

						//testing goes here

						done();
					}, function(err) {
						throw err;
					})
			})

			



		})
	})
})