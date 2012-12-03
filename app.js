#!/usr/bin/node

require('colors');
var fs = require('fs');
var exec = require('child_process').exec;
var async = require('async');
var Table = require('cli-table');

var git = {
	getCurrentBranch : function(dirName, callback){
		git.status(dirName, function(error, status){
			var branch;
			if( ! error ){
				branch = status.split('\n')[0].substring(3).trim();
			}
			callback(error, branch);
		});
	},
	getConfiguredEmail : function(dirName, callback){
		git.run(dirName, 'config --get user.email', function(error, stdout, stderr){
			callback(error, stdout.trim());
		});
	},
	_cachedStatus : {},
	status : function(dirName, callback){
		if(git._cachedStatus[dirName]){
			callback(null, git._cachedStatus[dirName]);
			return;
		}
		git.run(dirName, 'status -sb ', function(error, stdout, stderr){
			if( ! error){
				git._cachedStatus[dirName] = stdout;
			}
			callback(error, stdout);
		});
	},
	run : function(dirName, cmd, callback){
		var pwd = process.env.PWD + '/';
		exec('cd ' + pwd + dirName + ' && git ' + cmd, callback);
	}
};


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
	git.status(dirName, function(error){
		callback(!error);
	});
}

function isCleanRepository(dirName, callback){
	git.status(dirName, function(error, status){
		var nbLines = status.split('\n').length;
		// 2 lines == branch info + new line
		// more lines == previous + changed/untracked files
		callback( error, nbLines == 2 ? '  Y  '.green : '  N  '.red);
	});
}
function resolveCurrentBranch(dirName, callback){
	git.getCurrentBranch(dirName, function(error, branch){
		if (branch != 'master'){
			branch = branch.blue;
		}
		callback( error, branch );
	});
}
function lastCommitUser(dirName, callback){
	git.run(dirName, 'log -n 1', function(error, stdout, stderr){
		if (error) {
			callback(error, 'no commit?'.red);
		} else {
			git.getConfiguredEmail(dirName, function(error, userMail){
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
