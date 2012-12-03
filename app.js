#!/usr/bin/node

require('colors');
var fs = require('fs');
var async = require('async');
var Table = require('cli-table');
var options = require('commander');
var git = require('./git');

options
  .version('0.0.1')
  .option('-i, --ignore-clean', 'Ignore clean repositories')
  .parse(process.argv);

var table = new Table({
	head: ['Clean', 'Repository', 'Branch', 'Last commit by']
});

var dirList = fs.readdirSync('.').filter(isDirectory);

async.map(dirList, extractGitData, function(err, gitInfos){
	gitInfos.forEach(function(repoInfo){
		if (repoInfo) {
			if(options.ignoreClean && repoInfo.isClean){
				return; // ignore
			}
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
