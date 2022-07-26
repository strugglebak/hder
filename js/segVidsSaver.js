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

if (window.location.href.indexOf('chrome-extension:') !== -1 && window.location.href.indexOf('download.html') !== -1) {

  
   
chrome.runtime.sendMessage({
      cmd: 'checkLicence'
    }, (licenceData) => {

      if (licenceData.licenced) {
          
          chrome.storage.local.get(null, function(items) {   
              if (items.slices) {   

                var ind = 0;

                for  (var key in items.slices) {
                    if (items.slices[key].length > 0) {                        

                        // adobe HDS streaming videos
                        if(items.videoType === 'hds') {

                            (function(key) {
                                // get info from the manifest
                                $.ajax({
                                    type: "GET",
                                    url: key,
                                    dataType: 'xml',  
                                    success: function (obj, textstatus) {
                                        try {

                                            const simpleXmlObj = utils.simplexml_load_string(obj);  
                                            const manifestXml = obj.children[0];
                                            adobe.parseManifest(simpleXmlObj, manifestXml, key);   
                                            
                                            var hds_links_div = document.createElement('div');  
                                            hds_links_div.id = 'hds_links_div';
                                            hds_links_div.className = 'small ml-5 mr-5 hls-url hds';                                           
                                            document.getElementById('hlsLinks').appendChild(hds_links_div);

                                            for (let i = 0; i < F4F.HDS.getMediaLength(); i++) {
                                                let curMediaItem = F4F.HDS.getMediaArray()[i];
                                                
                                                (function(curMediaItem) {

                                                    let a = document.createElement('a');
                                                    a.title = curMediaItem[1].url + ' (bitrate: ' + curMediaItem[0] + ')';
                                                    a.text = curMediaItem[1].url + ' (bitrate: ' + curMediaItem[0] + ')';
                                                    a.style = 'display:block;';


                                                    a.onclick = function() {                                            

                                                        F4F.HDS.clearPrevInfo();
                                                        adobe.downloadFragments(obj, curMediaItem);                       
                                                    };



                                                    hds_links_div.appendChild(a);
//                                                    debugger;
//                                                    updateHTML.addBR(2, 'hds_links_div');

                                                })(curMediaItem);
                                            }

                                            //updateHTML.addBR(2, 'hds_links_div');
                                            F4F.HDS.clearMediaArray();

                                        }
                                        catch(e) {
                                            debugger;   
                                        }

                                    },
                                    error: function(XMLHttpRequest, textStatus, errorThrown) {    
                                        debugger;
                                    }
                                });
                                
                            })(key);
                            
                        }

                        // apple HLS streaming videos
                        else if (items.videoType === 'hls' && key.indexOf('.f4m') === -1){ 

                            ind++;

                            var contDiv = document.createElement('div');
                            contDiv.className = 'ac';
                            contDiv.id = 'cont_div';
                            document.getElementById('hlsLinks').appendChild(contDiv);

                            var name = document.createElement('p');
                            name.textContent = key;
                            name.className = 'ac-q small ml-2 mt-2 mr-2';
                            contDiv.appendChild(name);

                            var linksDiv = document.createElement('div');
                            linksDiv.id = 'links-div-' + ind;
                            linksDiv.className = 'ac-a small ml-5 mr-5 hls-url';
                            contDiv.appendChild(linksDiv);

                            for (var i = 0; i < items.slices[key].length; i++) {
                                
                                // list separate AUDIO files
                                if (items.slices[key][i].isAudio) {
                                    let audio_lbl = document.createElement('p');
                                    audio_lbl.textContent = 'AUDIO';
                                    audio_lbl.className = 'audio-lbl';
                                    linksDiv.appendChild(audio_lbl);
                                    
                                    for (let j = 0; j < items.slices[key][i].value.length; j++) {
                                        let cur_audio_obj = items.slices[key][i].value[j];
                                        
                                        let audio_a = document.createElement('a');                       

                                        let audio_link_name = 'ID: ' + cur_audio_obj.id + ', NAME: ' + cur_audio_obj.name 
                                            + ', URL: ' + cur_audio_obj.url;
                                                                                
                                        audio_a.title = audio_link_name;
                                        audio_a.text = audio_link_name;

                                        audio_a.onclick = window.adobeHdsHlsVideoSaver.downloadSlices.bind(null, {  
                                            url: cur_audio_obj.url,
                                            type: 'audio'
                                        });

                                        linksDiv.appendChild(audio_a);
                                        updateHTML.addBR(2, 'links-div-' + ind);
                                        
                                    }
                                }
                                // list separate SUBTITLE files
                                else if (items.slices[key][i].isSub){
                                    let sub_lbl = document.createElement('p');
                                    sub_lbl.textContent = 'SUBTITLES';
                                    sub_lbl.className = 'audio-lbl';
                                    linksDiv.appendChild(sub_lbl);
                                    
                                    for (let j = 0; j < items.slices[key][i].value.length; j++) {
                                        let cur_sub_obj = items.slices[key][i].value[j];
                                        
                                        let sub_a = document.createElement('a');                       

                                        let sub_link_name = 'ID: ' + cur_sub_obj.id + ', NAME: ' + cur_sub_obj.name 
                                            + ', URL: ' + cur_sub_obj.url;
                                                                                
                                        sub_a.title = sub_link_name;
                                        sub_a.text = sub_link_name;

                                        sub_a.onclick = window.adobeHdsHlsVideoSaver.downloadSlices.bind(null, {  
                                            url: cur_sub_obj.url,
                                            type: 'subtitle'
                                        });

                                        linksDiv.appendChild(sub_a);
                                        updateHTML.addBR(2, 'links-div-' + ind);
                                        
                                    }
                                }
                                else {
                                    var a = document.createElement('a');                       

                                    var linkName = '';                    
                                    if (items.slices[key][i].resolution) {                            
                                        linkName +='RESOLUTION: ' + items.slices[key][i].resolution + ',    ';
                                    }
                                    linkName += 'URL: ' + items.slices[key][i].url;
                                    a.title = linkName;
                                    a.text = linkName;

                                    a.onclick = window.adobeHdsHlsVideoSaver.downloadSlices.bind(null, {
                                        /*slices: items.slices,*/
                                        url: items.slices[key][i].url
                                    });

                                    linksDiv.appendChild(a);
                                    updateHTML.addBR(2, 'links-div-' + ind);
                                }
                            }
                        }
                    }
                }



                var accordion = new Accordion("#hlsLinks", {
                    duration:   600,
                    closeOthers:  true,
                    showFirst:    false,
                    containerClass: 'hls-videos-container',
                    elementClass:    'ac',
                    questionClass:     'ac-q',
                    answerClass:     'ac-a'
                });
            
              }
          });   
      }
      else {
            if (document.contains(document.getElementById("buy"))) {
                    document.getElementById("buy").remove();
            }   
            else {
                var buy = document.createElement('p');
                buy.id = 'buy';
                buy.textContent = 'Free trial expired. Please buy the full version.';   
                document.getElementById('hlsLinks').appendChild(buy);
            }

        }
    });
}


var setUp = function() {
    if (document.getElementById('hlsClearBtn')) {
        document.getElementById('hlsClearBtn').onclick = function () {
            document.getElementById('hlsLinks').innerHTML = "";  
            document.getElementById('progressDiv').innerHTML = "";            
            chrome.storage.local.remove('slices');
            chrome.extension.sendMessage({type: "urls", value: []});
            chrome.extension.sendMessage({type: "slices", value: {}});
            chrome.extension.sendMessage({type: "manifestUrls", value: {}});
        };
    }
};

document.addEventListener('DOMContentLoaded', setUp);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    
    if (request.message == "download")
        alert('ok');
      //sendResponse({farewell: "goodbye"});
});