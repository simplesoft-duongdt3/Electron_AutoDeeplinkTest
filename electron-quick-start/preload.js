// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

function rootPath() {
  return __dirname;
} 

var AndroidDevice = function (id, type) {
  this.id = id;
  this.type = type;
};


function parseDevices(data) {
  var lines = data.toString().split('\n');
  var devices = [];

  for (var i=0; i<lines.length; i++) {
      var o = lines[i].split('\t');

      if (o.length == 2) {
          devices.push(new AndroidDevice(o[0], o[1]));
      }
  }

  return devices;
}

function callAdb(adbPath, options, next) {
  var exec = require('child_process').spawn;

  var a = adbPath + 'adb';

  var cmd = options.cmd;

  if (typeof options.deviceID === 'string') {
      cmd.push('-s');
      cmd.push(options.deviceID);
  }

  var ls = exec(a, cmd);
  var useNext = false;
  ls.stdout.on('data', function (data) {
      useNext = true;
      next && next(data.toString());
  });

  ls.stderr.on('data', function (data) {
      //console.log(data.toString());
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

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  const rootPathApp = rootPath();
  initConfigCombobox(rootPathApp);
  initDeviceCombobox(rootPathApp);
})

function initDeviceCombobox(rootPathApp) {
  var deviceCombobox = document.getElementById("deviceCombobox");

  const adbPath = rootPathApp + "\\adb\\";
  callAdb(adbPath, {
    cmd: ['devices']
  }, function (result) {
    var devices = parseDevices(result);
    console.log(devices);

    var i;
    for (i = 0; i < devices.length; i++) {
      var option = document.createElement("option");
      option.text = devices[i].id;
      deviceCombobox.add(option);
    }
  });
}

function initConfigCombobox(rootPathApp) {
  var configCombobox = document.getElementById("configCombobox");

  function onConfigComboboxChange() {
    console.log("configCombobox onchange " + configCombobox.value);
  }

  configCombobox.onchange = function() {
    onConfigComboboxChange();
  };

  const path = require('path');
  const configPathApp = path.resolve(`${rootPathApp}/configs`);

  const fs = require('fs');
  const files = fs.readdirSync(configPathApp, {
    withFileTypes: true,
  }).filter(fileEnt => fileEnt.isFile())
    .map(fileEnt => fileEnt.name);

  var i;
  for (i = 0; i < files.length; i++) {
    var option = document.createElement("option");
    option.text = files[i];
    configCombobox.add(option);
  }

  if(files.length > 0) {
    onConfigComboboxChange();
  }
}
