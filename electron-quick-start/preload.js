// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

function rootPath() {
  return __dirname;
} 

class DeepLinkTestConfig {
  constructor(rootPathApp, configDeeplinkTest, environmentVars, deviceSelected) {
    this.rootPathApp = rootPathApp;
    this.configDeeplinkTest = configDeeplinkTest;
    this.environmentVars = environmentVars;
    this.deviceSelected = deviceSelected;
  }

  mergeEnvironments(text) {
    var textNew = text;
    console.log("mergeEnvironments " + textNew);
    this.environmentVars.environmentVars.forEach(element => {
      textNew = textNew.replace(new RegExp(`\\$ENV\\{${element.key}\\}`, "g"), element.value);
    });
    
    return textNew;
  }

  getAdbPath() {
    var adbPath = this.rootPathApp + "\\adb\\";
    console.log("adbPath " + adbPath);
    return adbPath;
  }
}

var deepLinkTestConfig = new DeepLinkTestConfig(null, null, null, null)

var AndroidDevice = function (id, type) {
  this.id = id;
  this.type = type;
};

const path = require('path');
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

  var a = adbPath + 'adb.exe';

  var cmd = options.cmd;

  if (typeof options.deviceID === 'string') {
    cmd.unshift("-s", options.deviceID)
  }

  var cmdRun = cmd.join(" ");
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
  var exec = require('child_process').spawn;

  var a = adbPath + 'adb.exe';

  var cmd = options.cmd;

  if (typeof options.deviceID === 'string') {
    cmd.unshift("-s", options.deviceID)
  }

  var cmdRun = cmd.join(" ");
  var ls = execSync(`${a} ${cmdRun}`, {encoding: 'utf8', timeout: 10000});
  return ls;
};

var mockServerNode = require('mockserver-node');
var mockServerClient = require('mockserver-client');
const { execSync } = require('child_process');

function padZeroLead(textNum, size) {
  while (textNum.length < size) textNum = "0" + textNum;
  return textNum;
}

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
    var requestMethod = linesRequestConfig[0].trim();
    var requestPath = linesRequestConfig[1].trim();
    var requestBody = '';
    if(linesRequestConfig.length > 2) {
      requestBody = linesRequestConfig[2];
    }

    var responseConfigdata = fs.readFileSync(`${deepLinkTestConfig.rootPathApp}/${mockserverConfig.responseConfig}`, 'utf8');
    responseConfigdata = deepLinkTestConfig.mergeEnvironments(responseConfigdata);
    var linesResponseConfig = responseConfigdata.match(/^.*([\n\r]+|$)/gm);
    console.log("linesResponseConfig " + linesRequestConfig);
    var statusCode = parseInt(linesResponseConfig[0].trim());
    var timeResponse = parseInt(linesResponseConfig[1].trim());
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
                "headers": [
                  {
                      "name": "Content-Type",
                      "values": ["application/json; charset=utf-8"]
                  }
              ],
                'delay': {
                    'timeUnit': 'MILLISECONDS',
                    'value': timeResponse
                }
            }
        }
        );
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

