// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

function rootPath() {
  return __dirname;
}


var DeepLinkTestController = require('./js_modules/DeepLinkTestController');

var deepLinkTestController = new DeepLinkTestController(rootPath())

window.addEventListener('DOMContentLoaded', async () => {

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }

  initConfigCombobox();
  initDeviceCombobox();

  const btRunDeeplinkTest = document.getElementById("btRunDeeplinkTest");
  btRunDeeplinkTest.onclick = async function () {
    deepLinkTestController.handleRun();
  };
  const btRefreshDevices = document.getElementById("btRefreshDevices");
  btRefreshDevices.onclick = async function () {
    initDeviceCombobox();
  };


})

function initDeviceCombobox() {
  var deviceCombobox = document.getElementById("deviceCombobox");

  deviceCombobox.innerHTML = '';
  var devices = deepLinkTestController.getAdbDevices();
  console.log(devices);

  var i;
  for (i = 0; i < devices.length; i++) {
    var option = document.createElement("option");
    option.text = devices[i].id;
    deviceCombobox.add(option);
  }

  deepLinkTestController.setDeviceSelected(deviceCombobox.value);

  deviceCombobox.onchange = function () {
    deepLinkTestController.setDeviceSelected(deviceCombobox.value);
  };
}

function initConfigCombobox() {

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

  cbAllConfigTop.onchange = function () {
    cbAllConfigBottom.checked = cbAllConfigTop.checked;
    updateAllCheckConfigItems(cbAllConfigTop.checked);
  };

  cbAllConfigBottom.onchange = function () {
    cbAllConfigTop.checked = cbAllConfigBottom.checked;
    updateAllCheckConfigItems(cbAllConfigBottom.checked);
  };


  function populateConfigItems() {
    deepLinkTestController.configDeeplinkTest.deeplinks.forEach((item, index) => {
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

      row.onclick = function () {
        let checkBox = document.getElementById(`config_item_${item.id}`);
        checkBox.checked = !checkBox.checked;
      };
    });
  }

  function clearConfigItems() {
    configItemsTable.textContent = '';
    cbAllConfigTop.checked = false
    cbAllConfigBottom.checked = false
  }

  function onConfigComboboxChange() {
    deepLinkTestController.clearConfigDeeplinkTest();
    clearConfigItems();

    deepLinkTestController.readConfigFile(configCombobox.value)
    populateConfigItems();
  }

  configCombobox.onchange = function () {
    onConfigComboboxChange();
  };

  const files = deepLinkTestController.getConfigFiles()
  var i;
  for (i = 0; i < files.length; i++) {
    var option = document.createElement("option");
    option.text = files[i];
    configCombobox.add(option);
  }

  if (files.length > 0) {
    onConfigComboboxChange();
  }
}
