var callRemote = function(url, cb) {      
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {    
            cb(xhr.responseText);            
        }
    }
    xhr.send();
}


if (!window.adobeHdsHlsVideoSaver) {
    window.adobeHdsHlsVideoSaver = {};
}
let exports = window.adobeHdsHlsVideoSaver;

exports.saveData = function (blob, fileName) {
    var a = document.createElement("a");
    document.getElementById('hlsLinks').appendChild(a);
    a.style = "display: none";
    url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName + '.ts';
    a.target = '_BLANK';
    a.click();
    window.URL.revokeObjectURL(url);
};

exports.downloadSlices = function(opt) {
    
    updateHTML.clearProgressBars();
    
    const AUDIO_FILE_NAME = 'audio.aac';
    const VIDEO_FILE_NAME = 'video.ts';
    const SUBTITLE_FILE_NAME = 'subtitles.srt';
    
    let url = opt.url; //, slices = opt.slices, mySlices = slices[url];
    let type = opt.type;
    var myBlobBuilder = new MyBlobBuilder();
    var requestsCount = 0;
    var retryCounts = [];
    var xhr = [];  
    var mySlices = [];
    
    updateHTML.clearProgressPanel();
    
    
    callRemote(url, function(response) {
        
        var reg = /#EXTINF:.+(?:\n|\r\n)(.+)/gi;
        var match = reg.exec(response);
        
        while(match != null) {
            
            var vidURL;
            if (match[1].indexOf('http://') != -1 || match[1].indexOf('https://') != -1) { 
                vidURL = match[1];
            }
            else {
                vidURL = url.substring(0, url.lastIndexOf('/')) + '/' + match[1];
            }
            
             
            mySlices.push(vidURL);
            match = reg.exec(response);
        }
        
        updateHTML.showProgressWindow(mySlices.length);
    
        for (var i = 0; i < mySlices.length; i++) {
            downloadSlice(i);
        }
        
    });

    function downloadSlice(i) {
        function handleErr(i) {
            const RETRY_LIMIT = 5;
            updateHTML.errorProgressBar(i+1);
            if (retryCounts[i] > RETRY_LIMIT)
                return false;
            else {
                setTimeout(downloadSlice.bind(null, i), 2000);
                retryCounts[i] = retryCounts[i] ? retryCounts[i]+1 : 1;
                return true;
            }
        }
        xhr[i] = new XMLHttpRequest();
        xhr[i].open("GET", mySlices[i], true);
        xhr[i].onreadystatechange = function() {
            if (xhr[i].readyState == 4) {
                if (xhr[i].status == 200) {
                    console.log(`Done, ts index: ${i}, ts url ${mySlices[i]}`);
                    let fullDownload = Number.isInteger(xhr[i].total) &&
                        xhr[i].loaded === xhr[i].total;
                    if (!fullDownload) {
                        console.log('Length mismatch', xhr[i].total, xhr[i].loaded);
                        if (handleErr(i))
                            return;
                    }
                    updateHTML.successProgressBar(i+1);
                    myBlobBuilder.append(xhr[i].response, i);
                } else {
                    console.log(`Failed, ts index: ${i}, ts url ${mySlices[i]}`);
                    console.log('Failed', xhr[i].total, xhr[i].loaded, xhr[i]);
                    // if it failed but we decide not to retry, just increment count
                    if (handleErr(i))
                        return;
                }
                requestsCount++;
                if (requestsCount === mySlices.length) {
                    myBlobBuilder.sort();
                    var bb = myBlobBuilder.getBlob("video/mp2t");
                    // all done
                    updateHTML.displayAllDone();
                    //exports.saveData(bb, "video");
                    let file_name = VIDEO_FILE_NAME;
                    if (type === 'audio')
                        file_name = AUDIO_FILE_NAME;
                    if (type === 'subtitle')
                        file_name = SUBTITLE_FILE_NAME;
                    download(bb, file_name); 
                }
            }
        };
        // update UI
        xhr[i].onprogress = function(e) {
            updateHTML.initProgressBar(e.total, e.loaded, i+1);
            xhr[i].total = e.total;
            xhr[i].loaded = e.loaded;
        };
        xhr[i].onloadstart = function(e) {
            updateHTML.startProgressBar(e, i+1);
            xhr[i].total = e.total;
        };
        xhr[i].onloadend = function(e) {
            if (e.loaded === 0 && e.total === 0)
                updateHTML.errorProgressBar(i+1);
            updateHTML.endProgressBar(e.loaded, i+1);
        };
        xhr[i].onerror = function(e) {
            updateHTML.initProgressBar(e.total, e.loaded, i+1);
        };
        xhr[i].responseType = "blob";
        xhr[i].send();
    }
};