/* global __dirname, require, module */

'use strict';

var util   = require('util'),
	path   = require('path'),
	fs     = require('fs'),
	yeoman = require('yeoman-generator'),
	rimraf = require('rimraf'),
	exec   = require('child_process').exec,
	config = require('./../config.js'),
	generatePassword = require('password-generator'),
	request = require("request");

module.exports = Generator;

function Generator() {
	yeoman.generators.Base.apply(this, arguments);

	this.sourceRoot(path.join(__dirname, 'templates'));
}

util.inherits(Generator, yeoman.generators.NamedBase);

// get the latest stable version of Wordpress
Generator.prototype.getVersion = function getVersion() {
	var cb = this.async(),
		self = this,
		latestVersion = '3.5.1'; // we still store the latest version to avoid throwing error

	this.log.writeln('');
	this.log.writeln('Trying to get the latest stable version of Wordpress');
	self.latestVersion = latestVersion;

	// try to get the latest version using the git tags
	try {
		var version = exec('git ls-remote --tags git://github.com/WordPress/WordPress.git | tail -n 1',
			function(err, stdout, stderr) {
				if (err) {
					cb();
				}
				else {
					var pattern = /\d\.\d[\.\d]*/ig,
						match = pattern.exec(stdout);

					if (match !== null) {
						self.latestVersion = match[0];
						self.log.writeln('Latest version: '+self.latestVersion);
					}
				}

				cb();
			});
	}
	catch(e) {
		cb();
	}
};

// try to find the config file and read the infos to set the prompts default values
Generator.prototype.getConfig = function getConfig() {
	var cb   = this.async(),
		self = this;

	self.defaultAuthorName = '';
	self.defaultAuthorURI = '';
	self.defaultTheme = 'https://github.com/goodtwin/wordless-vanilla-theme';
	self.defaultPlugin = 'https://github.com/goodtwin/wordless/tarball/master';
	self.pluginName = 'wordless';
	self.randomPassword = generatePassword(10, false);
	self.configExists = false;

	request('https://api.wordpress.org/secret-key/1.1/salt',
		function(error, response, body){
			self.configSalt = body;
		});

	config.getConfig(function(err, data) {
		if (!err) {
			self.defaultAuthorName = data.authorName || '';
			self.defaultAuthorURI = data.authorURI || '';
			self.defaultTheme = data.theme || self.defaultTheme;

			if (data.authorName && data.authorURI && data.defaultTheme) {
				self.configExists = true;
			}
		}
		cb();
	});
};

Generator.prototype.askFor = function askFor() {
	var cb   = this.async(),
		self = this;

	/* jshint es5:true */
	var prompts = [{
				name: 'themeName',
				message: 'Name of the theme you want to use: ',
				default: 'mytheme'
			},
			{
				name: 'themeBoilerplate',
				message: 'Starter theme (please provide a github link): ',
				default: self.defaultTheme
			},
			{
				name: 'wordpressVersion',
				message: 'Which version of Wordpress do you want?',
				default: self.latestVersion
			},
			{
				name: 'authorName',
				message: 'Author name: ',
				default: self.defaultAuthorName
			},
			{
				name: 'authorURI',
				message: 'Author URI: ',
				default: self.defaultAuthorURI
			}];

	this.prompt(prompts, function(e, props) {
		if(e) {
			return self.emit('error', e);
		}

		// set the property to parse the gruntfile
		self.themeNameOriginal = props.themeName;
		self.themeName = props.themeName.replace(/\ /g, '').toLowerCase();
		self.themeOriginalURL = props.themeBoilerplate;
		self.themeBoilerplate = props.themeBoilerplate;
		self.wordpressVersion = props.wordpressVersion;
		//self.includeRequireJS = (/y/i).test(props.includeRequireJS)
		self.authorName = props.authorName;
		self.authorURI = props.authorURI;

		// check if the user only gave the repo url or the entire url with /tarball/{branch}
		var tarballLink = (/[.]*tarball\/[.]*/).test(self.themeBoilerplate);

		if (!tarballLink) {
			// if the user gave the repo url we add the end of the url. we assume he wants the master branch
			var lastChar = self.themeBoilerplate.substring(self.themeBoilerplate.length - 1);
			if (lastChar === '/') {
				self.themeBoilerplate = self.themeBoilerplate+'tarball/master';
			}
			else {
				self.themeBoilerplate = self.themeBoilerplate+'/tarball/master';
			}
		}

		// create the config file it does not exist
		if (!self.configExists) {
			var values = {
				authorName: self.authorName,
				authorURI:  self.authorURI,
				themeUrl:   self.themeOriginalURL
			};
			config.createConfig(values, cb);
		}
		else {
			cb();
		}
	});
};

