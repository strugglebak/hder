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


var manifestUrls = {};
var urls = [];
var slices = {};
var videoType = "";

chrome.extension.onMessage.addListener(function(request, sender, send_response) {
    if (request.type === "urls") {
    	urls = request.value;        
	}
    if (request.type === "slices") {
    	slices = request.value;        
	}
    if (request.type === "manifestUrls") {
    	manifestUrls = request.value;        
	}
    
    if (request.type === "link") {
        if (request.value && request.value.indexOf('m3u8') !== -1) {
            readHLSManifest(request.value, function() {
                if (request.value !== '') 
                    send_response("read_manifest");
            });
        }
        else if (request.value && request.value.indexOf('f4m') !== -1) {
            processData(request.value, function() {
                if (request.value !== '') 
                    send_response("read_manifest");
            });
        }
    }
    return true; 
});



var processData = function(url, cb) {
    
    videoType = 'hds';
    let regex = /url="(.*?)"/gi;
    
    
    if (urls.indexOf(url) === -1) {           
       
        urls.push(url);
    
    
        var urlObj = new URL(url);        

        callRemote(url, function(resp) {
                    

            slices[url] = [];             

            var match = regex.exec(resp);
            //if (!match)
               // match = regex2.exec(resp);

            while(match != null) {
                // remove the first '/' in the matched url
                if (match[1] && match[1].indexOf('/') == 0)
                    match[1] = match[1].substr(1, match[1].length);


                var wholeURL;

                // if m3u8 contains fully functional urls, use them, otherwise combine the biggest part
                // of the details.url with what m3u8 contains
                // deal with possible overlay (when both details.url and match[1] contain same parts)
                if (match[1].indexOf('http://') != -1 || match[1].indexOf('https://') != -1) {
                    wholeURL = match[1];
                }
                else {
                    var firstURLPart = urlObj.origin;

                    var urlPartsArr = urlObj.pathname.split('/');
                    // last part not needed
                    urlPartsArr.pop();

                    var matchPartsArr = match[1].split('/');

                    for (var i = 0; i < urlPartsArr.length; i++) {
                        if (urlPartsArr[i] == "") continue;
                        if (urlPartsArr[i] != matchPartsArr[0]) {
                            firstURLPart += '/' + urlPartsArr[i];
                        }
                        else {
                            break;
                        }
                    }


                    wholeURL = firstURLPart + "/" + match[1];
                }

                slices[url].push(wholeURL);                    
                match = regex.exec(resp);
            }

            chrome.tabs.executeScript(null, {code: "var urls = " + urls + ", var slices = " + slices + ";"}, function() {
                chrome.storage.local.set({ 'slices': slices, 'videoType': videoType }, function() {  
                    cb();
                }); 
            });          

        });            
    }
};

var check_partial_include = function(key, url) {
    
    let correct_url_part;
    const arr_url = url.split("/");
    let ind;
    for (let i = 0; i < arr_url.length; i++) {
        if (arr_url[i] !== "") {
            ind = key.indexOf(arr_url[i]);
            if (ind !== -1) {
                correct_url_part = key.slice(0, ind);  
                break;
            }        
        }
    }
    return correct_url_part;
};


var util_replace_url = function(key, url_array) {
    
    let correct_url_part;
    let url_without_token;
    
    for (let i = 0; i < url_array.length; i++) {  
        
        url_without_token = url_array[i].url.match(/.+\.m3u8/)[0];
        
        if (url_without_token) {
            //var foundURLPart = urlObj.href.match(urlWithoutToken); 
            let ind = key.indexOf(url_without_token);

            if (ind !== -1) {
                correct_url_part = key.slice(0, ind);                                 
            }            
            // for dynamically created URLs (f.ex. https://www.tvr.bzh)
            else {
                // a special case for when key contains PARTIAL include of url_without_token
                // check for strings include by splitting strings into array and checking common parts
                correct_url_part = check_partial_include(key, url_without_token);
                    
                if (!correct_url_part)
                    correct_url_part = key.slice(0, key.lastIndexOf("/") + 1);
            }
            break;
        }

    }

    if (correct_url_part) {
        for (let j = 0; j < url_array.length; j++) {  
            if (url_array[j].isAudio || url_array[j].isSub) {
                for (let i = 0; len = url_array[j].value.length, i < len; i++) {
                    url_array[j].value[i].url = correct_url_part + url_array[j].value[i].url;
                }                
            }
            else {
                if (url_array[j].url.charAt(0) == "/")
                    url_array[j].url = url_array[j].url.slice(1);
                url_array[j].url = correct_url_part + url_array[j].url;
            }
        }
    }
};


var replacePartialURLs = function(manifestUrls) {   
        
    for (var key in manifestUrls) {
        var curManif = manifestUrls[key];

        if (curManif.length > 0) {

            if (curManif[0].url.indexOf('http://') != -1 || curManif[0].url.indexOf('https://') != -1) {  
                continue;
            }

            util_replace_url(key, curManif);                
        }
    }    
};
    


