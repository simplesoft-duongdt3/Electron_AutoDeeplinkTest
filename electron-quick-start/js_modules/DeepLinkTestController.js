module.exports = function (rootPathApp) {
    this.rootPathApp = rootPathApp;
    this.configDeeplinkTest = null;
    this.environmentVars = null;
    this.deviceSelected = null;

    var adb = require('./adb');
    const mockServerNode = require('mockserver-node');
    const mockServerClient = require('mockserver-client');
    const path = require('path');
    const fs = require('fs');

    this.readConfigFile = function (configFileName) {
        const configPathApp = path.resolve(`${rootPathApp}/configs`);
        let rawdata = fs.readFileSync(`${configPathApp}/${configFileName}`, 'utf8');
        
        this.configDeeplinkTest = JSON.parse(rawdata);

        let envVarsdata = fs.readFileSync(`${configPathApp}/env_vars/env_vars`, 'utf8');
        this.environmentVars = JSON.parse(envVarsdata);
    }

    this.setDeviceSelected = function (deviceSelected) {
        this.deviceSelected = deviceSelected;
        console.log("deviceSelected init " + this.deviceSelected);
    }

    this.getConfigFiles = function () {
        const configPathApp = path.resolve(`${rootPathApp}/configs`);
        console.log(`getConfigFiles $configPathApp`)
        const files = fs.readdirSync(configPathApp, {
            withFileTypes: true,
        }).filter(fileEnt => fileEnt.isFile())
            .map(fileEnt => fileEnt.name);
        return files
    }


    this.clearConfigDeeplinkTest = function () {
        this.configDeeplinkTest = null
    }


    function mergeEnvironments(text, environmentVars) {
        var textNew = text;
        console.log("mergeEnvironments " + textNew);
        environmentVars.environmentVars.forEach(element => {
            textNew = textNew.replace(new RegExp(`\\$ENV\\{${element.key}\\}`, "g"), element.value);
        });

        return textNew;
    }

    var AndroidDevice = function (id, type) {
        this.id = id;
        this.type = type;
    };

    function getAdbPath() {
        var adbPath = rootPathApp + "\\adb\\";
        console.log("adbPath " + adbPath);
        return adbPath;
    }

    function parseDevices(data) {
        var lines = data.toString().split('\n');
        var devices = [];

        for (var i = 0; i < lines.length; i++) {
            var o = lines[i].split('\t');

            if (o.length == 2) {
                devices.push(new AndroidDevice(o[0], o[1]));
            }
        }

        return devices;
    }

    this.getAdbDevices = function () {
        var result = adb.callAdbSync(getAdbPath(), {
            cmd: ['devices']
        });
        return parseDevices(result);
    }

    async function resetAndAddMockServerRules(mockServerClientLocal, mockserverConfigs, environmentVars) {
        await mockServerClientLocal.reset();

        console.log("mockServerClient reset all state");

        mockserverConfigs.forEach(async (mockserverConfig) => {
            var requestConfigdata = fs.readFileSync(`${rootPathApp}/${mockserverConfig.requestConfig}`, 'utf8');
            requestConfigdata = mergeEnvironments(requestConfigdata, environmentVars);

            var linesRequestConfig = requestConfigdata.match(/^.*([\n\r]+|$)/gm);
            console.log("linesRequestConfig " + linesRequestConfig);
            var requestMethod = linesRequestConfig[0].trim();
            var requestPath = linesRequestConfig[1].trim();
            var requestBody = '';
            if (linesRequestConfig.length > 2) {
                requestBody = linesRequestConfig[2];
            }

            var responseConfigdata = fs.readFileSync(`${rootPathApp}/${mockserverConfig.responseConfig}`, 'utf8');
            responseConfigdata = mergeEnvironments(responseConfigdata, environmentVars);
            var linesResponseConfig = responseConfigdata.match(/^.*([\n\r]+|$)/gm);
            console.log("linesResponseConfig " + linesRequestConfig);
            var statusCode = parseInt(linesResponseConfig[0].trim());
            var timeResponse = parseInt(linesResponseConfig[1].trim());
            var responseBody = '';
            if (linesResponseConfig.length > 2) {
                linesResponseConfig.forEach((element, index) => {
                    if (index >= 2) {
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

    const TestCaseRunResult = {
        FOUND_ACTIVITY: "FOUND_ACTIVITY",
        MISSING_ACTIVITY: "MISSING_ACTIVITY",
        ERROR: "ERROR",
    }

    async function runTestCase(testCase, deviceSelected, adbPath, externalStoragePath, testCaseResultFolder, environmentVars) {
        var testCaseRunResult = TestCaseRunResult.ERROR
        try {
            //TODO run test case
            mockServerClientLocal = mockServerClient.mockServerClient("localhost", 9999)
            //1. clear all mock rules + add new mock rules
            await resetAndAddMockServerRules(mockServerClientLocal, testCase.mockserver_configs, environmentVars);
            //2. go home + start deeplink by adb 
            var resultHome = adb.callAdbSync(adbPath, {
                deviceID: deviceSelected,
                cmd: [`shell input keyevent 3`]
            });

            await sleep(2000)

            console.log("go home " + resultHome)
            var encodeDeepLink = encodeURI(testCase.deeplink)
            encodeDeepLink = encodeDeepLink.replaceAll("&", "\\&");
            console.log("encodeDeepLink " + encodeDeepLink)

            var resultStartDeeplink = adb.callAdbSync(adbPath, {
                deviceID: deviceSelected,
                cmd: [`shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "${encodeDeepLink}"`]
            });

            console.log(`start deeplink ${testCase.deeplink} ` + resultStartDeeplink)
            //2.1 Wait activity display

            await sleep(8000)
            var resultFindAcivity = adb.callAdbSync(adbPath, {
                deviceID: deviceSelected,
                cmd: [`shell dumpsys activity activities`]
            });
            console.log(`resultFindAcivity ` + resultFindAcivity)

            //TODO find activity
            var checkActivity = new RegExp(`(mResumedActivity: ActivityRecord).*(\\.${testCase.activity_name})`, "g")
            foundActivity = checkActivity.test(resultFindAcivity)
            if (foundActivity) {
                testCaseRunResult = TestCaseRunResult.FOUND_ACTIVITY
            } else {
                testCaseRunResult = TestCaseRunResult.MISSING_ACTIVITY
            }

            //3. capture screen
            var imagePathInDevice = `${externalStoragePath}/screencap.png`
            var resultTakeScreenshot = adb.callAdbSync(adbPath, {
                deviceID: deviceSelected,
                cmd: [`shell screencap -p ${imagePathInDevice}`]
            });

            console.log(`takeScreenshot ` + resultTakeScreenshot)
            var imgFileName = `${testCase.id}_screenshot.png`

            var resultPullScreenshot = adb.callAdbSync(adbPath, {
                deviceID: deviceSelected,
                cmd: [`pull ${imagePathInDevice} ${testCaseResultFolder}/${imgFileName}`]
            });

            console.log(`pullScreenshot ` + resultPullScreenshot)

            //4. record video
            //5. get record request, response
            var retrieveRecordedRequestsAndResponses = await mockServerClientLocal
                .retrieveRecordedRequestsAndResponses({})

            console.log("retrieveRecordedRequestsAndResponses " + JSON.stringify(retrieveRecordedRequestsAndResponses));

            await sleep(1000)
        } catch (error) {
            console.error("run test case error: " + error)
            testCaseRunResult = TestCaseRunResult.ERROR
        }

        return testCaseRunResult
    }

    async function runSelectedTestCases(configDeeplinkTest, deviceSelected, adbPath, rootPathApp, environmentVars) {
        var testcases = configDeeplinkTest.deeplinks
        console.log("runSelectedTestCases " + testcases);


        var resultExternalStoragePath = adb.callAdbSync(adbPath, {
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
            if (isRun) {
                var result = await runTestCase(testCase, deviceSelected, adbPath, resultExternalStoragePath.trim(), testCaseResultPathApp, environmentVars);
                //TODO log or save result
                console.log("runTestCase result: " + result)
            }
        }
        //addMockServerRules();

    }

    this.handleRun = async function () {
        var configDeeplinkTest = this.configDeeplinkTest
        var environmentVars = this.environmentVars
        var packageName = configDeeplinkTest.package_name
        var deviceSelected = configDeeplinkTest.deviceSelected
        var rootPathApp = configDeeplinkTest.rootPathApp
        var adbPath = getAdbPath()
        console.log(`handleRun ${packageName}  ${deviceSelected} ${adbPath}`)
        //0. Clear data app
        var result = adb.callAdbSync(adbPath, {
            deviceID: deviceSelected,
            cmd: [`shell`, `pm`, `clear`, `'${packageName}'`]
        });

        console.log("clearCmd result = " + result)

        mockServerNode.start_mockserver({
            serverPort: 9999,
            trace: true
        }).then(
            async function (result) {
                await runSelectedTestCases(configDeeplinkTest, deviceSelected, adbPath, rootPathApp, environmentVars);
            },
            function (error) {
                console.log("start_mockserver ERROR " + error)
            }
        );

    }

    function padZeroLead(textNum, size) {
        while (textNum.length < size) textNum = "0" + textNum;
        return textNum;
    }

}