// download the framework and unzip it in the project app/
Generator.prototype.createApp = function createApp() {
	var cb = this.async(),
		self = this;

	this.log.writeln('Let\'s download the framework, shall we?');
	this.log.writeln('Downloading Wordpress version '+self.wordpressVersion);
	this.tarball('https://github.com/WordPress/WordPress/tarball/'+self.wordpressVersion, 'app', cb);
};

// remove the basic theme and create a new one
Generator.prototype.createTheme = function createTheme() {
	var cb   = this.async(),
		self = this;

	this.log.writeln('First let\'s remove the built-in themes we will not use');

	// remove the existing themes
	fs.readdir('app/wp-content/themes', function(err, files) {
		if (typeof files != 'undefined' && files.length !== 0) {
			files.forEach(function(file) {
				var pathFile = fs.realpathSync('app/wp-content/themes/'+file),
					isDirectory = fs.statSync(pathFile).isDirectory();

				if (isDirectory) {
					rimraf.sync(pathFile);
					self.log.writeln('Removing ' + pathFile);
				}
			});
		}

		self.log.writeln('');
		self.log.writeln('Now we download the theme');

		// create the theme
		self.tarball(self.themeBoilerplate, 'app/wp-content/themes/'+self.themeName, cb);
	});
};

Generator.prototype.getPlugin = function getPlugin() {
	var cb   = this.async(),
		self = this;

	self.log.writeln('');
	self.log.writeln('Now we download the wordless plugin');

	// get wordless plugin  
	self.tarball(self.defaultPlugin, 'app/wp-content/plugins/'+self.pluginName, cb);
};

Generator.prototype.changeThemeName = function changeThemeName() {
  var cb   = this.async(),
    self = this,
    fileName = 'app/wp-content/themes/'+self.themeName+'/style.css',
    newName = fileName.substring(0, fileName.length - 3) + 'scss';

  fs.readFile(fileName, 'utf8', function (err, data) {
    if (err) throw err;
    // Insert the given theme name into style.css file, which we don't use. But Wordpress wants it. Cool.
    data = data.replace(/^.*Theme Name:.*$/mg, 'Theme Name: ' + self.themeNameOriginal);
    data = data.replace(/^.*Author: .*$/mg, 'Author: ' + self.authorName);
    data = data.replace(/^.*Author URI: .*$/mg, 'Author URI: ' + self.authorURI);

    fs.writeFile(fileName, data);
  });

  cb();
};

// generate the files to use Yeoman and the git related files
Generator.prototype.createYeomanFiles = function createYeomanFiles() {
	this.template('Gruntfile.js');
	this.template('bowerrc', '.bowerrc');
	this.template('wp-config.php', 'app/wp-config.php');
	this.template('package.json', 'package.json');
	this.template('bower.json', 'bower.json');
	this.copy('gitignore', '.gitignore');
	this.copy('gitattributes', '.gitattributes');
};

Generator.prototype.endGenerator = function endGenerator() {
	this.log.writeln('');
	this.log.writeln('Looks like we\'re done!');
	this.log.writeln('Now you just need to run `npm install && bower install` and `grunt wp-init`');
	this.log.writeln('Then you can start coding!');
	this.log.writeln('');
};
