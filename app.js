#!/usr/bin/node

require('colors');
var fs = require('fs');
var sys = require('sys');
var exec = require('child_process').exec;
var async = require('async');
var Table = require('cli-table');

//listing current directory files
var pwd = process.env.PWD + '/';

var table = new Table({
	head: ['Clean', 'Repository', 'branch', 'Last commit by']
});

var fileList = fs.readdirSync('.');
// filtering directories
fileList = fileList.filter(isDirectory);

async.mapSeries(fileList, extractGitData, function(err, data){
	data.forEach(function(entry){
		if (entry.success) {
			table.push(entry.data);
		}
	});

	if ( ! table.length){
		console.error('No git repository found as child of current folder.');
	} else {
		console.log(table.toString());
	}
});


function isDirectory(dirName){
	return fs.statSync(dirName).isDirectory();
}

function extractGitData(dirName, callback){
	isGitRepository(dirName, function(isGit){
		if (isGit){
			async.parallel([
				function(callback){
					isCleanRepository(dirName, callback);
				},
				function(callback){
					// Adding folder name to the output table here.
					// That way, we can change it to whatever we want later (git project name, ...)
					callback(null, dirName);
				},
				function(callback){
					resolveCurrentBranch(dirName, callback);
				},
				function(callback){
					lastCommitUser(dirName, callback);
				}
			],
			function(err, results){
				var result = {success:true, data:results};
				callback(null, result);
			});
		} else {
			callback(null, {success:false});
		}
	});
}

function isGitRepository(dirName, callback){
	exec('cd ' + pwd + dirName + ' && git status -sb ', function(error, stdout, stderr){
		callback( !error );
	});
}

function isCleanRepository(dirName, callback){
	exec('cd ' + pwd + dirName + ' && git status -s', function(error, stdout, stderr){

		callback( error, stdout.length == 0 ? '  Y  '.green : '  N  '.red);
	});
}
function resolveCurrentBranch(dirName, callback){
	exec('cd ' + pwd + dirName + ' && git status -sb', function(error, stdout, stderr){
		if (error) {
			callback(error, null);
		} else {
			var currentBranch = stdout.split('\n')[0].substring(3).trim();
			if (currentBranch != 'master'){
				currentBranch = currentBranch.blue;
			}
			callback( null, currentBranch );
		}
	});
}
function lastCommitUser(dirName, callback){
	exec('cd ' + pwd + dirName + ' && git log -n 1', function(error, stdout, stderr){
		if (error) {
			callback(error, 'no commit?'.red);
		} else {
			resolveCurrentUserMail(dirName, function(error, userMail){
				var secondLine = stdout.split('\n').length > 1 ? stdout.split('\n')[1] : '';
				var authorMail = secondLine.split('<').length > 1 ? stdout.split('<')[1].split('>')[0].trim() : '';
				if (userMail == authorMail) {
					authorMail = authorMail.green;
				}
				callback( null, authorMail );
			});
		}
	});
}

function resolveCurrentUserMail(dirName, callback){
	exec('cd ' + pwd + dirName + ' && git config --get user.email', function(error, stdout, stderr){
		callback(error, stdout.trim());
	});
}
