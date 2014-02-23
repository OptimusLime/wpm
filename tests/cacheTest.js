var assert = require("assert");
var fs = require('fs-extra');
var fstream = require('fstream');
var path = require('path');

var should = require('should');
var gCache = require('../utils/cache.js')

var testDir = __dirname + "/tmp/";
var testLocation = function(desired)
{
	return path.join(testDir + desired);
}


describe('Tarballs', function() {
	describe('Tar and untar', function() {

		it('should tar file then untar file successfully', function(done) {

			var testString = "Hello world. Watch the magic trick! \n";

			var test1DirName = "test1";
			var test1FileName = testLocation(test1DirName + "/testString");


			var test1Dir = testLocation(test1DirName);
			var outfile = testLocation(test1DirName + ".tar.gz");

			console.log('temp dir: ', test1Dir);

			var writer = fstream
				.Writer({
					path: test1FileName
				});

			writer.on("ready", function() {
				writer.write(testString);
				writer.end();
			})

			writer.on("close", function() {

				//no write error, lets' continue

				console.log('Writing ended');
				//test1 dir should exist, so let's tar the whole thing -- no filtering
				gCache.qCreateTarball(test1Dir, outfile)
					.then(function()
					{
						console.log('Finished tarring...');
						//let's remove the test directory (so it may be untarred to the same place)
						var sync = fs.removeSync(test1Dir);

						//unzipe our outputted file
						//and save it to a test directory
						return gCache.qUntar(outfile, test1Dir);
					})
					.done(function() {
						//finished with tarring and untarring
						console.log('Done tarring/untarring');

						//now we need to extract the file
						var readFile = fs.readFileSync(test1FileName);

						console.log("Read in: ", readFile.toString());

						//testing goes here
						//test that they are equal
						testString.should.equal(readFile.toString());

						//if we made it this far, we should clean up after ourselves
						fs.removeSync(test1Dir);
						fs.removeSync(outfile);

						done();
					}, function(err) {
						throw err;
					})
			})

		})
	})
})