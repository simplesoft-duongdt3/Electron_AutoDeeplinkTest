module.exports = function (listTag) {
    this.listTag = listTag;

    this.log = function (tag, msgLog) {
        const isTagContain = (element) => element == tag;
        var canLog = array1.findIndex(isTagContain) >= 0;
        if(canLog) {
            console.log(msgLog)
        }
    }
}