// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

function rootPath() {
  return __dirname;
} 

class DeepLinkTestConfig {
  constructor(rootPathApp, configDeeplinkTest, environmentVars) {
    this.rootPathApp = rootPathApp;
    this.configDeeplinkTest = configDeeplinkTest;
    this.environmentVars = environmentVars;
  }

  mergeEnvironments(text) {
    var textNew = text;
    console.log("mergeEnvironments " + textNew);
    this.environmentVars.environmentVars.forEach(element => {
      textNew = textNew.replace(new RegExp(`\\$ENV\\{${element.key}\\}`, "g"), element.value);
    });
    
    return textNew;
  }
}

var deepLinkTestConfig = new DeepLinkTestConfig(null, null, null)

var AndroidDevice = function (id, type) {
  this.id = id;
  this.type = type;
};

const fs = require('fs');

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

var mockServerNode = require('mockserver-node');
var mockServerClient = require('mockserver-client');


function demoMockRequest() {
  mockServerClient.mockServerClient("localhost", 9999)
  .mockAnyResponse(
    {
        'httpRequest': {
            'method': 'POST',
            'path': '/somePath',
            'queryStringParameters': [
                {
                    'name': 'test',
                    'values': [ 'true' ]
                }
            ],
            'body': {
                'type': "STRING",
                'value': 'someBody'
            }
        },
        'httpResponse': {
            'statusCode': 200,
            'body': JSON.stringify({ name: 'value' }),
            'delay': {
                'timeUnit': 'MILLISECONDS',
                'value': 250
            }
        },
        'times': {
            'remainingTimes': 1,
            'unlimited': false
        }
    }
    )
    .then(
        function(result) {
            console.log("mockAnyResponse " + result)
        }, 
        function(error) {
          console.log("mockAnyResponse " + error)
        }
    );
}

async function resetAndAddMockServerRules(mockserverConfigs) {
  await mockServerClient.mockServerClient("localhost", 9999).reset();

  console.log("mockServerClient reset all state");

  mockserverConfigs.forEach(async (mockserverConfig) => {
    var requestConfigdata = fs.readFileSync(`${deepLinkTestConfig.rootPathApp}/${mockserverConfig.requestConfig}`, 'utf8');
    requestConfigdata = deepLinkTestConfig.mergeEnvironments(requestConfigdata);

    var linesRequestConfig = requestConfigdata.match(/^.*([\n\r]+|$)/gm);
    console.log("linesRequestConfig " + linesRequestConfig);
    var requestMethod = linesRequestConfig[0];
    var requestPath = linesRequestConfig[1];
    var requestBody = '';
    if(linesRequestConfig.length > 2) {
      requestBody = linesRequestConfig[2];
    }

    var responseConfigdata = fs.readFileSync(`${deepLinkTestConfig.rootPathApp}/${mockserverConfig.responseConfig}`, 'utf8');
    responseConfigdata = deepLinkTestConfig.mergeEnvironments(responseConfigdata);
    var linesResponseConfig = responseConfigdata.match(/^.*([\n\r]+|$)/gm);
    console.log("linesResponseConfig " + linesRequestConfig);
    var statusCode = parseInt(linesResponseConfig[0]);
    var timeResponse = parseInt(linesResponseConfig[1]);
    var responseBody = '';
    if(linesResponseConfig.length > 2) {
      linesResponseConfig.forEach((element, index) => {
        if(index >= 2) {
        responseBody += element;
        }
      });
    }

    console.log("responseBody " + responseBody);

    await mockServerClient.mockServerClient("localhost", 9999)
      .mockAnyResponse(
        {
            'httpRequest': {
                'method': requestMethod,
                'path': requestPath,
                'body': {
                    'type': "STRING",
                    'value': requestBody
                }
            },
            'httpResponse': {
                'statusCode': statusCode,
                'body': responseBody,
                'delay': {
                    'timeUnit': 'MILLISECONDS',
                    'value': timeResponse
                }
            }
        }
        );
  });
}

async function runTestCase(testCase) {
  await resetAndAddMockServerRules(testCase.mockserver_configs);
 //TODO run test case
 //1. clear all mock rules + add new mock rules
 
 //2. start deeplink by adb 
 //3. capture screen
 //4. record video
 //5. clear mock rules
}

async function runSelectedTestCases() {
  var testcases = deepLinkTestConfig.configDeeplinkTest.deeplinks
  console.log("runSelectedTestCases " + testcases);
  
  testcases.forEach(testCase => {
      var isRun = document.getElementById(`config_item_${testCase.id}`).checked == true;
      if(isRun) {
          runTestCase(testCase);
      }
  });
  //addMockServerRules();

}

async function handleRun() {
  
  mockServerNode.start_mockserver({
    serverPort: 9999,
    trace: true
  }).then(
    async function(result) {
        runSelectedTestCases();
    }, 
    function(error) {
      console.log("start_mockserver ERROR " + error)
    }
  );

}

window.addEventListener('DOMContentLoaded', async () => {

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  const rootPathApp = rootPath();
  deepLinkTestConfig.rootPathApp = rootPathApp;

  initConfigCombobox(rootPathApp);
  initDeviceCombobox(rootPathApp);
  
  const btRunDeeplinkTest = document.getElementById("btRunDeeplinkTest");
  btRunDeeplinkTest.onclick = async function() {
        handleRun();
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


  function populateConfigItems() {
    deepLinkTestConfig.configDeeplinkTest.deeplinks.forEach((item, index) => {
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
    deepLinkTestConfig.configDeeplinkTest = null;
    clearConfigItems();
    
    let rawdata = fs.readFileSync(`${configPathApp}/${configCombobox.value}`, 'utf8');
    
    deepLinkTestConfig.configDeeplinkTest = JSON.parse(rawdata);

    let envVarsdata = fs.readFileSync(`${configPathApp}/env_vars/env_vars`, 'utf8');
    deepLinkTestConfig.environmentVars = JSON.parse(envVarsdata);
    populateConfigItems();
  }

  configCombobox.onchange = function() {
    onConfigComboboxChange();
  };

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
