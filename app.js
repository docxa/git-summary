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
	head: ['Clean', 'Repository', 'Branch', 'Last commit by']
});

var fileList = fs.readdirSync('.');
// filtering directories
fileList = fileList.filter(isDirectory);

async.map(fileList, extractGitData, function(err, gitInfos){
	gitInfos.forEach(function(repoInfo){
		if (repoInfo) {
			table.push(format(repoInfo));
		}
	});

	if ( ! table.length){
		console.error('No git repository found as child of current folder.');
	} else {
		console.log(table.toString());
	}
});

function format(repoInfo){
	var commitInfo = repoInfo.lastCommitInfo;
	var branch     = repoInfo.currentBranch;

	var cleanCell  = repoInfo.isClean ? '  Y  '.green : '  N  '.red;
	var nameCell   = repoInfo.dirName;
	var branchCell = branch == 'master' ? branch : branch.blue;
	var mailCell   = 'no commit?'.red;

	if (commitInfo){
		var author = commitInfo.authorMail;
		mailCell = commitInfo.configuredMail == author ? author.green : author;
	}

	return [
		cleanCell,
		nameCell,
		branchCell,
		mailCell
	];
}

function isDirectory(dirName){
	return fs.statSync(dirName).isDirectory();
}

function extractGitData(dirName, callback){
	isGitRepository(dirName, function(error, isGit){
		if (isGit){
			var gitInfo = {
				dirName : dirName
			};
			async.parallel([
				function(done){
					isCleanRepository(dirName, function(error, isClean){
						gitInfo.isClean = isClean;
						done();
					});
				},
				function(done){
					getCurrentBranch(dirName, function(error, branch){
						gitInfo.currentBranch = branch;
						done();
					});
				},
				function(done){
					getLastCommitInfo(dirName, function(error, commitInfo){
						gitInfo.lastCommitInfo = commitInfo;
						done();
					});
				}
			],
			function(err){
				callback(err, gitInfo);
			});
		} else {
			callback(null, null);
		}
	});
}

function isGitRepository(dirName, callback){
	git.status(dirName, function(error){
		callback(error, !error);
	});
}

function isCleanRepository(dirName, callback){
	git.status(dirName, function(error, status){
		var nbLines = status.split('\n').length;
		// 2 lines == branch info + new line
		// more lines == previous + changed/untracked files
		callback( error, nbLines == 2);
	});
}
function getCurrentBranch(dirName, callback){
	git.getCurrentBranch(dirName, callback);
}
function getLastCommitInfo(dirName, callback){
	git.run(dirName, 'log -n 1', function(error, stdout, stderr){
		if (error) {
			callback(error, null);
		} else {
			git.getConfiguredEmail(dirName, function(error, configuredMail){
				var secondLine = stdout.split('\n').length > 1 ? stdout.split('\n')[1] : '';
				var authorMail = secondLine.split('<').length > 1 ? stdout.split('<')[1].split('>')[0].trim() : '';
				callback( null, {
					authorMail     : authorMail,
					configuredMail : configuredMail
				});
			});
		}
	});
}