async function runTestCase(index, testCase, deviceSelected, adbPath, externalStoragePath, testCaseResultFolder) {
 //TODO run test case
 //1. clear all mock rules + add new mock rules
 await resetAndAddMockServerRules(testCase.mockserver_configs);
 //2. go home + start deeplink by adb 
 var resultHome = callAdbSync(adbPath, {
  deviceID: deviceSelected,
  cmd: [`shell input keyevent 3`]
});

await sleep(2000)

console.log("go home " + resultHome)
 var resultStartDeeplink = callAdbSync(adbPath, {
  deviceID: deviceSelected,
  cmd: [`shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "${testCase.deeplink}"`]
});
 
console.log(`start deeplink ${testCase.deeplink} ` + resultStartDeeplink)
//2.1 Wait activity display

await sleep(8000)
var resultFindAcivity = callAdbSync(adbPath, {
  deviceID: deviceSelected,
  cmd: [`shell dumpsys activity activities`]
});
console.log(`resultFindAcivity ` + resultFindAcivity)

 //3. capture screen
var imagePathInDevice = `${externalStoragePath}/screencap.png`
var resultTakeScreenshot = callAdbSync(adbPath, {
  deviceID: deviceSelected,
  cmd: [`shell screencap -p ${imagePathInDevice}`]
});

console.log(`takeScreenshot ` + resultTakeScreenshot)
var numIndexPaddingZero = padZeroLead((index + 1).toString(), 3)
var imgFileName = `${numIndexPaddingZero}_${testCase.id}_screenshot.png`

var resultPullScreenshot = callAdbSync(adbPath, {
  deviceID: deviceSelected,
  cmd: [`pull ${imagePathInDevice} ${testCaseResultFolder}/${imgFileName}`]
});

console.log(`pullScreenshot ` + resultPullScreenshot)

 //4. record video
 //5. clear mock rules
}

async function runSelectedTestCases(deviceSelected, adbPath, rootPathApp) {

  var testcases = deepLinkTestConfig.configDeeplinkTest.deeplinks
  console.log("runSelectedTestCases " + testcases);
  
  
  var resultExternalStoragePath = callAdbSync(adbPath, {
    deviceID: deviceSelected,
    cmd: [`shell echo $EXTERNAL_STORAGE`]
  });

  console.log("resultExternalStoragePath " + resultExternalStoragePath)

  let nowMilis = Date.now();
  var testCaseResultFolder = "deeplink_test_" + nowMilis;
  if (!fs.existsSync(testCaseResultFolder)) {
    fs.mkdirSync(testCaseResultFolder)
  }


  const testCaseResultPathApp = path.resolve(`${rootPathApp}/${testCaseResultFolder}`);

  for (let index = 0; index < testcases.length; index++) {
    const testCase = testcases[index];
    var isRun = document.getElementById(`config_item_${testCase.id}`).checked == true;
      if(isRun) {
        await runTestCase(index, testCase, deviceSelected, adbPath, resultExternalStoragePath.trim(), testCaseResultPathApp);
      }
  }
  //addMockServerRules();

}

async function handleRun(packageName, adbPath, deviceSelected, rootPathApp) {
  console.log(`handleRun ${packageName}  ${deviceSelected} ${adbPath}`)
    //0. Clear data app
    var result = callAdbSync(adbPath, {
      deviceID: deviceSelected,
      cmd: [`shell`, `pm` , `clear`, `'${packageName}'`]
    });

    console.log("clearCmd result = " + result)

    mockServerNode.start_mockserver({
      serverPort: 9999,
      trace: true
    }).then(
      async function(result) {
          await runSelectedTestCases(deviceSelected, adbPath, rootPathApp);
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
        handleRun(deepLinkTestConfig.configDeeplinkTest.package_name, deepLinkTestConfig.getAdbPath(), deepLinkTestConfig.deviceSelected, deepLinkTestConfig.rootPathApp);
  };
})

function initDeviceCombobox(rootPathApp) {
  var deviceCombobox = document.getElementById("deviceCombobox");
  deviceCombobox.innerHTML = '';
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

    deepLinkTestConfig.deviceSelected = deviceCombobox.value;
    console.log("deviceSelected init " + deepLinkTestConfig.deviceSelected);
  });

  deviceCombobox.onchange = function() {
    deepLinkTestConfig.deviceSelected = deviceCombobox.value;
    console.log("deviceSelected " + deepLinkTestConfig.deviceSelected);
  };
}

function initConfigCombobox(rootPathApp) {
  const configPathApp = path.resolve(`${rootPathApp}/configs`);

  var configCombobox = document.getElementById("configCombobox");
  var configItemsTable = document.getElementById("configItemsTable");

  var cbAllConfigTop = document.getElementById("cbAllConfigTop");
  var cbAllConfigBottom = document.getElementById("cbAllConfigBottom");

  deviceCombobox.innerHTML = '';
  
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
