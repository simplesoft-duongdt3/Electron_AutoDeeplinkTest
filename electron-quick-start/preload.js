// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

function rootPath() {
  return __dirname;
} 

var configDeeplinkTest = null;

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
  
  const btRunDeeplinkTest = document.getElementById("btRunDeeplinkTest");
  btRunDeeplinkTest.onclick = function() {
        console.log(configDeeplinkTest);
  };
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
  const path = require('path');
  const configPathApp = path.resolve(`${rootPathApp}/configs`);

  var configCombobox = document.getElementById("configCombobox");
  var configItemsTable = document.getElementById("configItemsTable");

  var cbAllConfigTop = document.getElementById("cbAllConfigTop");
  var cbAllConfigBottom = document.getElementById("cbAllConfigBottom");

  function updateAllCheckConfigItems(checked) {
    var items = document.getElementsByClassName("cbConfigItem");
    var size = items.length;
    for (i = 0; i < size; i++) {
      items[i].checked = checked;
    } 
  }

  cbAllConfigTop.onchange = function() {
    cbAllConfigBottom.checked = cbAllConfigTop.checked;
    updateAllCheckConfigItems(cbAllConfigTop.checked);
  };

  cbAllConfigBottom.onchange = function() {
    cbAllConfigTop.checked = cbAllConfigBottom.checked;
    updateAllCheckConfigItems(cbAllConfigBottom.checked);
  };


  function populateConfigItems(config) {
    config.deeplinks.forEach((item, index) => {
      var row = document.createElement("tr");

      var stt = document.createElement("td");
      var sttText = document.createTextNode(index + 1);
      stt.appendChild(sttText);
      row.appendChild(stt);

      var id = document.createElement("td");
      var idText = document.createTextNode(item.id);
      id.appendChild(idText);
      row.appendChild(id);

      var deeplink = document.createElement("td");
      var deeplinkText = document.createTextNode(item.deeplink);
      deeplink.appendChild(deeplinkText);
      row.appendChild(deeplink);     
      
      var status = document.createElement("td");
      var statusText = document.createTextNode("TODO");
      status.appendChild(statusText);
      row.appendChild(status); 

      var checkBox = document.createElement("td");
      checkBox.innerHTML = `<input id="config_item_${item.id}" type="checkbox" class="cbConfigItem"></input>`
      row.appendChild(checkBox); 

      configItemsTable.appendChild(row);

      row.onclick = function() {
        let checkBox = document.getElementById(`config_item_${item.id}`);
        checkBox.checked = !checkBox.checked;
      };
    });
  }

  function clearConfigItems() {
    configItemsTable.textContent = '';
  }

  function onConfigComboboxChange() {
    configDeeplinkTest = null;
    clearConfigItems();
    
    let rawdata = fs.readFileSync(`${configPathApp}/${configCombobox.value}`);
    
    configDeeplinkTest = JSON.parse(rawdata);
    populateConfigItems(configDeeplinkTest);
  }

  configCombobox.onchange = function() {
    onConfigComboboxChange();
  };

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
