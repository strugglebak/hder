chrome.storage.local.get(null, function(items) {   
    if (items.slices && Object.keys(items.slices).length > 0) {  
        
        document.getElementById('hls_link').value = Object.keys(items.slices)[0];
        document.getElementById('hlsSaveBtn').className = 'btn btn-outline-secondary mt-3';
        
        for  (var key in items.slices) {
            
            if (items.slices[key].length > 0) {
                
                //document.getElementById('hlsSaveBtn').className = 'btn btn-outline-secondary mt-3';
                document.getElementById('hlsSaveBtn').onclick = function () {   
                    
                    chrome.tabs.create({active: true, url: 'download.html'});                                         
                }; 
            }
        }
    }
});



var setUp = function(){
    //document.getElementById('hlsSaveBtn').disabled = true;  
    
    
    document.getElementById("hls_link").addEventListener("keyup", function() {
        var linkText = document.getElementById('hls_link').value;
        if (linkText != "" && linkText.indexOf('.m3u8') !== -1 || linkText.indexOf('.f4m') !== -1 ||
           linkText.indexOf('.mpd') !== -1) {
            
            let btn = document.getElementById('hlsSaveBtn');
            
            
            chrome.extension.sendMessage({type: "link", value: document.getElementById('hls_link').value}, function (response) {
                
                if (response && response == 'read_manifest') {
                    btn.className = 'btn btn-outline-secondary mt-3';
                    btn.onclick = function () { 
                        chrome.tabs.create({active: true, url: 'download.html'});
                    };
                }
            });
            
        } else {
            document.getElementById('hlsSaveBtn').className = 'btn btn-outline-secondary mt-3 disabled';
        }
    });
};

document.addEventListener('DOMContentLoaded', setUp);