var processDataHLS = function(manifestUrls, cb) {
    
    var manifFound = false;
    
    //search for parent manifest videos
    for (var key in manifestUrls) {
        if (manifestUrls[key].length > 0 && manifestUrls[key][0].isMaster) {
            slices[key] = manifestUrls[key]; 
            manifFound = true;            
        }
    }
    
    // if no main manifest - add manifests of a particular video that the user started playing
    if (!manifFound) {
        Object.keys(manifestUrls).forEach(function(key,index) {

           if (manifestUrls[key].length > 0) { 
                slices[key] = manifestUrls[key]; 
            }
        });
    }
        
    chrome.tabs.executeScript(null, {code: "var slices = " + slices + ";"}, function() {
        chrome.storage.local.set({ 'slices': slices, 'videoType': videoType }, function() { 
            cb();
        }); 
    });
};


var readHLSManifest = function(url, cb) {
    
    // read master m3u8
    callRemote(url, function(resp) {

        // list of objects [RESOLUTION, URL]
        var resolutionAndURLsList = [];
        let audio_objects = [];
        let sub_objects = [];

        var videoInfoRegex = /EXT-X-STREAM-INF:(.+RESOLUTION=(\d+x\d+))?.*(?:\n|\r\n)(.+\.m3u8.*)/gi; 
        var audio_info_regex = /EXT-X-MEDIA:TYPE=AUDIO.*?GROUP-ID="(.*?)".*?NAME="(.*?)".*?URI="(.*?)"/gi;
        var sub_info_regex = /EXT-X-MEDIA:TYPE=SUBTITLES.*?GROUP-ID="(.*?)".*?NAME="(.*?)".*?URI="(.*?)"/gi;
        
        var match = videoInfoRegex.exec(resp);  

        while (match) {
            
            var curResAnURLObj = {};
            curResAnURLObj.isMaster = true;
            curResAnURLObj.isAudio = false;

            // resolution
            if (match[2]) {
                curResAnURLObj.resolution = match[2];
            }
            // URL
            if (match[3]) {
                curResAnURLObj.url = match[3];
            }

            resolutionAndURLsList.push(curResAnURLObj);                        
            match = videoInfoRegex.exec(resp);
        }
        
        
        // AUDIO as a separate stream
        let audio_match = audio_info_regex.exec(resp);
        while (audio_match) {
            let cur_audio_obj = {};

            // GROUP-ID
            if (audio_match[1]) {
                cur_audio_obj.id = audio_match[1];
            }

            // NAME
            if (audio_match[2]) {
                cur_audio_obj.name = audio_match[2];
            }

            // URL
            if (audio_match[3]) {
                cur_audio_obj.url = audio_match[3];
            }

            audio_objects.push(cur_audio_obj);
            audio_match = audio_info_regex.exec(resp);
        }
        
        if (audio_objects.length > 0) 
            resolutionAndURLsList.push({'isAudio': true, 'value': audio_objects});
        
        
        // SUBTITLES as a separate stream
        let sub_match = sub_info_regex.exec(resp);
        while (sub_match) {
            let cur_sub_obj = {};

            // GROUP-ID
            if (sub_match[1]) {
                cur_sub_obj.id = sub_match[1];
            }

            // NAME
            if (sub_match[2]) {
                cur_sub_obj.name = sub_match[2];
            }

            // URL
            if (sub_match[3]) {
                cur_sub_obj.url = sub_match[3];
            }

            sub_objects.push(cur_sub_obj);
            sub_match = sub_info_regex.exec(resp);
        }
        
        if (sub_objects.length > 0) 
            resolutionAndURLsList.push({'isSub': true, 'value': sub_objects});
            

        var manifestVidRegex = /#EXTINF:.+(?:\n|\r\n)(.+)/gi;
        var match2 = resp.match(manifestVidRegex);
        var urlObj; 
        if (match2) {
            urlObj = new URL(url);
            // parent manifest absent
            resolutionAndURLsList.push({'resolution': null, 'url': url});                        
        }                    

        manifestUrls[url] = resolutionAndURLsList; 
        //manifestUrls[url].audio = audio_objects;
        replacePartialURLs(manifestUrls);
        
        videoType = 'hls';
        processDataHLS(manifestUrls, cb);
    });        
}


chrome.webRequest.onCompleted.addListener(function(details) {
   
    var extensionMatch = details.url.match(/\.([^\./\?]+)($|\?)/);
    var extension;
    
    
    if (extensionMatch) {
        extension = extensionMatch[1];
        
        // m3u8 (apple) videos
        if(extension.indexOf('m3u8') !== -1) {
            
            if (!manifestUrls[details.url]) {
                readHLSManifest(details.url, function() {   
                                     
                });
            }
                
        }
        // f4f (adobe) videos
        else if(extension.indexOf('f4m') !== -1) {

            processData(details.url, function() {   
                                     
            });            
        }        
    }
    

}, {
    urls: ["<all_urls>"]
});


