var exec = require('child_process').exec;

var git = exports;

git.getCurrentBranch = function(dirName, callback){
    git.status(dirName, function(error, status){
        var branch;
        if( ! error ){
            branch = status.split('\n')[0].substring(3).trim();
        }
        callback(error, branch);
    });
};
    
git.getConfiguredEmail = function(dirName, callback){
    git.run(dirName, 'config --get user.email', function(error, stdout, stderr){
        callback(error, stdout.trim());
    });
};
    
var _cachedStatus = {};
git.status = function(dirName, callback){
    if(_cachedStatus[dirName]){
        callback(null, _cachedStatus[dirName]);
        return;
    }
    git.run(dirName, 'status -sb ', function(error, stdout, stderr){
        if( ! error){
            _cachedStatus[dirName] = stdout;
        }
        callback(error, stdout);
    });
};

git.run = function(dirName, cmd, callback){
    var pwd = process.env.PWD + '/';
    exec('cd ' + pwd + dirName + ' && git ' + cmd, callback);
};
