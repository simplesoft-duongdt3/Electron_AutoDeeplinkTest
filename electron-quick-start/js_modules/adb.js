// https://www.stanleyulili.com/node/node-modules-import-and-use-functions-from-another-file/

function callAdb(adbPath, options, next) {
    var exec = require('child_process').spawn;

    var a = adbPath + 'adb.exe';

    var cmd = options.cmd;

    if (typeof options.deviceID === 'string') {
        cmd.unshift("-s", options.deviceID)
    }

    var ls = exec(`${a}`, cmd);
    var useNext = false;
    ls.stdout.on('data', function (data) {
        console.log("stdout " + data.toString());
        useNext = true;
        next && next(data.toString());
    });

    ls.stderr.on('data', function (data) {
        console.log("stderr " + data.toString());
    });

    ls.on('exit', function () {
        if (typeof next === 'function') {
            if (useNext === false) {
                setTimeout(function () {
                    next();
                }, 200);
            }
        }
    });
    return ls;
};

function callAdbSync(adbPath, options) {
    const { execSync } = require('child_process');

    var a = adbPath + 'adb.exe';

    var cmd = options.cmd;

    if (typeof options.deviceID === 'string') {
        cmd.unshift("-s", options.deviceID)
    }

    var cmdRun = cmd.join(" ");
    var ls = execSync(`${a} ${cmdRun}`, { encoding: 'utf8', timeout: 10000 });
    return ls;
};

module.exports = { callAdb, callAdbSync }